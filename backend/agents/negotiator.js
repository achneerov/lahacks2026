const { GoogleGenAI, Type, FunctionCallingConfigMode } = require('@google/genai');
const db = require('../db');
const { emit } = require('./bus');
const { getApplicantProfile, getJobPosting } = require('./profile');
const {
  TOTAL_TURNS,
  applicantAgentSystemPrompt,
  recruiterAgentSystemPrompt,
  verdictSystemPrompt,
  VERDICT_SCHEMA,
} = require('./prompts');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const API_KEY = process.env.GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const DECLINE_TOOL_NAME = 'decline_now';

const RECRUITER_TOOLS = [
  {
    functionDeclarations: [
      {
        name: DECLINE_TOOL_NAME,
        description:
          'Decline this candidate immediately and end the negotiation. Call ONLY when the candidate fails a hard, non-negotiable requirement that no further discussion can fix (e.g. mandatory enrollment status, work authorization, impossible location, explicitly required degree they lack). Do not call for soft concerns or vague answers.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            reason: {
              type: Type.STRING,
              description:
                "A concise factual explanation, grounded ONLY in claims APPLICANT_AGENT made (or failed to make) in this transcript, of why the candidate is fundamentally ineligible. You do not have access to the candidate's profile — do not pretend you do. Two sentences maximum.",
            },
          },
          required: ['reason'],
        },
      },
    ],
  },
];

const RECRUITER_TOOL_CONFIG = {
  functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
};

const running = new Set();

function senderForTurn(turnIndex) {
  return turnIndex % 2 === 0 ? 'applicant_agent' : 'recruiter_agent';
}

function isTransientError(err) {
  if (!err) return false;
  const status = err.status || err.code;
  if (status === 429 || (typeof status === 'number' && status >= 500 && status <= 599)) {
    return true;
  }
  const msg = String(err.message || err || '');
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|rate limit/i.test(msg);
}

