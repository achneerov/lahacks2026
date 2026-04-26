const { GoogleGenAI, Type } = require('@google/genai');
const db = require('../db');
const { insertMessage } = require('../messaging');
const { emitOffer } = require('./bus');

const MODEL = 'gemini-2.5-flash';
const OFFER_TURNS = 5;
const API_KEY = process.env.GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const running = new Set();

const SETTLEMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    final_terms: {
      type: Type.STRING,
      description:
        'A single, clear package of agreed terms (compensation, schedule, start date, benefits highlights) you can hand to a candidate and a hiring manager. No placeholder numbers — concrete figures.',
    },
    key_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3–6 bullet-style strings summarising the non-negotiables each side can rely on.',
    },
    summary_for_both: {
      type: Type.STRING,
      description:
        "One short paragraph in neutral tone: what each side gave and what they gained, suitable for a chat message.",
    },
  },
  required: ['final_terms', 'key_points', 'summary_for_both'],
};

function isTransientError(err) {
  if (!err) return false;
  const status = err.status || err.code;
  if (status === 429 || (typeof status === 'number' && status >= 500 && status <= 599)) {
    return true;
  }
  const msg = String(err.message || err || '');
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|rate limit/i.test(msg);
}

async function withRetry(label, fn, negotiationId) {
  const MAX = 6;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientError(err) || attempt >= MAX) throw err;
      const waitMs = Math.min(1000 * 2 ** attempt, 20000) + Math.floor(Math.random() * 250);
      attempt += 1;
      emitOffer(negotiationId, {
        type: 'retry',
        label,
        attempt,
        maxRetries: MAX,
        waitMs,
      });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

function senderForTurn(turnIndex) {
  return turnIndex % 2 === 0 ? 'applicant_agent' : 'recruiter_agent';
}

function buildTurnContents(transcript, currentSender) {
  const lines = [];
  if (transcript.length === 0) {
    lines.push('The negotiation is just starting. You speak first.');
  } else {
    lines.push('Transcript so far:');
    for (const m of transcript) {
      lines.push(`[${m.sender.toUpperCase()}]:\n${m.content}`);
    }
  }
  lines.push(
    `\nYou are ${currentSender.toUpperCase()}. Produce only your next message — no preamble, no labels, just the message content.`,
  );
  return [{ role: 'user', parts: [{ text: lines.join('\n\n') }] }];
}

function applicantOfferPrompt({ initialTerms, counterTerms }) {
  return `You are APPLICANT_AGENT representing a job candidate in a compensation and terms negotiation.

**What the company first proposed (recruiter's written offer):**
---
${initialTerms}
---

**What the candidate is asking for (the candidate's counter in their own words):**
---
${counterTerms}
---

Your job: in at most ${Math.ceil(OFFER_TURNS / 2)} short turns, advocate professionally for the candidate's position. You want the best realistic package: push on gaps between the two sides (salary, bonus, PTO, equity, remote days, start date) without being hostile. Cite the candidate's counter when it helps; concede minor points if it unlocks a better trade elsewhere.

Rules:
- Hard 80 words per turn maximum.
- No markdown headers. Plain prose, one or two short paragraphs.
- Do not fabricate new numbers that contradict the two texts above; you may suggest compromises that blend them.
- Stay focused: each turn should move the negotiation one step toward a deal that honors both sides' priorities.

Output only the message the recruiter's agent will read.`;
}

function recruiterOfferPrompt({ initialTerms, counterTerms, jobContext }) {
  const job = jobContext ? JSON.stringify(jobContext, null, 2) : '(no extra job context)';
  return `You are RECRUITER_AGENT representing the employer in a compensation and terms negotiation.

**The formal package the company already put on record:**
---
${initialTerms}
---

**What the candidate is asking for:**
---
${counterTerms}
---

Optional job context (title, comp band if any, work model from posting):
${job}

Your job: in at most ${Math.floor(OFFER_TURNS / 2)} short turns, defend a fair package for the company while seeking common ground. You may trade flexibility on schedule, PTO, or timing if it secures a signed agreement. Do not undercut the company's stated range without negotiation trade-offs.

Rules:
- Hard 80 words per turn maximum.
- No markdown headers. Plain prose.
- Do not invent policies or budgets not implied by the materials above; stay plausible.
- One focused move per turn (trade, concession, or clarifying ask).

Output only the message the applicant's agent will read.`;
}

