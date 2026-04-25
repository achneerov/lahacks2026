const db = require('../db');

const ALLOWED_KINDS = new Set([
  'text',
  'interview_request',
  'availability_proposal',
  'calendar_invite',
  'system',
]);

// Insert a message with optional kind/metadata. Returns the row in the same
// shape the API returns (without from_me — caller decides perspective).
function insertMessage({ conversationId, userId, content, kind = 'text', metadata = null }) {
  if (!ALLOWED_KINDS.has(kind)) {
    const err = new Error(`unknown message kind: ${kind}`);
    err.code = 'invalid_kind';
    throw err;
  }
  const metadataJson =
    metadata === null || metadata === undefined ? null : JSON.stringify(metadata);

  return db.transaction(() => {
    const { next_index } = db
      .prepare(
        `SELECT COALESCE(MAX(conversation_index) + 1, 0) AS next_index
           FROM messages
          WHERE conversation_id = ?`
      )
      .get(conversationId);

    db.prepare(
      `INSERT INTO messages
         (conversation_id, conversation_index, user_id, conversation_content, kind, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(conversationId, next_index, userId, content, kind, metadataJson);

    return db
      .prepare(
        `SELECT conversation_index AS msg_index,
                user_id            AS user_id,
                conversation_content AS content,
                kind               AS kind,
                metadata           AS metadata,
                created_at         AS created_at
           FROM messages
          WHERE conversation_id = ? AND conversation_index = ?`
      )
      .get(conversationId, next_index);
  })();
}

// Find or create the canonical recruiter<->applicant conversation for a job.
// We use the existing unique-pair index, so a recruiter who already chatted
// with this applicant about another job will reuse the same row only if the
// pair index allows; the schema allows multiple per pair if job differs in
// some setups, but the unique pair index says one per pair regardless of job.
// For the demo we accept that limitation: one conversation per recruiter ↔
// applicant pair, with job_posting_id set to the most recent job.
function findOrCreateConversation({ recruiterId, applicantId, jobPostingId }) {
  const a = Math.min(recruiterId, applicantId);
  const b = Math.max(recruiterId, applicantId);

  const existing = db
    .prepare(
      `SELECT * FROM conversations
        WHERE (user_1_id = ? AND user_2_id = ?)
           OR (user_1_id = ? AND user_2_id = ?)
        ORDER BY created_at DESC LIMIT 1`
    )
    .get(a, b, b, a);

  if (existing) {
    if (existing.job_posting_id !== jobPostingId && jobPostingId != null) {
      db.prepare(
        `UPDATE conversations SET job_posting_id = ? WHERE id = ?`
      ).run(jobPostingId, existing.id);
    }
    if (existing.active === 0) {
      db.prepare(
        `UPDATE conversations SET active = 1, closed_at = NULL, closure_responses = NULL WHERE id = ?`
      ).run(existing.id);
    }
    return { id: existing.id, created: false };
  }

  const info = db
    .prepare(
      `INSERT INTO conversations (user_1_id, user_2_id, job_posting_id, active)
       VALUES (?, ?, ?, 1)`
    )
    .run(a, b, jobPostingId ?? null);
  return { id: info.lastInsertRowid, created: true };
}

function setInterviewStatus(conversationId, status) {
  db.prepare(
    `UPDATE conversations SET interview_status = ? WHERE id = ?`
  ).run(status, conversationId);
}

// Build a Google Calendar deep link with prefilled event details so the
// recipient can save the invite to their own calendar in one click.
function googleCalendarUrl({ title, description, startIso, endIso, location }) {
  const fmt = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.valueOf())) return '';
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Interview',
    dates: `${fmt(startIso)}/${fmt(endIso)}`,
  });
  if (description) params.set('details', description);
  if (location) params.set('location', location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Recompute trust score from closure feedback records. Each closure has
// per-question scores (1..5); we average them, normalize to 0..100, and blend
// with the user's prior score so a single bad/great interview can't whiplash.
function recomputeTrustScore(userId) {
  const closures = db
    .prepare(
      `SELECT closure_responses FROM conversations
        WHERE active = 0 AND closure_responses IS NOT NULL
          AND (user_1_id = ? OR user_2_id = ?)`
    )
    .all(userId, userId);

  if (closures.length === 0) return null;

  let totalScore = 0;
  let totalWeight = 0;
  for (const row of closures) {
    let parsed;
    try {
      parsed = JSON.parse(row.closure_responses);
    } catch {
      continue;
    }
    if (!parsed || !Array.isArray(parsed.responses)) continue;
    for (const r of parsed.responses) {
      const n = Number(r?.score);
      if (!Number.isFinite(n)) continue;
      totalScore += n;
      totalWeight += 1;
    }
  }

  if (totalWeight === 0) return null;
  const avg = totalScore / totalWeight; // 1..5 typically
  // Map 1..5 to 30..100. 5 = 100, 3 = 65, 1 = 30.
  const mapped = Math.round(30 + ((avg - 1) / 4) * 70);
  const clamped = Math.max(0, Math.min(100, mapped));
  db.prepare('UPDATE users SET trust_score = ? WHERE id = ?').run(clamped, userId);
  return clamped;
}

module.exports = {
  ALLOWED_KINDS,
  insertMessage,
  findOrCreateConversation,
  setInterviewStatus,
  googleCalendarUrl,
  recomputeTrustScore,
};
