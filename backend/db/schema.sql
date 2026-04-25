-- Wipes and rebuilds the entire schema. Order matters for FKs.

PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS trg_user_profiles_insert_applicant_only;
DROP TRIGGER IF EXISTS trg_user_profiles_update_applicant_only;

DROP TABLE IF EXISTS negotiation_messages;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS job_postings;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  role            TEXT    NOT NULL CHECK (role IN ('Applicant', 'Recruiter')),
  worldu_id       TEXT    NOT NULL UNIQUE,
  email           TEXT    NOT NULL UNIQUE,
  username        TEXT    NOT NULL UNIQUE,
  password_hash   TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Profile data for Applicants only. Mirrors applicant.json.
-- 1:N collections (work_experience, education, skills, etc.) are JSON arrays.
CREATE TABLE user_profiles (
  user_id                       INTEGER PRIMARY KEY,

  -- personal_information
  first_name                    TEXT,
  middle_initial                TEXT,
  last_name                     TEXT,
  preferred_name                TEXT,
  pronouns                      TEXT,
  date_of_birth                 TEXT,
  phone_number                  TEXT,
  alternative_phone             TEXT,
  linkedin_url                  TEXT,
  website_portfolio             TEXT,
  github_or_other_portfolio     TEXT,

  -- address
  street_address                TEXT,
  apt_suite_unit                TEXT,
  city                          TEXT,
  state                         TEXT,
  zip_code                      TEXT,

  -- documents (JSON: { resume, writing_samples[], portfolio_work_samples[], transcripts[], certifications[], other_documents[] })
  documents_json                TEXT,

  -- 1:N collections, stored as JSON arrays following applicant.json shape
  work_experience_json          TEXT,   -- [{ job_title, company, city, state, employment_type, start_date, end_date, current_job, responsibilities, key_achievements }]
  education_json                TEXT,   -- [{ school, city, state, degree, major, minor, start_date, graduation_date, graduated, gpa, honors, relevant_coursework[] }]
  technical_skills_json         TEXT,   -- [{ skill, proficiency, years }]
  languages_json                TEXT,   -- [{ language, proficiency }]
  certifications_json           TEXT,   -- string[]
  professional_memberships_json TEXT,   -- string[]
  references_json               TEXT,   -- [{ name, relationship, company, title, phone, email }]

  -- about_me
  challenge_you_overcame        TEXT,
  greatest_strength             TEXT,
  greatest_weakness             TEXT,
  five_year_goals               TEXT,
  leadership_experience         TEXT,
  anything_else                 TEXT,

  -- legal
  us_work_authorization         INTEGER NOT NULL DEFAULT 0 CHECK (us_work_authorization IN (0, 1)),
  requires_sponsorship          INTEGER NOT NULL DEFAULT 0 CHECK (requires_sponsorship IN (0, 1)),
  visa_type                     TEXT,
  over_18                       INTEGER NOT NULL DEFAULT 0 CHECK (over_18 IN (0, 1)),
  security_clearance            TEXT,
  needs_accommodation           INTEGER NOT NULL DEFAULT 0 CHECK (needs_accommodation IN (0, 1)),

  -- eeo
  gender                        TEXT,
  race_ethnicity                TEXT,
  disability_status             TEXT,
  veteran_status                TEXT,

  updated_at                    TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_user_profiles_insert_applicant_only
BEFORE INSERT ON user_profiles
FOR EACH ROW
WHEN (SELECT role FROM users WHERE id = NEW.user_id) IS NOT 'Applicant'
BEGIN
  SELECT RAISE(ABORT, 'user_profiles.user_id must reference a user with role = Applicant');
END;

CREATE TRIGGER trg_user_profiles_update_applicant_only
BEFORE UPDATE OF user_id ON user_profiles
FOR EACH ROW
WHEN (SELECT role FROM users WHERE id = NEW.user_id) IS NOT 'Applicant'
BEGIN
  SELECT RAISE(ABORT, 'user_profiles.user_id must reference a user with role = Applicant');
END;

-- Job postings. Mirrors employer.json.
-- 1:N collections (required skills, perks, etc.) are JSON arrays.
CREATE TABLE job_postings (
  id                              INTEGER PRIMARY KEY AUTOINCREMENT,
  poster_id                       INTEGER NOT NULL,

  -- job_basics
  job_title                       TEXT    NOT NULL,
  external_job_id                 TEXT,
  department                      TEXT,
  team                            TEXT,
  reporting_to                    TEXT,
  number_of_direct_reports        INTEGER,
  employment_type                 TEXT CHECK (employment_type IN ('FullTime','PartTime','Contract','Internship','Temporary')),
  permanent_or_fixed_term         TEXT,
  contract_duration               TEXT,
  job_level                       TEXT,

  -- location
  office_locations_json           TEXT,   -- string[]
  work_model                      TEXT,
  hybrid_days_in_office           INTEGER,
  willing_to_hire_internationally INTEGER NOT NULL DEFAULT 0 CHECK (willing_to_hire_internationally IN (0, 1)),
  travel_required                 INTEGER NOT NULL DEFAULT 0 CHECK (travel_required IN (0, 1)),
  travel_percentage               TEXT,
  relocation_assistance           INTEGER NOT NULL DEFAULT 0 CHECK (relocation_assistance IN (0, 1)),

  -- compensation
  salary_min                      INTEGER,
  salary_max                      INTEGER,
  pay_frequency                   TEXT,
  currency                        TEXT DEFAULT 'USD',
  bonus_commission_structure      TEXT,
  equity_stock_options            TEXT,
  benefits_overview               TEXT,
  retirement_plan                 TEXT,
  paid_time_off_days              INTEGER,
  parental_leave_policy           TEXT,
  other_perks_json                TEXT,   -- string[]

  -- role_description
  summary                         TEXT,
  key_responsibilities_json       TEXT,   -- string[]
  why_role_is_open                TEXT,
  team_size                       INTEGER,
  team_structure                  TEXT,
  cross_functional_collaborators_json TEXT,  -- string[]

  -- requirements
  req_years_of_experience         INTEGER,
  req_education_level             TEXT,
  req_field_of_study              TEXT,
  req_certifications_json         TEXT,   -- string[]
  req_technical_skills_json       TEXT,   -- string[]
  req_languages_json              TEXT,   -- [{ language, proficiency }]
  req_work_authorization          TEXT,

  -- nice_to_haves
  nice_years_of_experience        INTEGER,
  nice_education                  TEXT,
  nice_technical_skills_json      TEXT,   -- string[]
  nice_industry_background        TEXT,

  -- company_information
  company_name                    TEXT,
  company_website                 TEXT,
  industry                        TEXT,
  company_size                    INTEGER,
  company_stage                   TEXT,
  mission_values                  TEXT,
  culture_description             TEXT,
  dei_statement                   TEXT,

  -- application_process
  application_deadline            TEXT,
  how_to_apply                    TEXT,
  documents_required_json         TEXT,   -- string[]
  interview_rounds                INTEGER,
  interview_format_json           TEXT,   -- string[]
  expected_time_to_hire           TEXT,
  contact_person                  TEXT,
  contact_email_phone             TEXT,

  -- recruiter_agent
  recruiter_system_prompt         TEXT,

  is_active                       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at                      TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (poster_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);

CREATE INDEX idx_job_postings_poster ON job_postings(poster_id);
CREATE INDEX idx_job_postings_active ON job_postings(is_active);

-- One application per (applicant, job). The status drives the applicant's
-- "My applications" page; agent_reasoning + decided_at are populated by the
-- agent negotiator when an application is auto-screened.
CREATE TABLE applications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id    INTEGER NOT NULL,
  job_posting_id  INTEGER NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending', 'Declined', 'SentToRecruiter')),
  notes           TEXT,
  agent_reasoning TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  decided_at      TEXT,
  FOREIGN KEY (applicant_id)   REFERENCES users(id)        ON DELETE CASCADE,
  FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE CASCADE,
  UNIQUE (applicant_id, job_posting_id)
);

CREATE INDEX idx_applications_applicant ON applications(applicant_id);
CREATE INDEX idx_applications_job       ON applications(job_posting_id);
CREATE INDEX idx_applications_status    ON applications(status);

-- Human conversations (unrelated to agent negotiations).
CREATE TABLE conversations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_1_id       INTEGER NOT NULL,
  user_2_id       INTEGER NOT NULL,
  job_posting_id  INTEGER,
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_1_id)      REFERENCES users(id)        ON DELETE CASCADE,
  FOREIGN KEY (user_2_id)      REFERENCES users(id)        ON DELETE CASCADE,
  FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE SET NULL,
  CHECK (user_1_id <> user_2_id)
);

CREATE INDEX idx_conversations_job_posting ON conversations(job_posting_id);

CREATE UNIQUE INDEX idx_conversations_unique_pair
  ON conversations (MIN(user_1_id, user_2_id), MAX(user_1_id, user_2_id));

CREATE TABLE messages (
  conversation_id     INTEGER NOT NULL,
  conversation_index  INTEGER NOT NULL,
  user_id             INTEGER NOT NULL,
  conversation_content TEXT   NOT NULL,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conversation_id, conversation_index),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
);

CREATE INDEX idx_messages_user ON messages(user_id);

-- The agent negotiation turns plus the verdict message, in order.
CREATE TABLE negotiation_messages (
  application_id  INTEGER NOT NULL,
  turn_index      INTEGER NOT NULL,
  sender          TEXT    NOT NULL CHECK (sender IN ('applicant_agent','recruiter_agent')),
  content         TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (application_id, turn_index),
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
