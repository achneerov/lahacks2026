const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');

const router = express.Router();

const PROFILE_FIELDS = [
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

module.exports = router;