async function withRetry(label, fn, applicationId) {
  const MAX = 6;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientError(err) || attempt >= MAX) throw err;
      const waitMs = Math.min(1000 * 2 ** attempt, 20000) + Math.floor(Math.random() * 250);
      attempt += 1;
      emit(applicationId, {
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

// Build the user-message contents the model sees on each turn.
// We replay the transcript inside a single user message rather than threading
// it as multi-turn history; that keeps voice ownership unambiguous (the model
// always speaks as the agent named in the system prompt).
function buildContents(transcript, currentSender) {
  const lines = [];
  if (transcript.length === 0) {
    lines.push(
      'The negotiation is just starting. You speak first.'
    );
  } else {
    lines.push('Transcript so far:');
    for (const m of transcript) {
      lines.push(`[${m.sender.toUpperCase()}]:\n${m.content}`);
    }
  }
  lines.push(
    `\nYou are ${currentSender.toUpperCase()}. Produce only your next message — no preamble, no labels, just the message content.`
  );
  return [{ role: 'user', parts: [{ text: lines.join('\n\n') }] }];
}

function buildVerdictContents(transcript) {
  const lines = ['Full transcript:'];
  for (const m of transcript) {
    lines.push(`[${m.sender.toUpperCase()}]:\n${m.content}`);
  }
  lines.push(
    '\nReturn the verdict JSON now, grounded only in the claims above.'
  );
  return [{ role: 'user', parts: [{ text: lines.join('\n\n') }] }];
}

function persistMessage(applicationId, turnIndex, sender, content) {
  db.prepare(
    `INSERT INTO negotiation_messages (application_id, turn_index, sender, content)
     VALUES (?, ?, ?, ?)`
  ).run(applicationId, turnIndex, sender, content);
}

function updateApplicationStatus(applicationId, status, reasoning, matchScore) {
  db.prepare(
    `UPDATE applications
        SET status = ?, agent_reasoning = ?, match_score = ?,
            decided_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`
  ).run(status, reasoning, matchScore, applicationId);
}

function clampMatchScore(raw, decision) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return decision === 'recommend' ? 65 : 25;
  const clamped = Math.max(0, Math.min(100, n));
  if (decision === 'recommend' && clamped < 50) return 55;
  if (decision === 'decline' && clamped >= 50) return 40;
  return Math.round(clamped);
}

async function runNegotiation(applicationId) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const application = db
    .prepare('SELECT id, applicant_id, job_posting_id, status FROM applications WHERE id = ?')
    .get(applicationId);
  if (!application) throw new Error(`application ${applicationId} not found`);

  const applicantBundle = getApplicantProfile(application.applicant_id);
  if (!applicantBundle) throw new Error(`applicant ${application.applicant_id} not loadable`);
  const jobPosting = getJobPosting(application.job_posting_id);
  if (!jobPosting) throw new Error(`job ${application.job_posting_id} not loadable`);

  const sysPrompts = {
    applicant_agent: applicantAgentSystemPrompt({
      applicantProfile: applicantBundle.profile,
      jobPosting,
    }),
    recruiter_agent: recruiterAgentSystemPrompt({ jobPosting }),
  };

  const transcript = []; // shared in-memory: [{ turnIndex, sender, content }]

  emit(applicationId, {
    type: 'started',
    applicationId,
    totalTurns: TOTAL_TURNS,
  });

  for (let turn = 0; turn < TOTAL_TURNS; turn++) {
    const sender = senderForTurn(turn);
    const isRecruiter = sender === 'recruiter_agent';

    const result = await withRetry(
      `turn ${turn} (${sender})`,
      async () => {
        // Re-emitted on every retry so the UI resets the in-progress buffer.
        emit(applicationId, { type: 'turn-start', turnIndex: turn, sender });

        const config = { systemInstruction: sysPrompts[sender] };
        if (isRecruiter) {
          config.tools = RECRUITER_TOOLS;
          config.toolConfig = RECRUITER_TOOL_CONFIG;
        }

        const stream = await ai.models.generateContentStream({
          model: MODEL,
          contents: buildContents(transcript, sender),
          config,
        });

        let acc = '';
        const fnCalls = [];
        for await (const chunk of stream) {
          const delta = typeof chunk.text === 'string' ? chunk.text : '';
          if (delta) {
            acc += delta;
            emit(applicationId, {
              type: 'delta',
              turnIndex: turn,
              sender,
              delta,
            });
          }
          const calls = chunk.functionCalls;
          if (calls && calls.length) fnCalls.push(...calls);
        }
        return { text: acc.trim(), functionCalls: fnCalls };
      },
      applicationId
    );

    // Recruiter early-decline path.
    if (isRecruiter) {
      const decline = result.functionCalls.find((c) => c.name === DECLINE_TOOL_NAME);
      if (decline) {
        const reason =
          (decline.args && typeof decline.args.reason === 'string'
            ? decline.args.reason.trim()
            : '') || 'Candidate fails a hard, non-negotiable requirement.';
        persistMessage(applicationId, turn, sender, reason);
        emit(applicationId, {
          type: 'turn-complete',
          turnIndex: turn,
          sender,
          content: reason,
        });
        // Hard early decline: low match score reflecting an unrecoverable gap.
        const earlyMatch = 15;
        updateApplicationStatus(applicationId, 'Declined', reason, earlyMatch);
        emit(applicationId, {
          type: 'verdict',
          decision: 'decline',
          reasoning: reason,
          match_score: earlyMatch,
          status: 'Declined',
          early: true,
        });
        emit(applicationId, { type: 'done' });
        return;
      }
    }

    const text = result.text || '(no response)';
    persistMessage(applicationId, turn, sender, text);
    transcript.push({ turnIndex: turn, sender, content: text });
    emit(applicationId, {
      type: 'turn-complete',
      turnIndex: turn,
      sender,
      content: text,
    });
  }

  // Verdict pass after TOTAL_TURNS negotiation exchanges.
  emit(applicationId, { type: 'verdict-pending' });
  const verdictResp = await withRetry(
    'verdict',
    () =>
      ai.models.generateContent({
        model: MODEL,
        contents: buildVerdictContents(transcript),
        config: {
          systemInstruction: verdictSystemPrompt({ jobPosting }),
          responseMimeType: 'application/json',
          responseJsonSchema: VERDICT_SCHEMA,
        },
      }),
    applicationId
  );

  let verdict = { decision: 'decline', reasoning: 'Verdict parsing failed.', match_score: 20 };
  try {
    const raw = typeof verdictResp.text === 'string' ? verdictResp.text : '';
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      (parsed.decision === 'recommend' || parsed.decision === 'decline') &&
      typeof parsed.reasoning === 'string' &&
      parsed.reasoning.trim() !== ''
    ) {
      verdict = {
        decision: parsed.decision,
        reasoning: parsed.reasoning.trim(),
        match_score: clampMatchScore(parsed.match_score, parsed.decision),
      };
    }
  } catch (err) {
    console.warn(`[negotiator] verdict parse failed for app ${applicationId}:`, err.message);
  }

  const status = verdict.decision === 'recommend' ? 'SentToRecruiter' : 'Declined';
  updateApplicationStatus(applicationId, status, verdict.reasoning, verdict.match_score);

  emit(applicationId, {
    type: 'verdict',
    decision: verdict.decision,
    reasoning: verdict.reasoning,
    match_score: verdict.match_score,
    status,
  });
  emit(applicationId, { type: 'done' });
}

function startNegotiation(applicationId) {
  if (running.has(applicationId)) return;
  running.add(applicationId);
  setImmediate(async () => {
    try {
      await runNegotiation(applicationId);
    } catch (err) {
      console.error(`[negotiator] application ${applicationId} failed:`, err);
      try {
        db.prepare(
          "UPDATE applications SET status = 'Declined', agent_reasoning = ?, decided_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
        ).run(`Negotiation failed: ${String((err && err.message) || err)}`, applicationId);
      } catch (dbErr) {
        console.error('[negotiator] failed to mark Declined after error:', dbErr);
      }
      emit(applicationId, {
        type: 'error',
        message: String((err && err.message) || err),
      });
      emit(applicationId, { type: 'done' });
    } finally {
      running.delete(applicationId);
    }
  });
}

function isConfigured() {
  return !!ai;
}

module.exports = { startNegotiation, isConfigured };
