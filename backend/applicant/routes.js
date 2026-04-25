const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');
const { reviewProfileChanges } = require('./profileReview');

const router = express.Router();

const PROFILE_FIELDS = [
  'first_name',
  'middle_initial',
  'last_name',
  'preferred_name',
  'phone_number',
  'street_address',
  'apt_suite_unit',
  'city',
  'state',
  'zip_code',
  'linkedin_url',
  'website_portfolio',
  'github_or_other_portfolio',
  'challenge_you_overcame',
  'greatest_strength',
  'greatest_weakness',
  'five_year_goals',
  'leadership_experience',
  'anything_else',
];

// Subset of PROFILE_FIELDS that count toward the "completeness" score on
// the applicant home dashboard.
const PROFILE_COMPLETENESS_FIELDS = [
  'first_name',
  'last_name',
  'phone_number',
  'street_address',
  'city',
  'state',
  'zip_code',
  'linkedin_url',
  'website_portfolio',
  'github_or_other_portfolio',
  'challenge_you_overcame',
  'greatest_strength',
];

const PROFILE_TEXT_FIELDS = [
  'first_name',
  'middle_initial',
  'last_name',
  'preferred_name',
  'phone_number',
  'street_address',
  'apt_suite_unit',
  'city',
  'state',
  'zip_code',
  'challenge_you_overcame',
  'greatest_strength',
  'greatest_weakness',
  'five_year_goals',
  'leadership_experience',
  'anything_else',
];

const PROFILE_URL_FIELDS = [
  'linkedin_url',
  'website_portfolio',
  'github_or_other_portfolio',
];

const URL_RE = /^https?:\/\/[^\s]+$/i;

function sanitizeProfileUpdate(raw) {
  if (!raw || typeof raw !== 'object') {
    const err = new Error('profile body must be an object');
    err.code = 'invalid_profile';
    throw err;
  }

  const out = {};

  for (const key of PROFILE_TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const v = raw[key];
    if (v === null || v === undefined) {
      out[key] = null;
      continue;
    }
    if (typeof v !== 'string') {
      const err = new Error(`profile.${key} must be a string`);
      err.code = 'invalid_profile';
      throw err;
    }
    const trimmed = v.trim();
    out[key] = trimmed === '' ? null : trimmed;
  }

  for (const key of PROFILE_URL_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const v = raw[key];
    if (v === null || v === undefined) {
      out[key] = null;
      continue;
    }
    if (typeof v !== 'string') {
      const err = new Error(`profile.${key} must be a string`);
      err.code = 'invalid_profile';
      throw err;
    }
    const trimmed = v.trim();
    if (trimmed === '') {
      out[key] = null;
      continue;
    }
    if (!URL_RE.test(trimmed)) {
      const err = new Error(`profile.${key} must be an http(s) URL`);
      err.code = 'invalid_profile_url';
      throw err;
    }
    out[key] = trimmed;
  }

  return out;
}

function loadProfileRow(userId) {
  return db
    .prepare(`SELECT ${PROFILE_FIELDS.join(', ')}, updated_at FROM user_profiles WHERE user_id = ?`)
    .get(userId);
}

function ensureProfileRow(userId) {
  const existing = db
    .prepare('SELECT 1 FROM user_profiles WHERE user_id = ?')
    .get(userId);
  if (existing) return;
  db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(userId);
}

function requireApplicant(req, res, next) {
  if (!req.user || req.user.role !== 'Applicant') {
    return res.status(403).json({ error: 'applicant_only' });
  }
  next();
}

function computeProfileCompleteness(profile) {
  if (!profile) return 0;
  let filled = 0;
  for (const f of PROFILE_COMPLETENESS_FIELDS) {
    const v = profile[f];
    if (v !== null && v !== undefined && v !== '') filled += 1;
  }
  return Math.round((filled / PROFILE_COMPLETENESS_FIELDS.length) * 100);
}

