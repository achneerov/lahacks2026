const { GoogleGenAI, Type } = require('@google/genai');
const db = require('../db');
const { insertMessage } = require('../messaging');
const { emitOffer } = require('./bus');

const MODEL = 'gemini-2.5-flash';
const OFFER_TURNS = 6;
const API_KEY = process.env.GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const running = new Set();

const BATCH_INTERVENTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    matched_indices: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description:
        '0-based indices of candidate sensitive topics that the negotiation text touches or plausibly implicates. Include a topic on tangential, thematic, or paraphrased connection. Empty array if none. Err on the side of more matches if unsure.',
    },
  },
  required: ['matched_indices'],
};

/** @type {Map<number, { turnIndex: number, matchedTopics: string[], resolve: (v: { type: 'agent' } | { type: 'human', text: string }) => void, timeoutId: ReturnType<typeof setTimeout> }>} */
const interventionWaiters = new Map();
const INTERVENTION_WAIT_MS = 10 * 60 * 1000;

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

function buildContextForIntervention({ transcript, initialTerms, counterTerms }) {
  if (transcript.length === 0) {
    return `This is the very start of the offer negotiation. No agent messages have been written yet.

Company's written offer:
${initialTerms}

The candidate's counter and priorities (what the candidate is asking to change or secure):
${counterTerms}`;
  }
  const parts = ['Negotiation transcript so far:'];
  for (const m of transcript) {
    parts.push(`[${m.sender.toUpperCase()}]:\n${m.content}`);
  }
  return parts.join('\n\n');
}

function getInterventionPending(negotiationId) {
  const w = interventionWaiters.get(negotiationId);
  if (!w) return null;
  return { turnIndex: w.turnIndex, matched_topics: w.matchedTopics };
}

/**
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function submitInterventionChoice(negotiationId, turnIndex, { useAgent, message }) {
  const w = interventionWaiters.get(negotiationId);
  if (!w || w.turnIndex !== turnIndex) {
    return { ok: false, error: 'not_waiting' };
  }
  if (useAgent) {
    clearTimeout(w.timeoutId);
    interventionWaiters.delete(negotiationId);
    w.resolve({ type: 'agent' });
    return { ok: true };
  }
  if (typeof message === 'string' && message.trim() !== '') {
    const t = message.trim();
    if (t.length > 8000) {
      return { ok: false, error: 'message_too_long' };
    }
    clearTimeout(w.timeoutId);
    interventionWaiters.delete(negotiationId);
    w.resolve({ type: 'human', text: t });
    return { ok: true };
  }
  return { ok: false, error: 'invalid_body' };
}

function waitForInterventionChoice(negotiationId, turnIndex, matchedTopics) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      const cur = interventionWaiters.get(negotiationId);
      if (cur && cur.turnIndex === turnIndex) {
        interventionWaiters.delete(negotiationId);
        console.warn(`[offer-negotiator] intervention wait timed out for negotiation ${negotiationId}`);
        resolve({ type: 'agent' });
      }
    }, INTERVENTION_WAIT_MS);
    interventionWaiters.set(negotiationId, {
      turnIndex,
      matchedTopics,
      resolve,
      timeoutId,
    });
  });
}

/**
 * One LLM call with the full list of user-supplied topics + the negotiation
 * so far. No string-matching; indices map back to the same phrases the user saved.
 */
