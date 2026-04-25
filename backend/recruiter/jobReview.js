const FIELD_LABELS = {
  title: 'Title',
  company: 'Company',
  description: 'Description',
  location: 'Location',
  employment_type: 'Employment type',
  salary_min: 'Minimum salary',
  salary_max: 'Maximum salary',
  salary_currency: 'Salary currency',
};

const SEVERITIES = new Set(['info', 'warning', 'error']);

function clip(s, max = 4000) {
  if (typeof s !== 'string') return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function heuristicReview(posting) {
  const issues = [];
  const title = (posting.title || '').trim();
  const description = (posting.description || '').trim();
  const company = (posting.company || '').trim();
  const location = (posting.location || '').trim();

  if (title.length < 4) {
    issues.push({
      field: 'title',
      severity: 'error',
      message: 'Title is very short — give a clear role name (e.g. "Senior Backend Engineer").',
    });
  }

  if (!description) {
    issues.push({
      field: 'description',
      severity: 'warning',
      message: 'Description is empty. Candidates will not know what the role involves.',
    });
  } else {
    if (description.length < 80) {
      issues.push({
        field: 'description',
        severity: 'warning',
        message: 'Description is quite vague — add responsibilities, tech stack, and what success looks like.',
      });
    }
    if (!/[A-Z]/.test(description)) {
      issues.push({
        field: 'description',
        severity: 'info',
        message: 'Description has no capital letters; consider proofreading.',
      });
    }
  }

  if (!company) {
    issues.push({
      field: 'company',
      severity: 'info',
      message: 'No company set — applicants prefer to know who they are applying to.',
    });
  }

  if (!location && posting.remote !== 1) {
    issues.push({
      field: 'location',
      severity: 'info',
      message: 'Location is empty and the role is not marked remote.',
    });
  }

  if (
    posting.salary_min != null &&
    posting.salary_max != null &&
    Number(posting.salary_min) > Number(posting.salary_max)
  ) {
    issues.push({
      field: 'salary_max',
      severity: 'error',
      message: 'Maximum salary is lower than the minimum.',
    });
  }

  return issues;
}

async function llmReview(posting) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const safe = {
    title: clip(posting.title || '', 200),
    company: clip(posting.company || '', 200),
    description: clip(posting.description || '', 4000),
    location: clip(posting.location || '', 200),
    remote: posting.remote ? true : false,
    employment_type: posting.employment_type || null,
    salary_min: posting.salary_min ?? null,
    salary_max: posting.salary_max ?? null,
    salary_currency: posting.salary_currency || null,
  };

  const sys = `You are a hiring expert reviewing a draft job posting. Identify specific, actionable issues with the posting that the recruiter should fix before publishing.

Look for:
- Vague or generic phrasing ("rockstar", "ninja", "fast-paced") that doesn't convey real expectations.
- Questions or descriptions that are unclear, ambiguous, or could be improved.
- Spelling or grammar mistakes (typos).
- Missing critical info (responsibilities, requirements, what success looks like).
- Inconsistencies (e.g. salary range that doesn't make sense, location vs remote mismatch).
- Discriminatory or non-inclusive language.

For each issue, return one entry. Use the field name that most directly relates to the issue.

Return STRICT JSON of the form:
{"issues": [{"field": "<field>", "severity": "info|warning|error", "message": "<short, specific suggestion>"}]}

Allowed fields: title, company, description, location, employment_type, salary_min, salary_max, salary_currency.
If the posting looks good, return {"issues": []}. Keep messages concise (under 160 chars).`;

  const prompt = `Job posting draft:\n${JSON.stringify(safe, null, 2)}`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
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
      console.warn('[jobReview] gemini http', res.status);
      return null;
    }
    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    const parsed = JSON.parse(text);
    const raw = parsed?.issues;
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const field = typeof item.field === 'string' && FIELD_LABELS[item.field] ? item.field : null;
      const message = typeof item.message === 'string' ? item.message.trim() : '';
      let severity = typeof item.severity === 'string' ? item.severity.toLowerCase() : 'info';
      if (!SEVERITIES.has(severity)) severity = 'info';
      if (!field || !message) continue;
      out.push({ field, severity, message: message.slice(0, 240) });
    }
    return out;
  } catch (e) {
    console.warn('[jobReview] gemini failed:', e.message);
    return null;
  }
}

async function reviewJobPosting(posting) {
  const llm = await llmReview(posting);
  if (llm) {
    return { issues: llm, source: 'llm' };
  }
  return { issues: heuristicReview(posting), source: 'heuristic' };
}

module.exports = {
  reviewJobPosting,
  FIELD_LABELS,
};
