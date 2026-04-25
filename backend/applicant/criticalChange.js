// Critical-field change machinery for applicant profiles.
//
// "Critical" fields are the ones a candidate could lie about to misrepresent
// themselves to recruiters: their links, their work history, and their
// education. Other fields (name, address, about_me, etc.) are not gated.
//
// This module is responsible for:
//   1. Computing a structured diff between the current saved profile and the
//      sanitized payload the user just submitted.
//   2. Loading the user's audit history from profile_change_log so the
//      credibility agent can spot suspicious patterns over time.
//   3. Persisting an outcome row (approved or rejected) and, on rejection,
//      flipping the user's profile_locked flag.
//
// The actual approve/decline call lives in agents/profile-credibility.js.

const db = require('../db');

const LINK_FIELDS = ['linkedin_url', 'website_portfolio', 'github_or_other_portfolio'];

const WORK_FIELDS = [
  'job_title', 'company', 'city', 'state', 'employment_type',
  'start_date', 'end_date', 'current_job', 'responsibilities', 'key_achievements',
];

const EDU_FIELDS = [
  'school', 'city', 'state', 'degree', 'major', 'minor',
  'start_date', 'graduation_date', 'graduated', 'gpa', 'honors',
  'relevant_coursework',
];

// Normalize sentinel values to null so '', undefined, and missing keys all
// compare equal. Booleans are normalized to true/false.
function n(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return v;
}

function nBool(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'boolean') return v;
  // SQLite returns 0/1 for INTEGER booleans.
  return v === 1 || v === '1' || v === 'true';
}

function nList(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => n(x)).filter((x) => x !== null);
}

function normalizeWork(entry) {
  if (!entry || typeof entry !== 'object') return {};
  return {
    job_title: n(entry.job_title),
    company: n(entry.company),
    city: n(entry.city),
    state: n(entry.state),
    employment_type: n(entry.employment_type),
    start_date: n(entry.start_date),
    end_date: n(entry.end_date),
    current_job: nBool(entry.current_job),
    responsibilities: n(entry.responsibilities),
    key_achievements: n(entry.key_achievements),
  };
}

function normalizeEdu(entry) {
  if (!entry || typeof entry !== 'object') return {};
  return {
    school: n(entry.school),
    city: n(entry.city),
    state: n(entry.state),
    degree: n(entry.degree),
    major: n(entry.major),
    minor: n(entry.minor),
    start_date: n(entry.start_date),
    graduation_date: n(entry.graduation_date),
    graduated: nBool(entry.graduated),
    gpa: n(entry.gpa),
    honors: n(entry.honors),
    relevant_coursework: nList(entry.relevant_coursework),
  };
}

function eq(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  return false;
}

function diffEntry(beforeNorm, afterNorm, fields) {
  const fieldChanges = {};
  let any = false;
  for (const f of fields) {
    if (!eq(beforeNorm[f], afterNorm[f])) {
      fieldChanges[f] = { before: beforeNorm[f], after: afterNorm[f] };
      any = true;
    }
  }
  return any ? fieldChanges : null;
}

