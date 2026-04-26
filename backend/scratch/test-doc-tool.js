// Quick offline check that the new applicant-document tool wiring is correct.
//
// Usage:
//   node scratch/test-doc-tool.js <applicantUserId>
//
// Pick a user id that has uploaded documents. To find one:
//   sqlite3 db/app.db "SELECT user_id, COUNT(*) FROM applicant_documents GROUP BY user_id;"

const db = require('../db');
const { getApplicantProfile } = require('../agents/profile');
const { applicantAgentSystemPrompt } = require('../agents/prompts');

const userId = Number(process.argv[2]);
if (!Number.isFinite(userId) || userId <= 0) {
  console.error('Usage: node scratch/test-doc-tool.js <applicantUserId>');
  process.exit(1);
}

const bundle = getApplicantProfile(userId);
if (!bundle) {
  console.error(`No applicant profile for user ${userId}`);
  process.exit(1);
}

const docs = bundle.profile.uploaded_documents || [];
console.log(`uploaded_documents (${docs.length}) seen by the prompt:`);
console.log(JSON.stringify(docs, null, 2));

const leakingTextField = docs.some((d) => 'text_content' in d);
console.log(
  leakingTextField
    ? '\nFAIL: text_content is still being shipped in the prompt bundle.'
    : '\nOK: no text_content field on uploaded_documents.'
);

const fakeJob = {
  id: 0,
  title: 'TEST',
  company: 'TEST',
  description: '',
  location: '',
  remote: false,
  employment_type: '',
  salary_min: null,
  salary_max: null,
  salary_currency: null,
  is_active: true,
  created_at: '',
  recruiter_system_prompt: '',
  recruiter: null,
};

const prompt = applicantAgentSystemPrompt({
  applicantProfile: bundle.profile,
  jobPosting: fakeJob,
});
console.log(`\napplicant system prompt size: ${prompt.length} chars`);
console.log(
  `prompt mentions "read_uploaded_document"? ${prompt.includes('read_uploaded_document')}`
);
console.log(
  `prompt still contains the literal "text_content"? ${prompt.includes('text_content')}`
);

if (docs.length === 0) {
  console.log('\n(No uploaded documents on this user — skipping tool fetch test.)');
  process.exit(0);
}

const targetFilename = docs[0].filename;
const row = db
  .prepare(
    `SELECT kind, title, filename, byte_size, text_content
       FROM applicant_documents
      WHERE user_id = ? AND filename = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1`
  )
  .get(userId, targetFilename);

console.log(`\nsimulated read_uploaded_document("${targetFilename}"):`);
if (!row) {
  console.log('  not_found');
} else if (!row.text_content) {
  console.log('  no_text (PDF parse failed at upload time)');
} else {
  console.log(`  ok — text length: ${row.text_content.length}`);
  console.log(`  preview: ${row.text_content.slice(0, 200).replace(/\s+/g, ' ')}…`);
}
