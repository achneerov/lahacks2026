const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');

const router = express.Router();

function requireRecruiter(req, res, next) {
  if (!req.user || req.user.role !== 'Recruiter') {
    return res.status(403).json({ error: 'recruiter_only' });
  }
  next();
}

router.get('/home', requireAuth, requireRecruiter, (req, res) => {
  const userId = req.user.id;

  try {
    const { active_postings } = db
      .prepare(
        `SELECT COUNT(*) AS active_postings
           FROM job_postings
          WHERE poster_id = ? AND is_active = 1`
      )
      .get(userId);

    const { total_postings } = db
      .prepare(
        `SELECT COUNT(*) AS total_postings
           FROM job_postings
          WHERE poster_id = ?`
      )
      .get(userId);

    const { total_applicants } = db
      .prepare(
        `SELECT COUNT(DISTINCT a.applicant_id) AS total_applicants
           FROM applications a
           JOIN job_postings jp ON jp.id = a.job_posting_id
          WHERE jp.poster_id = ?`
      )
      .get(userId);

    const { total_applications } = db
      .prepare(
        `SELECT COUNT(*) AS total_applications
           FROM applications a
           JOIN job_postings jp ON jp.id = a.job_posting_id
          WHERE jp.poster_id = ?`
      )
      .get(userId);

    const { new_applicants_7d } = db
      .prepare(
        `SELECT COUNT(*) AS new_applicants_7d
           FROM applications a
           JOIN job_postings jp ON jp.id = a.job_posting_id
          WHERE jp.poster_id = ?
            AND a.created_at >= datetime('now', '-7 days')`
      )
      .get(userId);

    const { pending_applications } = db
      .prepare(
        `SELECT COUNT(*) AS pending_applications
           FROM applications a
           JOIN job_postings jp ON jp.id = a.job_posting_id
          WHERE jp.poster_id = ? AND a.status = 'Pending'`
      )
      .get(userId);

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

    const recent_postings = db
      .prepare(
        `SELECT
           jp.id              AS id,
           jp.title           AS title,
           jp.company         AS company,
           jp.location        AS location,
           jp.remote          AS remote,
           jp.employment_type AS employment_type,
           jp.salary_min      AS salary_min,
           jp.salary_max      AS salary_max,
           jp.salary_currency AS salary_currency,
           jp.is_active       AS is_active,
           jp.created_at      AS created_at,
           (SELECT COUNT(*) FROM applications a
              WHERE a.job_posting_id = jp.id) AS applicant_count,
           (SELECT COUNT(*) FROM applications a
              WHERE a.job_posting_id = jp.id
                AND a.created_at >= datetime('now', '-7 days')) AS new_applicants_7d,
           (SELECT COUNT(*) FROM applications a
              WHERE a.job_posting_id = jp.id
                AND a.status = 'Pending') AS pending_count
         FROM job_postings jp
         WHERE jp.poster_id = ?
         ORDER BY jp.created_at DESC
         LIMIT 5`
      )
      .all(userId);

    const recent_applications = db
      .prepare(
        `SELECT
           a.id              AS id,
           a.status          AS status,
           a.created_at      AS applied_at,
           a.updated_at      AS updated_at,
           jp.id             AS job_id,
           jp.title          AS job_title,
           jp.company        AS job_company,
           u.id              AS applicant_id,
           u.username        AS applicant_username,
           up.full_name      AS applicant_full_name,
           up.headline       AS applicant_headline
         FROM applications a
         JOIN job_postings jp  ON jp.id = a.job_posting_id
         JOIN users u          ON u.id  = a.applicant_id
         LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE jp.poster_id = ?
         ORDER BY a.created_at DESC
         LIMIT 5`
      )
      .all(userId)
      .map((r) => ({
        id: r.id,
        status: r.status,
        applied_at: r.applied_at,
        updated_at: r.updated_at,
        job: {
          id: r.job_id,
          title: r.job_title,
          company: r.job_company,
        },
        applicant: {
          id: r.applicant_id,
          username: r.applicant_username,
          full_name: r.applicant_full_name,
          headline: r.applicant_headline,
        },
      }));

    return res.json({
      stats: {
        active_postings,
        total_postings,
        total_applicants,
        total_applications,
        new_applicants_7d,
        pending_applications,
        active_conversations,
        messages_received,
      },
      recent_postings,
      recent_applications,
    });
  } catch (e) {
    console.error('[recruiter/home]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
