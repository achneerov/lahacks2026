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

module.exports = db;
