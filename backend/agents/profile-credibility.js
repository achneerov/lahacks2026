// Credibility reviewer for applicant profile edits to "critical" fields
// (links, work_experience, education).
//
// Given the user's current profile, the diff they just submitted, and the
// audit log of every previous critical-field change attempt (approved AND
// rejected), Gemini decides whether this looks like genuine resume upkeep
// or like the candidate trying to lie about themselves.
//
// Verdict shape:  { verdict: 'approve' | 'decline', reasoning: string }
//
// Failure mode:   throws on Gemini errors (no fallback). The route handler
//                 maps this to a 503 so the save is rejected without locking
//                 the user — a Gemini outage is not a fraud verdict.

const { GoogleGenAI, Type } = require('@google/genai');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const API_KEY = process.env.GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const VERDICT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    verdict: {
      type: Type.STRING,
      enum: ['approve', 'decline'],
      description:
        'approve if the change looks like normal resume maintenance; decline if it looks like the candidate is fabricating, embellishing, or otherwise misrepresenting their record.',
    },
    reasoning: {
      type: Type.STRING,
      description:
        'A 1-3 sentence justification, written directly to the candidate, citing the specific change(s) that drove the verdict. Plain prose, no markdown.',
    },
  },
  required: ['verdict', 'reasoning'],
};

const SYSTEM_PROMPT = `You are PROFILE_CREDIBILITY_AGENT, an automated reviewer of high-impact edits a job candidate just made to their own profile.

Your job: decide whether the proposed change looks like legitimate resume upkeep (approve) or like the candidate is trying to misrepresent themselves to recruiters (decline).

You are reviewing changes to "critical" fields ONLY:
- links: linkedin_url, website_portfolio, github_or_other_portfolio
- work_experience entries (any field of any entry, plus added/removed entries)
- education entries (any field of any entry, plus added/removed entries)

WHAT COUNTS AS SUSPICIOUS (decline):
- Inflating a job title (e.g. "Software Engineer Intern" -> "Senior Software Engineer") with no plausible time gap.
- Promoting oneself within the same job by editing the title in place rather than adding a new entry.
- Backdating a start_date or pushing an end_date to claim more tenure than previously stated.
- Adding an entirely new work experience or degree that did not exist a moment ago at a top-tier / brand-name employer or school, especially if recent.
- Swapping the company name on an existing entry (e.g. small startup -> FAANG) while keeping the dates.
- Upgrading a degree (e.g. B.S. -> M.S., or unfinished -> graduated) for the same school+dates.
- Replacing a portfolio URL with one that points to clearly fabricated work, OR repeated link rotations.
- Repeated history of attempting and rolling back similar embellishments — pattern matters.

WHAT IS NORMAL (approve):
- Typo / spelling / capitalization / formatting fixes ("googl" -> "Google", "ux Engineer" -> "UX Engineer").
- Filling in fields that were previously empty for the FIRST time, with plausible values.
- Adding responsibilities / key_achievements / coursework text.
- Updating an end_date, marking current_job true/false, or adding a graduation_date that is consistent with the previously stated start_date.
- Adding a brand-new role with a recent start_date that fits the rest of the timeline (people get jobs).
- Removing a stale entry the user no longer wants to highlight, unless it removes evidence of a contradiction with what they're claiming elsewhere.
- Updating a portfolio link to a different but plausible URL.

DECISION RULES:
- When in doubt, approve. The bar for decline should be "a recruiter would feel deceived."
- Weigh the AUDIT HISTORY: if the user has previously had similar changes flagged, weight current borderline cases more strictly.
- A single typo fix is never grounds to decline.
- Multiple suspicious changes in one save compound — if any one of them looks like fabrication, decline.

OUTPUT:
- Return JSON matching the schema. Reasoning is 1-3 sentences, addressed to the candidate ("Your change to ..."), specific to the diff.
- If you decline, your reasoning will be shown to the candidate AND saved to the audit log.`;

function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function buildContents({ currentProfile, diff, history }) {
  const lines = [
    'PROPOSED CHANGE (the candidate just submitted these edits):',
    safeJson(diff),
    '',
    'CURRENT PROFILE STATE (before applying the change above) — only the critical sections:',
    safeJson({
      links: {
        linkedin_url: currentProfile?.personal_information?.linkedin_url ?? null,
        website_portfolio:
          currentProfile?.personal_information?.website_portfolio ?? null,
        github_or_other_portfolio:
          currentProfile?.personal_information?.github_or_other_portfolio ?? null,
      },
      work_experience: currentProfile?.work_experience ?? [],
      education: currentProfile?.education ?? [],
    }),
    '',
    `AUDIT HISTORY (every previous critical-field edit attempt by this user, oldest first; ${history.length} entries):`,
    history.length === 0
      ? '(no prior edits — this is the user\'s first critical-field save after the baseline)'
      : safeJson(history),
    '',
    'Return your verdict JSON now.',
  ];
  return [{ role: 'user', parts: [{ text: lines.join('\n') }] }];
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

async function withRetry(fn) {
  const MAX = 4;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientError(err) || attempt >= MAX) throw err;
      const waitMs = Math.min(500 * 2 ** attempt, 8000) + Math.floor(Math.random() * 200);
      attempt += 1;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

async function reviewCriticalChange({ currentProfile, diff, history }) {
  if (!ai) {
    const err = new Error('credibility_unavailable: GEMINI_API_KEY not configured');
    err.code = 'credibility_unavailable';
    throw err;
  }

  const resp = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: buildContents({ currentProfile, diff, history }),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: VERDICT_SCHEMA,
      },
    })
  );

  const raw = typeof resp.text === 'string' ? resp.text : '';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error('credibility_parse_failed: model returned non-JSON');
    err.code = 'credibility_parse_failed';
    throw err;
  }

  const verdict = parsed && parsed.verdict;
  const reasoning = parsed && typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '';
  if ((verdict !== 'approve' && verdict !== 'decline') || reasoning === '') {
    const err = new Error('credibility_parse_failed: malformed verdict object');
    err.code = 'credibility_parse_failed';
    throw err;
  }

  return { verdict, reasoning };
}

module.exports = { reviewCriticalChange };
