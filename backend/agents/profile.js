const db = require('../db');

// JSON-encoded TEXT columns inside the relational sub-tables. These are
// parsed on the way out so prompts see real JS arrays/objects.
const JSON_DOCUMENT_FIELDS = [
  'writing_samples',
  'portfolio_work_samples',
  'transcripts',
  'certifications',
  'other_documents',
];

const JSON_EDUCATION_FIELDS = ['relevant_coursework'];

function tryParseJson(val, fallback) {
  if (val == null || val === '') return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// Returns null if the user does not exist or is not an Applicant.
// Otherwise: { user: {id, role, email, username}, profile: {...} } where
// `profile` is the full nested applicant profile, suitable to embed in a prompt.
function getApplicantProfile(userId) {
  const user = db
    .prepare(
      'SELECT id, role, email, username FROM users WHERE id = ?'
    )
    .get(userId);
  if (!user || user.role !== 'Applicant') return null;

  const personal = db
    .prepare(
      `SELECT first_name, middle_initial, last_name, preferred_name, pronouns,
              date_of_birth, phone_number, alternative_phone,
              street_address, apt_suite_unit, city, state, zip_code,
              linkedin_url, website_portfolio, github_or_other_portfolio
         FROM user_profiles WHERE user_id = ?`
    )
    .get(userId) || null;

  const documentsRaw = db
    .prepare(
      `SELECT resume, writing_samples, portfolio_work_samples, transcripts,
              certifications, other_documents
         FROM user_documents WHERE user_id = ?`
    )
    .get(userId);
  const documents = documentsRaw
    ? {
        resume: documentsRaw.resume || null,
        ...Object.fromEntries(
          JSON_DOCUMENT_FIELDS.map((f) => [f, tryParseJson(documentsRaw[f], [])])
        ),
      }
    : null;

  const work_experience = db
    .prepare(
      `SELECT job_title, company, city, state, employment_type,
              start_date, end_date, current_job, responsibilities, key_achievements
         FROM user_work_experience WHERE user_id = ? ORDER BY id`
    )
    .all(userId)
    .map((row) => ({ ...row, current_job: !!row.current_job }));

  const education = db
    .prepare(
      `SELECT school, city, state, degree, major, minor,
              start_date, graduation_date, graduated, gpa, honors, relevant_coursework
         FROM user_education WHERE user_id = ? ORDER BY id`
    )
    .all(userId)
    .map((row) => {
      const out = { ...row, graduated: !!row.graduated };
      for (const f of JSON_EDUCATION_FIELDS) {
        out[f] = tryParseJson(out[f], []);
      }
      return out;
    });

  const skills = db
    .prepare('SELECT skill, proficiency, years FROM user_skills WHERE user_id = ? ORDER BY id')
    .all(userId);

  const languages = db
    .prepare('SELECT language, proficiency FROM user_languages WHERE user_id = ? ORDER BY id')
    .all(userId);

  const references = db
    .prepare(
      `SELECT name, relationship, company, title, phone, email
         FROM user_references WHERE user_id = ? ORDER BY id`
    )
    .all(userId);

  const about_me = db
    .prepare(
      `SELECT challenge_you_overcame, greatest_strength, greatest_weakness,
              five_year_goals, leadership_experience, anything_else
         FROM user_about_me WHERE user_id = ?`
    )
    .get(userId) || null;

  const legalRaw = db
    .prepare(
      `SELECT us_work_authorization, requires_sponsorship, visa_type,
              over_18, security_clearance, needs_accommodation
         FROM user_legal WHERE user_id = ?`
    )
    .get(userId);
  const legal = legalRaw
    ? {
        us_work_authorization: !!legalRaw.us_work_authorization,
        requires_sponsorship: !!legalRaw.requires_sponsorship,
        visa_type: legalRaw.visa_type || null,
        over_18: !!legalRaw.over_18,
        security_clearance: legalRaw.security_clearance || null,
        needs_accommodation: !!legalRaw.needs_accommodation,
      }
    : null;

  const eeo = db
    .prepare(
      `SELECT gender, race_ethnicity, disability_status, veteran_status
         FROM user_eeo WHERE user_id = ?`
    )
    .get(userId) || null;

  const uploaded_documents = db
    .prepare(
      `SELECT kind, title, filename, text_content
         FROM applicant_documents WHERE user_id = ? ORDER BY created_at, id`,
    )
    .all(userId)
    .map((row) => ({
      kind: row.kind,
      title: row.title,
      filename: row.filename,
      text_content: row.text_content || null,
    }));

  return {
    user,
    profile: {
      personal_information: personal,
      documents,
      uploaded_documents,
      work_experience,
      education,
      skills,
      languages,
      references,
      about_me,
      legal,
      eeo,
    },
  };
}

// Returns the full job posting row (including the recruiter_system_prompt
// directive) plus the recruiter user record, or null if not found.
function getJobPosting(jobId) {
  const job = db
    .prepare(
      `SELECT id, poster_id, title, company, description, location, remote,
              employment_type, salary_min, salary_max, salary_currency,
              is_active, created_at, recruiter_system_prompt
         FROM job_postings WHERE id = ?`
    )
    .get(jobId);
  if (!job) return null;
  job.remote = !!job.remote;
  job.is_active = !!job.is_active;
  const recruiter = db
    .prepare('SELECT id, role, email, username FROM users WHERE id = ?')
    .get(job.poster_id) || null;
  return { ...job, recruiter };
}

module.exports = { getApplicantProfile, getJobPosting };
