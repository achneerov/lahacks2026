const db = require('../db');
const { insertMessage } = require('./index');

const TERMINAL_STATUSES = new Set(['complete', 'accepted_initial']);

function negotiationToPublic(row) {
  if (!row) return null;
  let key_points = [];
  try {
    if (row.final_key_points) {
      const p = JSON.parse(row.final_key_points);
      if (Array.isArray(p)) key_points = p;
    }
  } catch {
    /* */
  }
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    status: row.status,
    initial_terms: row.initial_terms,
    applicant_counter: row.applicant_counter,
    final_terms: row.final_terms,
    final_summary: row.final_summary,
    key_points,
    error_message: row.error_message,
    recruiter_confirmed_at: row.recruiter_confirmed_at || null,
    applicant_confirmed_at: row.applicant_confirmed_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Records that the current user confirms the settled offer terms for this negotiation.
 * When both recruiter and applicant have confirmed, posts a system message.
 */
function confirmOfferTerms({ conversationId, userId, role, negotiationId }) {
  const n = Number(negotiationId);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error('invalid_negotiation_id');
    err.code = 'invalid_negotiation_id';
    err.status = 400;
    throw err;
  }

  const neg = db.prepare('SELECT * FROM offer_negotiations WHERE id = ?').get(n);
  if (!neg) {
    const err = new Error('not_found');
    err.code = 'not_found';
    err.status = 404;
    throw err;
  }
  if (neg.conversation_id !== conversationId) {
    const err = new Error('negotiation_mismatch');
    err.code = 'negotiation_mismatch';
    err.status = 400;
    throw err;
  }
  if (!TERMINAL_STATUSES.has(neg.status)) {
    const err = new Error('terms_not_final');
    err.code = 'terms_not_ready';
    err.status = 409;
    throw err;
  }
  if (neg.error_message && String(neg.error_message).trim() !== '') {
    const err = new Error('negotiation_failed');
    err.code = 'no_terms_to_confirm';
    err.status = 409;
    throw err;
  }

  const isRecruiter = role === 'Recruiter';
  const isApplicant = role === 'Applicant';
  if (!isRecruiter && !isApplicant) {
    const err = new Error('invalid_role');
    err.code = 'invalid_role';
    err.status = 400;
    throw err;
  }
  if (isRecruiter && userId !== neg.recruiter_user_id) {
    const err = new Error('forbidden');
    err.code = 'forbidden';
    err.status = 403;
    throw err;
  }
  if (isApplicant && userId !== neg.applicant_user_id) {
    const err = new Error('forbidden');
    err.code = 'forbidden';
    err.status = 403;
    throw err;
  }

  const col = isRecruiter ? 'recruiter_confirmed_at' : 'applicant_confirmed_at';
  const prior = db
    .prepare(`SELECT ${col} AS t FROM offer_negotiations WHERE id = ?`)
    .get(n);
  if (prior && prior.t) {
    const row = db.prepare('SELECT * FROM offer_negotiations WHERE id = ?').get(n);
    return {
      ok: true,
      already: true,
      both_confirmed: !!(row.recruiter_confirmed_at && row.applicant_confirmed_at),
      negotiation: negotiationToPublic(row),
      system_message: null,
    };
  }

  db.prepare(
    `UPDATE offer_negotiations SET ${col} = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
  ).run(n);

  const updated = db.prepare('SELECT * FROM offer_negotiations WHERE id = ?').get(n);
  let systemMessage = null;

  if (updated.recruiter_confirmed_at && updated.applicant_confirmed_at) {
    const inserted = insertMessage({
      conversationId,
      userId: neg.recruiter_user_id,
      content:
        'Both parties have confirmed agreement to the offer terms shown above in this thread. This in-app confirmation does not replace a formal signed offer or employment contract.',
      kind: 'system',
      metadata: { offer_mutual_confirm: true, negotiation_id: n },
    });
    let meta = null;
    try {
      meta = inserted.metadata ? JSON.parse(inserted.metadata) : null;
    } catch {
      meta = null;
    }
    systemMessage = {
      index: inserted.msg_index,
      user_id: inserted.user_id,
      content: inserted.content,
      kind: inserted.kind || 'system',
      metadata: meta,
      created_at: inserted.created_at,
      from_me: inserted.user_id === userId,
    };
  }

  return {
    ok: true,
    already: false,
    both_confirmed: !!(updated.recruiter_confirmed_at && updated.applicant_confirmed_at),
    negotiation: negotiationToPublic(updated),
    system_message: systemMessage,
  };
}

module.exports = { confirmOfferTerms, negotiationToPublic };
