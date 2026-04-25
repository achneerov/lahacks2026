const fs = require('fs');
const path = require('path');
const { db, DB_PATH } = require('./db');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

const skipSeed = process.argv.includes('--no-seed');

console.log(`Resetting database at ${DB_PATH}`);

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
