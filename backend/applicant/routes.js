const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');
const { reviewProfileChanges } = require('./profileReview');

const router = express.Router();

const PROFILE_FIELDS = [
  'full_name',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postal_code',
  'country',
  'headline',
  'bio',
  'resume_url',
  'linkedin_url',
  'github_url',
  'portfolio_url',
  'years_experience',
];

const PROFILE_TEXT_FIELDS = [
  'full_name',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postal_code',
  'country',
  'headline',
  'bio',
];

const PROFILE_URL_FIELDS = ['resume_url', 'linkedin_url', 'github_url', 'portfolio_url'];

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

  if (Object.prototype.hasOwnProperty.call(raw, 'years_experience')) {
    const v = raw.years_experience;
    if (v === null || v === undefined || v === '') {
      out.years_experience = null;
    } else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 80) {
        const err = new Error('profile.years_experience must be an integer between 0 and 80');
        err.code = 'invalid_profile_years';
        throw err;
      }
      out.years_experience = n;
    }
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
  for (const f of PROFILE_FIELDS) {
    const v = profile[f];
    if (v !== null && v !== undefined && v !== '') filled += 1;
  }
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
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
           jp.title                                         AS job_title,
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
           jp.id, jp.title, jp.company, jp.location, jp.remote,
           jp.employment_type, jp.salary_min, jp.salary_max, jp.salary_currency,
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
      where.push('(jp.title LIKE ? OR jp.company LIKE ? OR jp.description LIKE ?)');
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
      where.push('jp.remote = 1');
    } else if (remote === '0' || remote === 'false') {
      where.push('jp.remote = 0');
    }

    if (location && typeof location === 'string' && location.trim() !== '') {
      where.push('jp.location LIKE ?');
      params.push(`%${location.trim()}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM job_postings jp ${whereSql}`)
      .get(...params);

    const jobs = db
      .prepare(
        `SELECT
           jp.id, jp.title, jp.company, jp.description, jp.location, jp.remote,
           jp.employment_type, jp.salary_min, jp.salary_max, jp.salary_currency,
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
        '(jp.title LIKE ? OR jp.company LIKE ? OR jp.location LIKE ? OR u.username LIKE ?)'
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
           a.id              AS id,
           a.status          AS status,
           a.notes           AS notes,
           a.created_at      AS applied_at,
           a.updated_at      AS updated_at,
           jp.id             AS job_id,
           jp.title          AS job_title,
           jp.company        AS company,
           jp.location       AS location,
           jp.remote         AS remote,
           jp.employment_type AS employment_type,
           jp.salary_min     AS salary_min,
           jp.salary_max     AS salary_max,
           jp.salary_currency AS salary_currency,
           jp.is_active      AS job_is_active,
           u.username        AS poster_username
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
        applied_at: r.applied_at,
        updated_at: r.updated_at,
        job: {
          id: r.job_id,
          title: r.job_title,
          company: r.company,
          location: r.location,
          remote: r.remote,
          employment_type: r.employment_type,
          salary_min: r.salary_min,
          salary_max: r.salary_max,
          salary_currency: r.salary_currency,
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

module.exports = router;