async function findMatchingInterventionTopics(negotiationId, contextText, topics) {
  const cleaned = topics
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean);
  if (cleaned.length === 0) {
    return [];
  }

  const listBlock = cleaned.map((t, i) => `[${i}] ${t}`).join('\n');
  const lastIdx = cleaned.length - 1;

  const prompt = `You are helping a job candidate. They pre-registered **sensitive topics** (short phrases) they may want to type themselves instead of an AI agent, if the negotiation implicates any of them.

CANDIDATE SENSITIVE TOPICS (0-based index on the left; use only these when returning matched_indices):
${listBlock}

NEGOTIATION CONTEXT (initial offer, counter, and any agent lines so far):
${String(contextText)}

Task: Return "matched_indices": an array of integers from 0 to ${lastIdx} inclusive, **only** for topics where the text above (including related themes, paraphrases, or *tangential* links) plausibly touches that concern. Be **inclusive**: if a reasonable person could connect a thread in the conversation to a listed topic, include that index. Return an **empty** array if nothing applies.

The candidate told you which themes matter; err on the side of offering them a say.`;

  const matched = await withRetry(
    'intervention batch check',
    async () => {
      const r = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: BATCH_INTERVENTION_SCHEMA,
        },
      });
      const raw = typeof r.text === 'string' ? r.text : '';
      const p = JSON.parse(raw);
      const out = new Set();
      if (Array.isArray(p.matched_indices)) {
        for (const idx of p.matched_indices) {
          const n = Math.trunc(Number(idx));
          if (n >= 0 && n < cleaned.length) out.add(n);
        }
      }
      return [...out].sort((a, b) => a - b).map((i) => cleaned[i]);
    },
    negotiationId,
  );

  if (matched.length) {
    console.log(
      `[offer-intervention] N=${negotiationId} batch LLM matched: ${JSON.stringify(
        matched.map((m) => m.slice(0, 64)),
      )}`,
    );
  } else {
    console.log(
      `[offer-intervention] N=${negotiationId} batch LLM: no index matched (${cleaned.length} topic(s) in one pass)`,
    );
  }
  return matched;
}

async function runStreamingModelTurn(negotiationId, turn, sender, systemInstruction, dialogContents) {
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
}

function applicantOfferPrompt({ initialTerms, counterTerms, candidateName }) {
  const nameLine = candidateName
    ? `The candidate's name is ${candidateName}. Refer to them by this name when natural; never use placeholders like "[applicant name]" or "the candidate" as a stand-in for a real name.`
    : `The candidate's name is not available; refer to them as "the candidate" rather than any bracketed placeholder.`;
  return `You are APPLICANT_AGENT representing a job candidate in a compensation and terms negotiation.

${nameLine}

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
- Never emit bracketed placeholders such as "[applicant name]", "[name]", or "[candidate]" — write the real name above, or use "the candidate".
- Stay focused: each turn should move the negotiation one step toward a deal that honors both sides' priorities.

Output only the message the recruiter's agent will read.`;
}

function recruiterOfferPrompt({ initialTerms, counterTerms, jobContext, candidateName }) {
  const job = jobContext ? JSON.stringify(jobContext, null, 2) : '(no extra job context)';
  const nameLine = candidateName
    ? `The candidate's name is ${candidateName}. Address them by this name when natural; never use placeholders like "[applicant name]".`
    : `The candidate's name is not available; refer to them as "the candidate" rather than any bracketed placeholder.`;
  return `You are RECRUITER_AGENT representing the employer in a compensation and terms negotiation.

${nameLine}

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
- Never emit bracketed placeholders such as "[applicant name]", "[name]", or "[candidate]" — write the real name above, or use "the candidate".
- One focused move per turn (trade, concession, or clarifying ask).

Output only the message the applicant's agent will read.`;
}

function settlementPrompt({ initialTerms, counterTerms, transcriptText, candidateName }) {
  const nameLine = candidateName
    ? `Candidate name: ${candidateName}. Use this real name where appropriate; never write bracketed placeholders like "[applicant name]".`
    : `Candidate name unknown; refer to them as "the candidate" — never use bracketed placeholders.`;
  return `The following is a 5-message negotiation between APPLICANT_AGENT and RECRUITER_AGENT about a job offer.

${nameLine}

**Company's opening written offer:**
${initialTerms}

**Candidate's counter:**
${counterTerms}

**Full transcript:**
${transcriptText}

Task: produce a final, balanced employment package that both sides are likely to accept. The final numbers must be realistic and fall between or reconcile the two written positions. If something was left open in the messages, use reasonable defaults and say so in key_points.

Return JSON only, matching the schema.`;
}

