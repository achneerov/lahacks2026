-- Wipes and rebuilds the entire schema. Order matters for FKs.

PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS trg_user_profiles_insert_applicant_only;
DROP TRIGGER IF EXISTS trg_user_profiles_update_applicant_only;

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS negotiation_messages;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS job_postings;
DROP TABLE IF EXISTS profile_change_log;
DROP TABLE IF EXISTS user_eeo;
DROP TABLE IF EXISTS user_legal;
DROP TABLE IF EXISTS user_about_me;
DROP TABLE IF EXISTS user_references;
DROP TABLE IF EXISTS user_languages;
DROP TABLE IF EXISTS user_skills;
DROP TABLE IF EXISTS user_education;
DROP TABLE IF EXISTS user_work_experience;
DROP TABLE IF EXISTS user_documents;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  role                 TEXT    NOT NULL CHECK (role IN ('Applicant', 'Recruiter', 'Agent')),
  worldu_id            TEXT    NOT NULL UNIQUE,
  email                TEXT    NOT NULL UNIQUE,
  username             TEXT    NOT NULL UNIQUE,
  password_hash        TEXT    NOT NULL,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  -- Set to 1 when the credibility agent rejects a critical-field change.
  -- While locked, further critical-field saves are refused at the API layer.
  -- Non-critical fields (name, address, about_me, etc.) remain editable.
  profile_locked       INTEGER NOT NULL DEFAULT 0 CHECK (profile_locked IN (0, 1)),
  profile_lock_reason  TEXT,
  profile_locked_at    TEXT
);

