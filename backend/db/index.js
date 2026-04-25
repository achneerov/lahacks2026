const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'app.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const SEED_PATH = path.join(__dirname, 'seed.sql');

const isFresh = !fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

if (isFresh) {
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  if (fs.existsSync(SEED_PATH)) {
    db.exec(fs.readFileSync(SEED_PATH, 'utf8'));
  }
}

module.exports = db;
