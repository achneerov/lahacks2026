const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { db: existingDb, DB_PATH } = require('./db');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

const skipSeed = process.argv.includes('--no-seed');

console.log(`Resetting database at ${DB_PATH}`);

// Close the singleton and remove the file so a half-migrated or FK-tangled
// on-disk state cannot make DROP order fail or leave orphan tables.
try {
  existingDb.close();
} catch {
  /* */
}
if (fs.existsSync(DB_PATH)) {
  try {
    fs.unlinkSync(DB_PATH);
  } catch (e) {
    console.error('Could not remove existing database file:', e.message);
    process.exit(1);
  }
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(schemaSql);
console.log('Schema applied.');

if (!skipSeed) {
  db.exec(seedSql);
  console.log('Seed data inserted.');
} else {
  console.log('Skipping seed (--no-seed).');
}

db.close();
console.log('Done.');
