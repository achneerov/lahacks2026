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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
                'A concise factual explanation, grounded in the applicant profile, of why the candidate is fundamentally ineligible. Two sentences maximum.',
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

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 20000;

function isRetryable(err) {
  if (!err) return false;
  if (RETRY_STATUSES.has(err.status)) return true;
  const msg = String(err.message || '');
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|rate limit/i.test(msg);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shortErr(err) {
  if (!err) return 'unknown';
  const status = err.status ? `status=${err.status}` : '';
  const msg = String(err.message || err).replace(/\s+/g, ' ').slice(0, 240);
  return [status, msg].filter(Boolean).join(' ');
}

async function withRetry(label, fn, applicationId) {
  let attempt = 0;
  while (true) {
    const startedAt = Date.now();
    const tag = `[gemini] ${label}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`;
    console.log(`${tag} → start`);
    try {
      const result = await fn();
      const ms = Date.now() - startedAt;
      console.log(`${tag} ✓ ok in ${ms}ms`);
      return result;
    } catch (err) {
      const ms = Date.now() - startedAt;
      const retryable = isRetryable(err);
      console.error(`${tag} ✗ failed in ${ms}ms — ${shortErr(err)}${retryable ? ' (retryable)' : ' (non-retryable)'}`);
      if (!retryable || attempt >= MAX_RETRIES) throw err;
      const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      const jitter = Math.floor(Math.random() * 250);
      const waitMs = delay + jitter;
      attempt++;
      console.warn(`${tag} ↻ retry ${attempt}/${MAX_RETRIES} in ${waitMs}ms`);
      if (applicationId != null) {
        emit(applicationId, {
          type: 'retry',
          label,
          attempt,
          maxRetries: MAX_RETRIES,
          waitMs,
        });
      }
      await sleep(waitMs);
    }
  }
}

function senderForTurn(turnIndex) {
  return turnIndex % 2 === 0 ? 'applicant_agent' : 'recruiter_agent';
}

function buildContents(transcript, currentSender) {
  const transcriptText = transcript.length === 0
    ? '(The negotiation is just starting. You speak first — open by introducing the applicant in light of this role.)'
    : transcript.map(m => {
        const label = m.sender === 'applicant_agent' ? 'APPLICANT_AGENT' : 'RECRUITER_AGENT';
        return `[${label}]:\n${m.content}`;
      }).join('\n\n');

  const youAre = currentSender === 'applicant_agent' ? 'APPLICANT_AGENT' : 'RECRUITER_AGENT';

  return [{
    role: 'user',
    parts: [{
      text: `Negotiation transcript so far:\n\n${transcriptText}\n\n---\n\nYou are ${youAre}. Produce only your next message — no preamble, no labels, just the message content.`,
    }],
  }];
}

function buildVerdictContents(transcript) {
  const transcriptText = transcript.map(m => {
    const label = m.sender === 'applicant_agent' ? 'APPLICANT_AGENT' : 'RECRUITER_AGENT';
    return `[${label}]:\n${m.content}`;
  }).join('\n\n');

  return [{
    role: 'user',
    parts: [{
      text: `Full negotiation transcript:\n\n${transcriptText}\n\n---\n\nNow output your final decision as JSON: { "decision": "recommend" | "decline", "reasoning": string }. Reasoning should be 2-4 sentences explaining the call, grounded only in facts from the applicant profile.`,
    }],
  }];
}

async function runNegotiation(applicationId) {
  const application = db
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(applicationId);
  if (!application) throw new Error(`application ${applicationId} not found`);

  const applicantData = getApplicantProfile(application.applicant_id);
  const jobPosting = getJobPosting(application.job_posting_id);
  if (!applicantData || !jobPosting) {
    throw new Error('missing applicant or job data');
  }
  const applicantProfile = {
    user: applicantData.user,
    profile: applicantData.profile,
  };

  const promptCtx = { applicantProfile, jobPosting };
  const sysPrompts = {
    applicant_agent: applicantAgentSystemPrompt(promptCtx),
    recruiter_agent: recruiterAgentSystemPrompt(promptCtx),
  };

  const transcript = [];
  const negotiationStart = Date.now();

  console.log(`[negotiator] application ${applicationId} starting (${TOTAL_TURNS} turns, model=${MODEL})`);
  emit(applicationId, { type: 'started', applicationId, totalTurns: TOTAL_TURNS });

  for (let turn = 0; turn < TOTAL_TURNS; turn++) {
    const sender = senderForTurn(turn);
    const isRecruiter = sender === 'recruiter_agent';

    const result = await withRetry(
      `turn ${turn} (${sender})`,
      async () => {
        // Re-emitted on each attempt so the UI resets the buffer for this turn.
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
          const delta = chunk.text || '';
          if (delta) {
            acc += delta;
            emit(applicationId, { type: 'delta', turnIndex: turn, sender, delta });
          }
          const calls = chunk.functionCalls;
          if (calls && calls.length) fnCalls.push(...calls);
        }
        return { text: acc, functionCalls: fnCalls };
      },
      applicationId
    );

    const declineCall = isRecruiter
      ? result.functionCalls.find((fc) => fc.name === DECLINE_TOOL_NAME)
      : null;

    if (declineCall) {
      const reasoning = String(declineCall.args?.reason || '').trim() || 'Candidate is fundamentally ineligible.';
      db.prepare(
        'INSERT INTO negotiation_messages (application_id, turn_index, sender, content) VALUES (?, ?, ?, ?)'
      ).run(applicationId, turn, sender, reasoning);
      emit(applicationId, { type: 'turn-complete', turnIndex: turn, sender, content: reasoning });

      db.prepare(
        "UPDATE applications SET status = 'Declined', agent_reasoning = ?, decided_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
      ).run(reasoning, applicationId);
      const totalMs = Date.now() - negotiationStart;
      console.log(`[negotiator] application ${applicationId} declined via tool at turn ${turn} in ${totalMs}ms`);
      emit(applicationId, { type: 'verdict', decision: 'decline', reasoning, status: 'Declined' });
      emit(applicationId, { type: 'done' });
      return;
    }

    const content = result.text.trim();
    db.prepare(
      'INSERT INTO negotiation_messages (application_id, turn_index, sender, content) VALUES (?, ?, ?, ?)'
    ).run(applicationId, turn, sender, content);

    transcript.push({ sender, content });
    emit(applicationId, { type: 'turn-complete', turnIndex: turn, sender, content });
  }

  emit(applicationId, { type: 'verdict-pending' });

  const verdictResp = await withRetry(
    'verdict',
    () =>
      ai.models.generateContent({
        model: MODEL,
        contents: buildVerdictContents(transcript),
        config: {
          systemInstruction: verdictSystemPrompt(promptCtx),
          responseMimeType: 'application/json',
          responseJsonSchema: VERDICT_SCHEMA,
        },
      }),
    applicationId
  );

  const raw = verdictResp.text || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { decision: 'decline', reasoning: 'Verdict parsing failed.' };
  }
  const decision = parsed.decision === 'recommend' ? 'recommend' : 'decline';
  const reasoning = String(parsed.reasoning || '').trim();
  const status = decision === 'recommend' ? 'SentToRecruiter' : 'Declined';

  db.prepare(
    "UPDATE applications SET status = ?, agent_reasoning = ?, decided_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(status, reasoning, applicationId);

  const totalMs = Date.now() - negotiationStart;
  console.log(`[negotiator] application ${applicationId} done in ${totalMs}ms — status=${status} decision=${decision}`);

  emit(applicationId, { type: 'verdict', decision, reasoning, status });
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
        ).run(`Negotiation failed: ${String(err && err.message || err)}`, applicationId);
      } catch (dbErr) {
        console.error('[negotiator] failed to mark Declined after error:', dbErr);
      }
      emit(applicationId, { type: 'error', message: String(err && err.message || err) });
      emit(applicationId, { type: 'done' });
    } finally {
      running.delete(applicationId);
    }
  });
}

module.exports = { startNegotiation };
