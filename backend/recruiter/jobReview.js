const FIELD_LABELS = {
  title: 'Title',
  company: 'Company',
  description: 'Description',
  summary: 'Summary',
  location: 'Location',
  employment_type: 'Employment type',
  salary_min: 'Minimum salary',
  salary_max: 'Maximum salary',
  salary_currency: 'Salary currency',
  job_level: 'Job level',
  work_model: 'Work model',
  key_responsibilities: 'Key responsibilities',
  req_years_of_experience: 'Required experience',
  req_technical_skills: 'Required skills',
  benefits_overview: 'Benefits',
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
      severity: 'warning',
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
      severity: 'warning',
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
    summary: clip(posting.summary || '', 1000),
    location: clip(posting.location || '', 200),
    remote: posting.remote ? true : false,
    employment_type: posting.employment_type || null,
    job_level: posting.job_level || null,
    work_model: posting.work_model || null,
    salary_min: posting.salary_min ?? null,
    salary_max: posting.salary_max ?? null,
    salary_currency: posting.salary_currency || null,
    req_years_of_experience: posting.req_years_of_experience ?? null,
    req_technical_skills: posting.req_technical_skills || null,
  };

  const sys = `You are a hiring expert reviewing a draft job posting. Only flag issues that are clearly wrong or contradictory. Do NOT nitpick.

Only flag:
- Clear contradictions between fields (e.g. title says "Senior" but job level says "Junior", or salary doesn't match seniority).
- Discriminatory or non-inclusive language.
- Obvious spelling or grammar mistakes.

Do NOT flag:
- A role having both a physical location AND being remote — that is normal (remote-friendly with an office option).
- Minor style preferences or phrasing choices.
- Missing optional information.
- Anything that is a matter of opinion rather than a factual contradiction.

Return at most 1 issue — the single most important one. If the posting looks reasonable, return zero issues.

For each issue, return one entry. Use the field name that most directly relates to the issue.

Return STRICT JSON of the form:
{"issues": [{"field": "<field>", "severity": "info|warning", "message": "<short, specific suggestion>"}]}

Allowed fields: title, company, description, summary, location, employment_type, salary_min, salary_max, salary_currency, job_level, work_model, key_responsibilities, req_years_of_experience, req_technical_skills, benefits_overview.
Severity must be either "info" (minor suggestion) or "warning" (should fix before publishing).
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
      if (severity === 'error') severity = 'warning';
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