// Compute the structured critical-field diff. Both args are objects in the
// shape returned by loadFullProfile() and the sanitized PATCH payload
// respectively.
//
// `proposed` may omit critical sections entirely (e.g. caller only sent
// non-critical fields); in that case those sections are treated as unchanged.
//
// Returns { changes: [...] }. Empty array means no critical changes.
function computeCriticalDiff(currentProfile, proposed) {
  const changes = [];

  // Links live on personal_information in the loaded profile and at the top
  // level of the sanitized payload.
  const curLinks = currentProfile?.personal_information || {};
  for (const f of LINK_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(proposed, f)) continue;
    const before = n(curLinks[f]);
    const after = n(proposed[f]);
    if (before !== after) {
      changes.push({ op: 'modified', path: `links.${f}`, before, after });
    }
  }

  if (Array.isArray(proposed.work_experience)) {
    const beforeArr = (currentProfile?.work_experience || []).map(normalizeWork);
    const afterArr = proposed.work_experience.map(normalizeWork);
    const max = Math.max(beforeArr.length, afterArr.length);
    for (let i = 0; i < max; i++) {
      const b = beforeArr[i];
      const a = afterArr[i];
      if (b && !a) {
        changes.push({ op: 'removed', path: `work_experience[${i}]`, before: b });
      } else if (!b && a) {
        changes.push({ op: 'added', path: `work_experience[${i}]`, after: a });
      } else if (b && a) {
        const fc = diffEntry(b, a, WORK_FIELDS);
        if (fc) {
          for (const [field, ba] of Object.entries(fc)) {
            changes.push({
              op: 'modified',
              path: `work_experience[${i}].${field}`,
              before: ba.before,
              after: ba.after,
            });
          }
        }
      }
    }
  }

  if (Array.isArray(proposed.education)) {
    const beforeArr = (currentProfile?.education || []).map(normalizeEdu);
    const afterArr = proposed.education.map(normalizeEdu);
    const max = Math.max(beforeArr.length, afterArr.length);
    for (let i = 0; i < max; i++) {
      const b = beforeArr[i];
      const a = afterArr[i];
      if (b && !a) {
        changes.push({ op: 'removed', path: `education[${i}]`, before: b });
      } else if (!b && a) {
        changes.push({ op: 'added', path: `education[${i}]`, after: a });
      } else if (b && a) {
        const fc = diffEntry(b, a, EDU_FIELDS);
        if (fc) {
          for (const [field, ba] of Object.entries(fc)) {
            changes.push({
              op: 'modified',
              path: `education[${i}].${field}`,
              before: ba.before,
              after: ba.after,
            });
          }
        }
      }
    }
  }

  return { changes };
}

// Audit history shown to the credibility agent on the next review. Both
// approved and rejected attempts are included — repeated rejected attempts on
// similar fields are themselves a red flag.
//
// Most-recent first, capped at 50 entries to keep the prompt reasonable.
function loadHistory(userId) {
  const rows = db
    .prepare(
      `SELECT occurred_at, decision, diff, agent_decision, agent_reasoning
         FROM profile_change_log
        WHERE user_id = ?
        ORDER BY occurred_at DESC, id DESC
        LIMIT 50`
    )
    .all(userId);
  return rows.map((r) => ({
    occurred_at: r.occurred_at,
    decision: r.decision,
    agent_decision: r.agent_decision,
    agent_reasoning: r.agent_reasoning,
    diff: tryParseJson(r.diff, { changes: [] }),
  }));
}

function tryParseJson(s, fallback) {
  if (s == null || s === '') return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

// Record an attempted change in the audit log.
function recordAttempt({ userId, decision, diff, agentDecision, agentReasoning }) {
  db.prepare(
    `INSERT INTO profile_change_log
       (user_id, decision, diff, agent_decision, agent_reasoning)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    userId,
    decision,
    JSON.stringify(diff),
    agentDecision || null,
    agentReasoning || null,
  );
}

// Returns { locked, reason, locked_at } from the users row.
function loadLockState(userId) {
  const row = db
    .prepare(
      `SELECT profile_locked AS locked,
              profile_lock_reason AS reason,
              profile_locked_at AS locked_at
         FROM users WHERE id = ?`
    )
    .get(userId);
  if (!row) return { locked: false, reason: null, locked_at: null };
  return {
    locked: row.locked === 1,
    reason: row.reason || null,
    locked_at: row.locked_at || null,
  };
}

function lockUser(userId, reason) {
  db.prepare(
    `UPDATE users
        SET profile_locked = 1,
            profile_lock_reason = ?,
            profile_locked_at = datetime('now')
      WHERE id = ?`
  ).run(reason || 'Suspicious profile change detected.', userId);
}

// True iff the user has at least one approved or rejected entry already.
// We use this to detect "first save ever" and skip the credibility check on
// the baseline (a brand-new applicant has nothing to compare against).
function hasAnyHistory(userId) {
  const row = db
    .prepare('SELECT 1 AS x FROM profile_change_log WHERE user_id = ? LIMIT 1')
    .get(userId);
  return !!row;
}

module.exports = {
  computeCriticalDiff,
  loadHistory,
  recordAttempt,
  loadLockState,
  lockUser,
  hasAnyHistory,
};