-- Personal info & address for Applicants only
CREATE TABLE user_profiles (
  user_id           INTEGER PRIMARY KEY,
  first_name        TEXT,
  middle_initial    TEXT,
  last_name         TEXT,
  preferred_name    TEXT,
  pronouns          TEXT,
  date_of_birth     TEXT,
  phone_number      TEXT,
  alternative_phone TEXT,
  street_address    TEXT,
  apt_suite_unit    TEXT,
  city              TEXT,
  state             TEXT,
  zip_code          TEXT,
  linkedin_url      TEXT,
  website_portfolio TEXT,
  github_or_other_portfolio TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
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

-- Documents (resume URL, writing samples, etc.)
CREATE TABLE user_documents (
  user_id           INTEGER PRIMARY KEY,
  resume            TEXT,
  writing_samples   TEXT, -- JSON array of URLs
  portfolio_work_samples TEXT, -- JSON array of URLs
  transcripts       TEXT, -- JSON array of URLs
  certifications    TEXT, -- JSON array of URLs
  other_documents   TEXT, -- JSON array of URLs
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Work experience (repeatable)
CREATE TABLE user_work_experience (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  job_title       TEXT,
  company         TEXT,
  city            TEXT,
  state           TEXT,
  employment_type TEXT,
  start_date      TEXT,
  end_date        TEXT,
  current_job     INTEGER NOT NULL DEFAULT 0 CHECK (current_job IN (0, 1)),
  responsibilities TEXT,
  key_achievements TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_work_experience_user ON user_work_experience(user_id);

-- Education (repeatable)
CREATE TABLE user_education (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  school          TEXT,
  city            TEXT,
  state           TEXT,
  degree          TEXT,
  major           TEXT,
  minor           TEXT,
  start_date      TEXT,
  graduation_date TEXT,
  graduated       INTEGER NOT NULL DEFAULT 0 CHECK (graduated IN (0, 1)),
  gpa             TEXT,
  honors          TEXT,
  relevant_coursework TEXT, -- JSON array of strings
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_education_user ON user_education(user_id);

-- Skills (repeatable)
CREATE TABLE user_skills (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  skill           TEXT NOT NULL,
  proficiency     TEXT,
  years           INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_skills_user ON user_skills(user_id);

-- Languages (repeatable)
CREATE TABLE user_languages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  language        TEXT NOT NULL,
  proficiency     TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_languages_user ON user_languages(user_id);

-- References (repeatable)
CREATE TABLE user_references (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  name            TEXT,
  relationship    TEXT,
  company         TEXT,
  title           TEXT,
  phone           TEXT,
  email           TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_references_user ON user_references(user_id);

-- About me (one-to-one)
CREATE TABLE user_about_me (
  user_id                INTEGER PRIMARY KEY,
  challenge_you_overcame TEXT,
  greatest_strength      TEXT,
  greatest_weakness      TEXT,
  five_year_goals        TEXT,
  leadership_experience  TEXT,
  anything_else          TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Legal eligibility (one-to-one)
CREATE TABLE user_legal (
  user_id                INTEGER PRIMARY KEY,
  us_work_authorization  INTEGER NOT NULL DEFAULT 0 CHECK (us_work_authorization IN (0, 1)),
  requires_sponsorship   INTEGER NOT NULL DEFAULT 0 CHECK (requires_sponsorship IN (0, 1)),
  visa_type              TEXT,
  over_18                INTEGER NOT NULL DEFAULT 0 CHECK (over_18 IN (0, 1)),
  security_clearance     TEXT,
  needs_accommodation    INTEGER NOT NULL DEFAULT 0 CHECK (needs_accommodation IN (0, 1)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- EEO voluntary disclosures (one-to-one)
CREATE TABLE user_eeo (
  user_id           INTEGER PRIMARY KEY,
  gender            TEXT,
  race_ethnicity    TEXT,
  disability_status TEXT,
  veteran_status    TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Job postings
CREATE TABLE job_postings (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  poster_id             INTEGER NOT NULL,
  is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),

  -- Job basics
  title                 TEXT    NOT NULL,
  job_id_requisition    TEXT,
  department            TEXT,
  team                  TEXT,
  reporting_to          TEXT,
  number_of_direct_reports INTEGER,
  employment_type       TEXT CHECK (employment_type IN ('FullTime','PartTime','Contract','Internship','Temporary')),
  permanent_or_fixed_term TEXT,
  contract_duration     TEXT,
  job_level             TEXT,

  -- Location
  office_locations      TEXT, -- JSON array of strings
  work_model            TEXT, -- remote / hybrid / on-site
  hybrid_days_in_office INTEGER,
  willing_to_hire_internationally INTEGER DEFAULT 0 CHECK (willing_to_hire_internationally IN (0, 1)),
  travel_required       INTEGER DEFAULT 0 CHECK (travel_required IN (0, 1)),
  travel_percentage     TEXT,
  relocation_assistance INTEGER DEFAULT 0 CHECK (relocation_assistance IN (0, 1)),

  -- Compensation
  salary_min            INTEGER,
  salary_max            INTEGER,
  pay_frequency         TEXT,
  salary_currency       TEXT DEFAULT 'USD',
  bonus_commission_structure TEXT,
  equity_stock_options  TEXT,
  benefits_overview     TEXT,
  retirement_plan       TEXT,
  paid_time_off_days    INTEGER,
  parental_leave_policy TEXT,
  other_perks           TEXT, -- JSON array of strings

  -- Role description
  summary               TEXT,
  key_responsibilities  TEXT, -- JSON array of strings
  why_role_is_open      TEXT,
  team_size             INTEGER,
  team_structure        TEXT,
  cross_functional_collaborators TEXT, -- JSON array of strings

  -- Requirements
  req_years_of_experience INTEGER,
  req_education_level   TEXT,
  req_field_of_study    TEXT,
  req_certifications    TEXT, -- JSON array of strings
  req_technical_skills  TEXT, -- JSON array of strings
  req_languages         TEXT, -- JSON array of {language, proficiency}
  req_work_authorization TEXT,

  -- Nice to haves
  nice_years_of_experience INTEGER,
  nice_education        TEXT,
  nice_technical_skills TEXT, -- JSON array of strings
  nice_industry_background TEXT,

  -- Company information
  company               TEXT,
  company_website       TEXT,
  industry              TEXT,
  company_size          INTEGER,
  company_stage         TEXT,
  mission_values        TEXT,
  culture_description   TEXT,
  dei_statement         TEXT,

  -- Application process
  application_deadline  TEXT,
  how_to_apply          TEXT,
  documents_required    TEXT, -- JSON array of strings
  interview_rounds      INTEGER,
  interview_format      TEXT, -- JSON array of strings
  expected_time_to_hire TEXT,
  contact_person        TEXT,
  contact_email_phone   TEXT,

  -- Legacy / internal
  description           TEXT,
  location              TEXT,
  remote                INTEGER NOT NULL DEFAULT 0 CHECK (remote IN (0, 1)),
  recruiter_system_prompt TEXT,

  FOREIGN KEY (poster_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);

CREATE INDEX idx_job_postings_poster ON job_postings(poster_id);
CREATE INDEX idx_job_postings_active ON job_postings(is_active);

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

-- Append-only transcript for the applicant_agent <-> recruiter_agent negotiation.
-- One row per turn (turn_index 0..13, applicant on even, recruiter on odd).
CREATE TABLE negotiation_messages (
  application_id  INTEGER NOT NULL,
  turn_index      INTEGER NOT NULL,
  sender          TEXT    NOT NULL CHECK (sender IN ('applicant_agent','recruiter_agent')),
  content         TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (application_id, turn_index),
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE INDEX idx_negotiation_messages_app ON negotiation_messages(application_id);

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

-- Append-only audit log of every attempted critical-field profile change.
-- "Critical" = links (linkedin_url, website_portfolio, github_or_other_portfolio),
-- any field inside work_experience, any field inside education.
--
-- Approved entries form the history shown to the credibility agent on the next
-- review. Rejected entries are also persisted so a human reviewer can later see
-- exactly what the user tried.
--
-- agent_decision is NULL for the system-approved baseline row inserted on first
-- save (so the agent isn't run against an empty profile).
CREATE TABLE profile_change_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  occurred_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  decision        TEXT    NOT NULL CHECK (decision IN ('approved', 'rejected')),
  diff            TEXT    NOT NULL, -- JSON: { changes: [ { op, path, before, after } ] }
  agent_decision  TEXT             CHECK (agent_decision IN ('approve', 'decline')),
  agent_reasoning TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_change_log_user ON profile_change_log(user_id, occurred_at);
