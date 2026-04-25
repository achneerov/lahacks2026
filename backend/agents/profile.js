const db = require('../db');

const JSON_PROFILE_FIELDS = [
  'documents_json',
  'work_experience_json',
  'education_json',
  'technical_skills_json',
  'languages_json',
  'certifications_json',
  'professional_memberships_json',
  'references_json',
];

const JSON_JOB_FIELDS = [
  'office_locations_json',
  'other_perks_json',
  'key_responsibilities_json',
  'cross_functional_collaborators_json',
  'req_certifications_json',
  'req_technical_skills_json',
  'req_languages_json',
  'nice_technical_skills_json',
  'documents_required_json',
  'interview_format_json',
];

function safeParse(value) {
  if (value == null || value === '') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function expandJson(row, fields) {
  if (!row) return null;
  const out = { ...row };
  for (const f of fields) {
    if (f in out) {
      const stripped = f.replace(/_json$/, '');
      out[stripped] = safeParse(out[f]);
      delete out[f];
    }
  }
  return out;
}

function getApplicantProfile(userId) {
  const user = db
    .prepare("SELECT id, role, email, username FROM users WHERE id = ? AND role = 'Applicant'")
    .get(userId);
  if (!user) return null;
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  return {
    user,
    profile: expandJson(profile, JSON_PROFILE_FIELDS),
  };
}

function getJobPosting(jobId) {
  const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(jobId);
  return expandJson(job, JSON_JOB_FIELDS);
}

module.exports = { getApplicantProfile, getJobPosting };
