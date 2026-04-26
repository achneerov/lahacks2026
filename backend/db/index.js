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

module.exports = db;
