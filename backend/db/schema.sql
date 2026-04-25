-- Wipes and rebuilds the entire schema. Order matters for FKs.

PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS trg_user_profiles_insert_applicant_only;
DROP TRIGGER IF EXISTS trg_user_profiles_update_applicant_only;

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS job_postings;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  role            TEXT    NOT NULL CHECK (role IN ('Applicant', 'Recruiter', 'Agent')),
  worldu_id       TEXT    UNIQUE,
  email           TEXT    NOT NULL UNIQUE,
  username        TEXT    NOT NULL UNIQUE,
  password_hash   TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Profile data for Applicants only. Enforced via triggers below.
CREATE TABLE user_profiles (
  user_id         INTEGER PRIMARY KEY,
  full_name       TEXT,
  phone           TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  state           TEXT,
  postal_code     TEXT,
  country         TEXT,
  headline        TEXT,
  bio             TEXT,
  resume_url      TEXT,
  linkedin_url    TEXT,
  github_url      TEXT,
  portfolio_url   TEXT,
  years_experience INTEGER,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
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

CREATE TABLE job_postings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  poster_id       INTEGER NOT NULL,
  title           TEXT    NOT NULL,
  company         TEXT,
  description     TEXT,
  location        TEXT,
  remote          INTEGER NOT NULL DEFAULT 0 CHECK (remote IN (0, 1)),
  employment_type TEXT CHECK (employment_type IN ('FullTime','PartTime','Contract','Internship','Temporary')),
  salary_min      INTEGER,
  salary_max      INTEGER,
  salary_currency TEXT    DEFAULT 'USD',
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (poster_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);

CREATE INDEX idx_job_postings_poster ON job_postings(poster_id);
CREATE INDEX idx_job_postings_active ON job_postings(is_active);

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

-- Prevent duplicate conversations between the same pair, regardless of order.
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