function settlementPrompt({ initialTerms, counterTerms, transcriptText }) {
  return `The following is a 5-message negotiation between APPLICANT_AGENT and RECRUITER_AGENT about a job offer.

**Company's opening written offer:**
${initialTerms}

**Candidate's counter:**
${counterTerms}

**Full transcript:**
${transcriptText}

Task: produce a final, balanced employment package that both sides are likely to accept. The final numbers must be realistic and fall between or reconcile the two written positions. If something was left open in the messages, use reasonable defaults and say so in key_points.

Return JSON only, matching the schema.`;
}

function persistTurn(negotiationId, turnIndex, sender, content) {
  db.prepare(
    `INSERT INTO offer_negotiation_messages (offer_negotiation_id, turn_index, sender, content)
     VALUES (?, ?, ?, ?)`,
  ).run(negotiationId, turnIndex, sender, content);
}

function updateNegotiationRow(negotiationId, fields) {
  const { status, final_terms, final_summary, final_key_points, error_message } = fields;
  const parts = ['updated_at = datetime(\'now\')'];
  const vals = [];
  if (status != null) {
    parts.push('status = ?');
    vals.push(status);
  }
  if (final_terms != null) {
    parts.push('final_terms = ?');
    vals.push(final_terms);
  }
  if (final_summary != null) {
    parts.push('final_summary = ?');
    vals.push(final_summary);
  }
  if (final_key_points != null) {
    parts.push('final_key_points = ?');
    vals.push(final_key_points);
  }
  if (error_message != null) {
    parts.push('error_message = ?');
    vals.push(error_message);
  }
  vals.push(negotiationId);
  db.prepare(
    `UPDATE offer_negotiations SET ${parts.join(', ')} WHERE id = ?`,
  ).run(...vals);
}

function loadJobPosting(jobPostingId) {
  if (!jobPostingId) return null;
  return (
    db
      .prepare(
        `SELECT id, title, company, salary_min, salary_max, salary_currency, remote, location,
                work_model, office_locations
           FROM job_postings WHERE id = ?`,
      )
      .get(jobPostingId) || null
  );
}

function loadMessages(negotiationId) {
  return db
    .prepare(
      `SELECT turn_index, sender, content, created_at
         FROM offer_negotiation_messages
        WHERE offer_negotiation_id = ?
        ORDER BY turn_index ASC`,
    )
    .all(negotiationId);
}