router.get('/profile', requireAuth, requireApplicant, (req, res) => {
  const userId = req.user.id;
  try {
    const profile = loadProfileRow(userId);
    if (!profile) {
      const empty = Object.fromEntries(PROFILE_FIELDS.map((f) => [f, null]));
      return res.json({ profile: { ...empty, updated_at: null } });
    }
    return res.json({ profile });
  } catch (e) {
    console.error('[applicant/profile GET]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/profile/review', requireAuth, requireApplicant, async (req, res) => {
  const userId = req.user.id;
  let clean;
  try {
    clean = sanitizeProfileUpdate(req.body?.profile);
  } catch (e) {
    return res.status(400).json({ error: e.code || 'invalid_profile', detail: e.message });
  }
  try {
    const current = loadProfileRow(userId) || {};
    const result = await reviewProfileChanges(current, clean);
    return res.json(result);
  } catch (e) {
    console.error('[applicant/profile/review]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.patch('/profile', requireAuth, requireApplicant, (req, res) => {
  const userId = req.user.id;
  let clean;
  try {
    clean = sanitizeProfileUpdate(req.body?.profile);
  } catch (e) {
    return res.status(400).json({ error: e.code || 'invalid_profile', detail: e.message });
  }

  const keys = Object.keys(clean);
  if (keys.length === 0) {
    const profile = loadProfileRow(userId);
    return res.json({ profile });
  }

  try {
    ensureProfileRow(userId);
    const setSql = keys.map((k) => `${k} = @${k}`).join(', ');
    db.prepare(
      `UPDATE user_profiles
          SET ${setSql}, updated_at = datetime('now')
        WHERE user_id = @user_id`
    ).run({ ...clean, user_id: userId });

    const profile = loadProfileRow(userId);
    return res.json({ profile });
  } catch (e) {
    console.error('[applicant/profile PATCH]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/home', requireAuth, requireApplicant, (req, res) => {
  const userId = req.user.id;

  try {
    const profile = db
      .prepare(`SELECT ${PROFILE_FIELDS.join(', ')} FROM user_profiles WHERE user_id = ?`)
      .get(userId);

    const profile_completeness = computeProfileCompleteness(profile);

    const { active_conversations } = db
      .prepare(
        `SELECT COUNT(*) AS active_conversations
           FROM conversations
          WHERE active = 1 AND (user_1_id = ? OR user_2_id = ?)`
      )
      .get(userId, userId);

    const { messages_received } = db
      .prepare(
        `SELECT COUNT(*) AS messages_received
           FROM messages m
           JOIN conversations c ON c.id = m.conversation_id
          WHERE (c.user_1_id = ? OR c.user_2_id = ?) AND m.user_id != ?`
      )
      .get(userId, userId, userId);

    const { open_jobs } = db
      .prepare(`SELECT COUNT(*) AS open_jobs FROM job_postings WHERE is_active = 1`)
      .get();

    const recentRows = db
      .prepare(
        `SELECT
           c.id                                             AS id,
           c.job_posting_id                                 AS job_posting_id,
           c.created_at                                     AS created_at,
           CASE WHEN c.user_1_id = ? THEN c.user_2_id
                                     ELSE c.user_1_id END   AS other_user_id,
           jp.job_title                                     AS job_title,
           (SELECT m.conversation_content
              FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC
             LIMIT 1)                                       AS last_message,
           (SELECT m.created_at
              FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC
             LIMIT 1)                                       AS last_message_at
         FROM conversations c
         LEFT JOIN job_postings jp ON jp.id = c.job_posting_id
         WHERE c.active = 1 AND (c.user_1_id = ? OR c.user_2_id = ?)
         ORDER BY COALESCE(
           (SELECT m.created_at FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC LIMIT 1),
           c.created_at
         ) DESC
         LIMIT 5`
      )
      .all(userId, userId, userId);

    const otherIds = [...new Set(recentRows.map((r) => r.other_user_id))];
    const otherUsers = otherIds.length
      ? db
          .prepare(
            `SELECT id, username, role
               FROM users
              WHERE id IN (${otherIds.map(() => '?').join(',')})`
          )
          .all(...otherIds)
      : [];
    const otherById = new Map(otherUsers.map((u) => [u.id, u]));

    const recent_conversations = recentRows.map((r) => ({
      id: r.id,
      job_posting_id: r.job_posting_id,
      job_title: r.job_title,
      other_party: otherById.get(r.other_user_id) || {
        id: r.other_user_id,
        username: 'unknown',
        role: 'Unknown',
      },
      last_message: r.last_message,
      last_message_at: r.last_message_at,
      created_at: r.created_at,
    }));

    const featured_jobs = db
      .prepare(
        `SELECT
           jp.id, jp.job_title, jp.company_name,
           jp.office_locations_json, jp.work_model,
           jp.employment_type, jp.salary_min, jp.salary_max, jp.currency,
           jp.created_at,
           u.username AS poster_username
         FROM job_postings jp
         JOIN users u ON u.id = jp.poster_id
         WHERE jp.is_active = 1
         ORDER BY jp.created_at DESC
         LIMIT 5`
      )
      .all();

    return res.json({
      stats: {
        profile_completeness,
        active_conversations,
        messages_received,
        open_jobs,
      },
      recent_conversations,
      featured_jobs,
    });
  } catch (e) {
    console.error('[applicant/home]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/jobs', requireAuth, requireApplicant, (req, res) => {
  try {
    const {
      q,
      employment_type,
      remote,
      location,
      limit: rawLimit,
      offset: rawOffset,
    } = req.query;

    const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 50));
    const offset = Math.max(0, parseInt(rawOffset, 10) || 0);

    const where = ['jp.is_active = 1'];
    const params = [];

    if (q && typeof q === 'string' && q.trim() !== '') {
      const like = `%${q.trim()}%`;
      where.push('(jp.job_title LIKE ? OR jp.company_name LIKE ? OR jp.summary LIKE ?)');
      params.push(like, like, like);
    }

    if (employment_type && typeof employment_type === 'string') {
      const allowed = ['FullTime', 'PartTime', 'Contract', 'Internship', 'Temporary'];
      if (allowed.includes(employment_type)) {
        where.push('jp.employment_type = ?');
        params.push(employment_type);
      }
    }

    if (remote === '1' || remote === 'true') {
      where.push("jp.work_model = 'Remote'");
    } else if (remote === '0' || remote === 'false') {
      where.push("(jp.work_model IS NULL OR jp.work_model <> 'Remote')");
    }

    if (location && typeof location === 'string' && location.trim() !== '') {
      where.push('jp.office_locations_json LIKE ?');
      params.push(`%${location.trim()}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM job_postings jp ${whereSql}`)
      .get(...params);

    const jobs = db
      .prepare(
        `SELECT
           jp.id, jp.job_title, jp.company_name, jp.summary,
           jp.office_locations_json, jp.work_model,
           jp.employment_type, jp.salary_min, jp.salary_max, jp.currency,
           jp.created_at,
           u.username AS poster_username
         FROM job_postings jp
         JOIN users u ON u.id = jp.poster_id
         ${whereSql}
         ORDER BY jp.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return res.json({ total, limit, offset, jobs });
  } catch (e) {
    console.error('[applicant/jobs]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

const APPLICATION_STATUSES = ['Pending', 'Declined', 'SentToRecruiter'];

router.get('/applications', requireAuth, requireApplicant, (req, res) => {
  try {
    const userId = req.user.id;
    const {
      q,
      status,
      limit: rawLimit,
      offset: rawOffset,
    } = req.query;

    const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 50));
    const offset = Math.max(0, parseInt(rawOffset, 10) || 0);

    const where = ['a.applicant_id = ?'];
    const params = [userId];

    if (status && typeof status === 'string') {
      const list = status
        .split(',')
        .map((s) => s.trim())
        .filter((s) => APPLICATION_STATUSES.includes(s));
      if (list.length > 0) {
        where.push(`a.status IN (${list.map(() => '?').join(',')})`);
        params.push(...list);
      }
    }

    if (q && typeof q === 'string' && q.trim() !== '') {
      const like = `%${q.trim()}%`;
      where.push(
        '(jp.job_title LIKE ? OR jp.company_name LIKE ? OR jp.office_locations_json LIKE ? OR u.username LIKE ?)'
      );
      params.push(like, like, like, like);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const { total } = db
      .prepare(
        `SELECT COUNT(*) AS total
           FROM applications a
           JOIN job_postings jp ON jp.id = a.job_posting_id
           JOIN users u         ON u.id = jp.poster_id
           ${whereSql}`
      )
      .get(...params);

    const counts = db
      .prepare(
        `SELECT a.status AS status, COUNT(*) AS n
           FROM applications a
          WHERE a.applicant_id = ?
          GROUP BY a.status`
      )
      .all(userId);

    const status_counts = {
      Pending: 0,
      Declined: 0,
      SentToRecruiter: 0,
    };
    for (const row of counts) status_counts[row.status] = row.n;

    const applications = db
      .prepare(
        `SELECT
           a.id                     AS id,
           a.status                 AS status,
           a.notes                  AS notes,
           a.agent_reasoning        AS agent_reasoning,
           a.created_at             AS applied_at,
           a.updated_at             AS updated_at,
           a.decided_at             AS decided_at,
           jp.id                    AS job_id,
           jp.job_title             AS job_title,
           jp.company_name          AS company_name,
           jp.office_locations_json AS office_locations_json,
           jp.work_model            AS work_model,
           jp.employment_type       AS employment_type,
           jp.salary_min            AS salary_min,
           jp.salary_max            AS salary_max,
           jp.currency              AS currency,
           jp.is_active             AS job_is_active,
           u.username               AS poster_username
         FROM applications a
         JOIN job_postings jp ON jp.id = a.job_posting_id
         JOIN users u         ON u.id  = jp.poster_id
         ${whereSql}
         ORDER BY a.updated_at DESC, a.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset)
      .map((r) => ({
        id: r.id,
        status: r.status,
        notes: r.notes,
        agent_reasoning: r.agent_reasoning,
        applied_at: r.applied_at,
        updated_at: r.updated_at,
        decided_at: r.decided_at,
        job: {
          id: r.job_id,
          job_title: r.job_title,
          company_name: r.company_name,
          office_locations_json: r.office_locations_json,
          work_model: r.work_model,
          employment_type: r.employment_type,
          salary_min: r.salary_min,
          salary_max: r.salary_max,
          currency: r.currency,
          is_active: r.job_is_active,
          poster_username: r.poster_username,
        },
      }));

    return res.json({
      total,
      limit,
      offset,
      status_counts,
      applications,
    });
  } catch (e) {
    console.error('[applicant/applications]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/conversations', requireAuth, requireApplicant, (req, res) => {
  try {
    const userId = req.user.id;
    const { q, active: activeRaw } = req.query;

    const where = ['(c.user_1_id = ? OR c.user_2_id = ?)'];
    const params = [userId, userId];

    if (activeRaw === '1' || activeRaw === 'true') {
      where.push('c.active = 1');
    } else if (activeRaw === '0' || activeRaw === 'false') {
      where.push('c.active = 0');
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const rows = db
      .prepare(
        `SELECT
           c.id                                             AS id,
           c.job_posting_id                                 AS job_posting_id,
           c.active                                         AS active,
           c.created_at                                     AS created_at,
           CASE WHEN c.user_1_id = ? THEN c.user_2_id
                                     ELSE c.user_1_id END   AS other_user_id,
           jp.job_title                                     AS job_title,
           jp.company_name                                  AS job_company,
           (SELECT m.conversation_content
              FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC
             LIMIT 1)                                       AS last_message,
           (SELECT m.created_at
              FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC
             LIMIT 1)                                       AS last_message_at,
           (SELECT m.user_id
              FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC
             LIMIT 1)                                       AS last_message_user_id
         FROM conversations c
         LEFT JOIN job_postings jp ON jp.id = c.job_posting_id
         ${whereSql}
         ORDER BY COALESCE(
           (SELECT m.created_at FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC LIMIT 1),
           c.created_at
         ) DESC`
      )
      .all(userId, ...params);

    const otherIds = [...new Set(rows.map((r) => r.other_user_id))];
    const otherUsers = otherIds.length
      ? db
          .prepare(
            `SELECT id, username, role
               FROM users
              WHERE id IN (${otherIds.map(() => '?').join(',')})`
          )
          .all(...otherIds)
      : [];
    const otherById = new Map(otherUsers.map((u) => [u.id, u]));

    let conversations = rows.map((r) => ({
      id: r.id,
      job_posting_id: r.job_posting_id,
      job_title: r.job_title,
      job_company: r.job_company,
      active: r.active,
      created_at: r.created_at,
      last_message: r.last_message,
      last_message_at: r.last_message_at,
      last_message_from_me:
        r.last_message_user_id != null
          ? r.last_message_user_id === userId
          : null,
      other_party: otherById.get(r.other_user_id) || {
        id: r.other_user_id,
        username: 'unknown',
        role: 'Unknown',
      },
    }));

    if (q && typeof q === 'string' && q.trim() !== '') {
      const needle = q.trim().toLowerCase();
      conversations = conversations.filter((c) => {
        return (
          c.other_party.username.toLowerCase().includes(needle) ||
          (c.job_title && c.job_title.toLowerCase().includes(needle)) ||
          (c.job_company && c.job_company.toLowerCase().includes(needle)) ||
          (c.last_message && c.last_message.toLowerCase().includes(needle))
        );
      });
    }

    return res.json({ conversations });
  } catch (e) {
    console.error('[applicant/conversations]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

function loadConversationForUser(conversationId, userId) {
  return db
    .prepare(
      `SELECT
         c.id              AS id,
         c.user_1_id       AS user_1_id,
         c.user_2_id       AS user_2_id,
         c.job_posting_id  AS job_posting_id,
         c.active          AS active,
         c.created_at      AS created_at,
         jp.job_title      AS job_title,
         jp.company_name   AS job_company
       FROM conversations c
       LEFT JOIN job_postings jp ON jp.id = c.job_posting_id
       WHERE c.id = ? AND (c.user_1_id = ? OR c.user_2_id = ?)`
    )
    .get(conversationId, userId, userId);
}

router.get(
  '/conversations/:id/messages',
  requireAuth,
  requireApplicant,
  (req, res) => {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json({ error: 'invalid_conversation_id' });
    }

    try {
      const convo = loadConversationForUser(conversationId, userId);
      if (!convo) return res.status(404).json({ error: 'not_found' });

      const otherUserId =
        convo.user_1_id === userId ? convo.user_2_id : convo.user_1_id;

      const otherParty = db
        .prepare('SELECT id, username, role FROM users WHERE id = ?')
        .get(otherUserId) || { id: otherUserId, username: 'unknown', role: 'Unknown' };

      const messages = db
        .prepare(
          `SELECT
             conversation_index   AS index,
             user_id              AS user_id,
             conversation_content AS content,
             created_at           AS created_at
           FROM messages
          WHERE conversation_id = ?
          ORDER BY conversation_index ASC`
        )
        .all(conversationId)
        .map((m) => ({
          index: m.index,
          user_id: m.user_id,
          content: m.content,
          created_at: m.created_at,
          from_me: m.user_id === userId,
        }));

      return res.json({
        conversation: {
          id: convo.id,
          job_posting_id: convo.job_posting_id,
          job_title: convo.job_title,
          job_company: convo.job_company,
          active: convo.active,
          created_at: convo.created_at,
          other_party: otherParty,
        },
        messages,
      });
    } catch (e) {
      console.error('[applicant/conversations/messages GET]', e);
      return res.status(500).json({ error: 'server_error' });
    }
  }
);

router.post(
  '/conversations/:id/messages',
  requireAuth,
  requireApplicant,
  (req, res) => {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json({ error: 'invalid_conversation_id' });
    }

    const rawContent = req.body?.content;
    if (typeof rawContent !== 'string') {
      return res.status(400).json({ error: 'invalid_content' });
    }
    const content = rawContent.trim();
    if (content === '') {
      return res.status(400).json({ error: 'empty_content' });
    }
    if (content.length > 4000) {
      return res.status(400).json({ error: 'content_too_long' });
    }

    try {
      const convo = loadConversationForUser(conversationId, userId);
      if (!convo) return res.status(404).json({ error: 'not_found' });
      if (convo.active === 0) {
        return res.status(409).json({ error: 'conversation_closed' });
      }

      const inserted = db.transaction(() => {
        const { next_index } = db
          .prepare(
            `SELECT COALESCE(MAX(conversation_index) + 1, 0) AS next_index
               FROM messages
              WHERE conversation_id = ?`
          )
          .get(conversationId);

        db.prepare(
          `INSERT INTO messages
             (conversation_id, conversation_index, user_id, conversation_content)
           VALUES (?, ?, ?, ?)`
        ).run(conversationId, next_index, userId, content);

        return db
          .prepare(
            `SELECT
               conversation_index   AS index,
               user_id              AS user_id,
               conversation_content AS content,
               created_at           AS created_at
             FROM messages
            WHERE conversation_id = ? AND conversation_index = ?`
          )
          .get(conversationId, next_index);
      })();

      return res.status(201).json({
        message: {
          index: inserted.index,
          user_id: inserted.user_id,
          content: inserted.content,
          created_at: inserted.created_at,
          from_me: true,
        },
      });
    } catch (e) {
      console.error('[applicant/conversations/messages POST]', e);
      return res.status(500).json({ error: 'server_error' });
    }
  }
);

module.exports = router;
