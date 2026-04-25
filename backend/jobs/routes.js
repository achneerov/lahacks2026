const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const jobs = db
    .prepare(
      `SELECT id, poster_id, job_title, company_name, summary, work_model,
              office_locations_json, salary_min, salary_max, currency,
              employment_type, job_level, is_active, created_at
         FROM job_postings
         WHERE is_active = 1
         ORDER BY id DESC`
    )
    .all();
  return res.json({ jobs });
});

router.get('/:id', requireAuth, (req, res) => {
  const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'not_found' });
  return res.json({ job });
});

module.exports = router;