/** Run 5 agent turns, then a structured settlement, then mark DB complete. */
async function runOfferNegotiation(negotiationId) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const row = db
    .prepare('SELECT * FROM offer_negotiations WHERE id = ?')
    .get(negotiationId);
  if (!row) {
    throw new Error(`offer_negotiation ${negotiationId} not found`);
  }
  if (row.status === 'complete' || row.status === 'accepted_initial') {
    return;
  }
  if (!row.applicant_counter || String(row.applicant_counter).trim() === '') {
    throw new Error('missing counter');
  }

  const initialTerms = String(row.initial_terms);
  const counterTerms = String(row.applicant_counter);
  const job = loadJobPosting(row.job_posting_id);

  const sysPrompts = {
    applicant_agent: applicantOfferPrompt({ initialTerms, counterTerms }),
    recruiter_agent: recruiterOfferPrompt({ initialTerms, counterTerms, jobContext: job }),
  };

  const transcript = [];

  emitOffer(negotiationId, {
    type: 'started',
    negotiationId,
    totalTurns: OFFER_TURNS,
  });

  for (let turn = 0; turn < OFFER_TURNS; turn++) {
    const sender = senderForTurn(turn);
    const systemInstruction = sysPrompts[sender];

    const result = await withRetry(
      `turn ${turn} (${sender})`,
      async () => {
        const dialogContents = buildTurnContents(transcript, sender);
        const stream = await ai.models.generateContentStream({
          model: MODEL,
          contents: dialogContents,
          config: { systemInstruction },
        });
        let acc = '';
        emitOffer(negotiationId, { type: 'turn-start', turnIndex: turn, sender });
        for await (const chunk of stream) {
          const delta = typeof chunk.text === 'string' ? chunk.text : '';
          if (delta) {
            acc += delta;
            emitOffer(negotiationId, {
              type: 'delta',
              turnIndex: turn,
              sender,
              delta,
            });
          }
        }
        return acc.trim() || '(no response)';
      },
      negotiationId,
    );

    persistTurn(negotiationId, turn, sender, result);
    transcript.push({ turnIndex: turn, sender, content: result });
    emitOffer(negotiationId, {
      type: 'turn-complete',
      turnIndex: turn,
      sender,
      content: result,
    });
  }

  emitOffer(negotiationId, { type: 'verdict-pending' });

  const lines = ['Full transcript:'];
  for (const m of transcript) {
    lines.push(`[${m.sender.toUpperCase()}]:\n${m.content}`);
  }
  const transcriptText = lines.join('\n\n');

  const settlementResp = await withRetry(
    'settlement',
    () =>
      ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { text: settlementPrompt({ initialTerms, counterTerms, transcriptText }) },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: SETTLEMENT_SCHEMA,
        },
      }),
    negotiationId,
  );

  let finalTerms = '';
  let keyPoints = [];
  let summaryForBoth = 'Negotiation complete.';
  try {
    const raw = typeof settlementResp.text === 'string' ? settlementResp.text : '';
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.final_terms === 'string') {
      finalTerms = parsed.final_terms.trim();
    }
    if (Array.isArray(parsed.key_points)) {
      keyPoints = parsed.key_points.map((k) => String(k)).filter(Boolean);
    }
    if (typeof parsed.summary_for_both === 'string' && parsed.summary_for_both.trim() !== '') {
      summaryForBoth = parsed.summary_for_both.trim();
    }
  } catch (e) {
    console.warn(`[offer-negotiator] settlement parse failed for ${negotiationId}:`, e.message);
    finalTerms = `${initialTerms}\n\n(Automated summary unavailable — refer to the negotiation transcript in thread.)`;
  }

  const keyPointsJson = JSON.stringify(keyPoints);

  updateNegotiationRow(negotiationId, {
    status: 'complete',
    final_terms: finalTerms,
    final_summary: summaryForBoth,
    final_key_points: keyPointsJson,
  });

  const negRow = db.prepare('SELECT * FROM offer_negotiations WHERE id = ?').get(negotiationId);
  if (negRow) {
    const keyBullets =
      keyPoints.length > 0 ? `\n\n${keyPoints.map((k) => `• ${k}`).join('\n')}` : '';
    const chatBody = [summaryForBoth, '', finalTerms + keyBullets]
      .filter((s) => s !== '')
      .join('\n\n');
    insertMessage({
      conversationId: negRow.conversation_id,
      userId: negRow.recruiter_user_id,
      content: chatBody,
      kind: 'offer_settled',
      metadata: {
        negotiation_id: negotiationId,
        summary: summaryForBoth,
        terms: finalTerms,
        key_points: keyPoints,
        source: 'agent_negotiation',
      },
    });
  }

  emitOffer(negotiationId, {
    type: 'settlement',
    final_terms: finalTerms,
    key_points: keyPoints,
    summary_for_both: summaryForBoth,
  });
  emitOffer(negotiationId, { type: 'done' });
}

function startOfferNegotiation(negotiationId) {
  if (running.has(negotiationId)) return;
  running.add(negotiationId);
  setImmediate(async () => {
    try {
      await runOfferNegotiation(negotiationId);
    } catch (err) {
      console.error(`[offer-negotiator] negotiation ${negotiationId} failed:`, err);
      const msg = String((err && err.message) || err);
      try {
        updateNegotiationRow(negotiationId, {
          status: 'complete',
          error_message: msg,
          final_summary: 'Negotiation could not be completed. Please follow up in chat.',
        });
        const negRow = db.prepare('SELECT * FROM offer_negotiations WHERE id = ?').get(negotiationId);
        if (negRow) {
          insertMessage({
            conversationId: negRow.conversation_id,
            userId: negRow.recruiter_user_id,
            content: `The automated offer negotiation could not be completed (${msg.slice(0, 200)}). Please align directly in this thread.`,
            kind: 'offer_settled',
            metadata: { negotiation_id: negotiationId, error: true },
          });
        }
      } catch (dbErr) {
        console.error('[offer-negotiator] failed to record error', dbErr);
      }
      emitOffer(negotiationId, { type: 'error', message: msg });
      emitOffer(negotiationId, { type: 'done' });
    } finally {
      running.delete(negotiationId);
    }
  });
}

function isConfigured() {
  return !!ai;
}

module.exports = {
  OFFER_TURNS,
  startOfferNegotiation,
  isConfigured,
  loadJobPosting,
  loadMessages,
};
