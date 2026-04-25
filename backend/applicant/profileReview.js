const SENSITIVE_FIELDS = new Set([
  'first_name',
  'last_name',
]);

const FIELD_LABELS = {
  first_name: 'First name',
  middle_initial: 'Middle initial',
  last_name: 'Last name',
  preferred_name: 'Preferred name',
  pronouns: 'Pronouns',
  date_of_birth: 'Date of birth',
  phone_number: 'Phone number',
  alternative_phone: 'Alternative phone',
  street_address: 'Street address',
  apt_suite_unit: 'Apt / Suite / Unit',
  city: 'City',
  state: 'State',
  zip_code: 'ZIP code',
  linkedin_url: 'LinkedIn URL',
  website_portfolio: 'Website / Portfolio',
  github_or_other_portfolio: 'GitHub / Other portfolio',
};

const TICKET_MESSAGE =
  "We're not sure you should be editing this — please open a ticket to edit this field.";

function normalizeName(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ');
}

function nameTokens(s) {
  return new Set(normalizeName(s).split(' ').filter(Boolean));
}

function tokenOverlap(a, b) {
  const A = nameTokens(a);
  const B = nameTokens(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared += 1;
  return shared / Math.max(A.size, B.size);
}

function heuristicReview(currentProfile, proposed) {
  const warnings = {};
  const current = currentProfile?.personal_information || currentProfile || {};

  for (const [field, newValueRaw] of Object.entries(proposed)) {
    if (!SENSITIVE_FIELDS.has(field)) continue;

    const oldValue = current[field] ?? null;
    const newValue =
      newValueRaw === '' || newValueRaw === undefined ? null : newValueRaw;

    if (oldValue === newValue) continue;

    if (field === 'first_name' || field === 'last_name') {
      if (oldValue && newValue) {
        const overlap = tokenOverlap(oldValue, newValue);
        if (overlap < 0.5) {
          warnings[field] = TICKET_MESSAGE;
        }
      }
      continue;
    }
  }

  return warnings;
}

async function llmReview(currentProfile, proposed) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const current = currentProfile?.personal_information || currentProfile || {};
  const changes = [];
  for (const [field, newValueRaw] of Object.entries(proposed)) {
    if (typeof newValueRaw === 'object') continue; // skip sub-sections for LLM review
    const oldValue = current[field] ?? null;
    const newValue =
      newValueRaw === '' || newValueRaw === undefined ? null : newValueRaw;
    if (oldValue === newValue) continue;
    changes.push({
      field,
      label: FIELD_LABELS[field] || field,
      old_value: oldValue,
      new_value: newValue,
    });
  }
  if (changes.length === 0) return {};

  const sys = `You are reviewing a job applicant profile edit. For each field change, decide whether the change looks suspicious enough that the applicant probably should NOT be editing it themselves and should instead open a support ticket.

A change is suspicious if it looks like the applicant is rewriting an immutable identity / credential fact (e.g. legal name swapped to a different person).

A change is NOT suspicious if it is a typo fix, formatting tweak, capitalization fix, expansion of an abbreviation, completing a previously empty value, or a routine update (new phone, new address).

Return STRICT JSON of the form:
{"warnings": {"<field>": "We're not sure you should be editing this — please open a ticket to edit this field."}}
Only include fields you want to flag. If nothing is suspicious, return {"warnings": {}}.`;

  const prompt = `Changes:\n${JSON.stringify(changes, null, 2)}`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn('[profileReview] gemini http', res.status);
      return null;
    }
    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    const parsed = JSON.parse(text);
    const raw = parsed?.warnings;
    if (!raw || typeof raw !== 'object') return {};
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string' && v.trim()) {
        out[k] = TICKET_MESSAGE;
      }
    }
    return out;
  } catch (e) {
    console.warn('[profileReview] gemini failed:', e.message);
    return null;
  }
}

async function reviewProfileChanges(currentProfile, proposed) {
  const llm = await llmReview(currentProfile, proposed);
  if (llm) {
    return { warnings: llm, source: 'llm' };
  }
  return { warnings: heuristicReview(currentProfile, proposed), source: 'heuristic' };
}

module.exports = {
  reviewProfileChanges,
  TICKET_MESSAGE,
  FIELD_LABELS,
  SENSITIVE_FIELDS: [...SENSITIVE_FIELDS],
};
