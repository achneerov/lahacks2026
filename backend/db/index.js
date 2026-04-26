const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'app.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const isFresh = !fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

if (isFresh) {
  // Schema only. Sample data is inserted by `node db/reset.js` (see npm run db:reset).
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

function ensureColumn(table, column, sqlTypeAndDefault) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlTypeAndDefault}`);
  }
}

// Back-compat columns for interview invite identity-gating flow.
ensureColumn(
  'conversations',
  'invite_requires_identity',
  'INTEGER NOT NULL DEFAULT 0 CHECK (invite_requires_identity IN (0, 1))',
);
ensureColumn('conversations', 'invite_identity_verified_at', 'TEXT');
ensureColumn('conversations', 'invite_identity_verified_by_user_id', 'INTEGER');

// Relax CHECK on messages.kind (older DBs only allow 5 text kinds) so we can add
// offer_proposal / offer_settled and future card kinds without another migration.
function migrateMessagesKindConstraint() {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'messages'")
    .get();
  if (!row || typeof row.sql !== 'string' || !row.sql.includes('CHECK (kind IN')) {
    return;
  }
  db.exec(`
    CREATE TABLE messages__new (
      conversation_id     INTEGER NOT NULL,
      conversation_index  INTEGER NOT NULL,
      user_id             INTEGER NOT NULL,
      conversation_content TEXT   NOT NULL,
      kind                TEXT     NOT NULL DEFAULT 'text',
      metadata            TEXT,
      created_at          TEXT     NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (conversation_id, conversation_index),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
    );
    INSERT INTO messages__new
      (conversation_id, conversation_index, user_id, conversation_content, kind, metadata, created_at)
    SELECT
      conversation_id, conversation_index, user_id, conversation_content, kind, metadata, created_at
    FROM messages;
    DROP TABLE messages;
    ALTER TABLE messages__new RENAME TO messages;
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
  `);
}
migrateMessagesKindConstraint();

db.exec(`
  CREATE TABLE IF NOT EXISTS offer_negotiations (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id   INTEGER NOT NULL,
    job_posting_id     INTEGER,
    recruiter_user_id INTEGER NOT NULL,
    applicant_user_id INTEGER NOT NULL,
    initial_terms     TEXT    NOT NULL,
    applicant_counter   TEXT,
    status             TEXT    NOT NULL
      CHECK (status IN (
        'awaiting_applicant',
        'running',
        'complete',
        'accepted_initial'
      )),
    final_terms        TEXT,
    final_summary      TEXT,
    final_key_points   TEXT,
    error_message      TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id)  REFERENCES conversations(id)  ON DELETE CASCADE,
    FOREIGN KEY (job_posting_id)  REFERENCES job_postings(id)    ON DELETE SET NULL,
    FOREIGN KEY (recruiter_user_id) REFERENCES users(id)         ON DELETE CASCADE,
    FOREIGN KEY (applicant_user_id) REFERENCES users(id)         ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_offer_negotiations_conversation
    ON offer_negotiations(conversation_id, status);
`);

ensureColumn('offer_negotiations', 'recruiter_confirmed_at', 'TEXT');
ensureColumn('offer_negotiations', 'applicant_confirmed_at', 'TEXT');
ensureColumn('offer_negotiations', 'intervention_topics', 'TEXT');

db.exec(`
  CREATE TABLE IF NOT EXISTS offer_negotiation_messages (
    offer_negotiation_id  INTEGER NOT NULL,
    turn_index            INTEGER NOT NULL,
    sender                TEXT    NOT NULL
      CHECK (sender IN ('applicant_agent', 'recruiter_agent')),
    content               TEXT    NOT NULL,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (offer_negotiation_id, turn_index),
    FOREIGN KEY (offer_negotiation_id) REFERENCES offer_negotiations(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_offer_neg_msgs_neg
    ON offer_negotiation_messages(offer_negotiation_id, turn_index);
`);

module.exports = db;