function loadCandidateName(applicantUserId) {
  if (!applicantUserId) return null;
  const row = db
    .prepare(
      `SELECT first_name, middle_initial, last_name, preferred_name
         FROM user_profiles WHERE user_id = ?`,
    )
    .get(applicantUserId);
  if (!row) return null;
  const first = (row.preferred_name || row.first_name || '').trim();
  const last = (row.last_name || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || null;
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
  const candidateName = loadCandidateName(row.applicant_user_id);

  let interventionTopics = [];
  try {
    if (row.intervention_topics) {
      const t = JSON.parse(row.intervention_topics);
      if (Array.isArray(t)) {
        interventionTopics = t.map((s) => String(s).trim()).filter(Boolean);
      }
    }
  } catch {
    /* */
  }
  if (interventionTopics.length > 20) {
    interventionTopics = interventionTopics.slice(0, 20);
  }
  if (interventionTopics.length > 0) {
    console.log(
      `[offer-intervention] N=${negotiationId} start with ${interventionTopics.length} watch phrase(s): ${JSON.stringify(
        interventionTopics,
      )}`,
    );
  }

  const sysPrompts = {
    applicant_agent: applicantOfferPrompt({ initialTerms, counterTerms, candidateName }),
    recruiter_agent: recruiterOfferPrompt({ initialTerms, counterTerms, jobContext: job, candidateName }),
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

    let result;
    if (sender === 'applicant_agent' && interventionTopics.length > 0) {
      const ctx = buildContextForIntervention({ transcript, initialTerms, counterTerms });
      console.log(
        `[offer-intervention] N=${negotiationId} scanning applicant turn ${turn} (transcript len ${transcript.length} chars, context ${ctx.length} chars)`,
      );
      const matched = await findMatchingInterventionTopics(negotiationId, ctx, interventionTopics);
      if (matched.length === 0) {
        result = await withRetry(
          `turn ${turn} (${sender})`,
          () =>
            runStreamingModelTurn(
              negotiationId,
              turn,
              sender,
              systemInstruction,
              buildTurnContents(transcript, sender),
            ),
          negotiationId,
        );
      } else {
        console.log(
          `[offer-intervention] N=${negotiationId} pausing for candidate at turn ${turn}; matches=${JSON.stringify(
            matched,
          )}`,
        );
        const choicePromise = waitForInterventionChoice(negotiationId, turn, matched);
        emitOffer(negotiationId, {
          type: 'intervention-detected',
          turnIndex: turn,
          matched_topics: matched,
        });
        const choice = await choicePromise;
        console.log(
          `[offer-intervention] N=${negotiationId} turn ${turn} choice=${choice.type}${
            choice.type === 'human' ? ' (len ' + (choice.text && choice.text.length) + ')' : ''
          }`,
        );
        if (choice.type === 'human') {
          const text = choice.text;
          emitOffer(negotiationId, { type: 'turn-start', turnIndex: turn, sender });
          emitOffer(negotiationId, { type: 'delta', turnIndex: turn, sender, delta: text });
          result = text;
        } else {
          result = await withRetry(
            `turn ${turn} (${sender})`,
            () =>
              runStreamingModelTurn(
                negotiationId,
                turn,
                sender,
                systemInstruction,
                buildTurnContents(transcript, sender),
              ),
            negotiationId,
          );
        }
      }
    } else {
      result = await withRetry(
        `turn ${turn} (${sender})`,
        () =>
          runStreamingModelTurn(
            negotiationId,
            turn,
            sender,
            systemInstruction,
            buildTurnContents(transcript, sender),
          ),
        negotiationId,
      );
    }

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
              { text: settlementPrompt({ initialTerms, counterTerms, transcriptText, candidateName }) },
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
  getInterventionPending,
  submitInterventionChoice,
};
