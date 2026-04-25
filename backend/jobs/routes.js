const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');

const router = express.Router();

// GET /api/jobs — list active job postings (any logged-in user, used by the
// Apply UX so applicants can hit POST /api/applications without going through
// the role-specific applicant routes).
router.get('/', requireAuth, (req, res) => {
  try {
    const { q, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 50));
    const offset = Math.max(0, parseInt(rawOffset, 10) || 0);

    const where = ['jp.is_active = 1'];
    const params = [];
    if (q && typeof q === 'string' && q.trim() !== '') {
      const like = `%${q.trim()}%`;
      where.push('(jp.title LIKE ? OR jp.company LIKE ? OR jp.description LIKE ?)');
      params.push(like, like, like);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM job_postings jp ${whereSql}`)
      .get(...params);

    const jobs = db
      .prepare(
        `SELECT jp.id, jp.title, jp.company, jp.description, jp.location, jp.remote,
                jp.employment_type, jp.salary_min, jp.salary_max, jp.salary_currency,
                jp.created_at, u.username AS poster_username
           FROM job_postings jp JOIN users u ON u.id = jp.poster_id
           ${whereSql}
          ORDER BY jp.created_at DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return res.json({ total, limit, offset, jobs });
  } catch (err) {
    console.error('[jobs GET]', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid_job_id' });
  }
  try {
    const job = db
      .prepare(
        `SELECT jp.id, jp.title, jp.company, jp.description, jp.location, jp.remote,
                jp.employment_type, jp.salary_min, jp.salary_max, jp.salary_currency,
                jp.is_active, jp.created_at, u.username AS poster_username
           FROM job_postings jp JOIN users u ON u.id = jp.poster_id
          WHERE jp.id = ?`
      )
      .get(id);
    if (!job) return res.status(404).json({ error: 'not_found' });
    return res.json({ job });
  } catch (err) {
    console.error('[jobs/:id GET]', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
