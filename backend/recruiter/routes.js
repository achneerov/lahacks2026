const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');
const { reviewJobPosting } = require('./jobReview');

const router = express.Router();

function requireRecruiter(req, res, next) {
  if (!req.user || req.user.role !== 'Recruiter') {
    return res.status(403).json({ error: 'recruiter_only' });
  }
  next();
}

const EMPLOYMENT_TYPES = ['FullTime', 'PartTime', 'Contract', 'Internship', 'Temporary'];

const JOB_TEXT_FIELDS = ['title', 'company', 'description', 'location', 'salary_currency'];

function sanitizeJobPayload(raw, { partial = false } = {}) {
  if (!raw || typeof raw !== 'object') {
    const err = new Error('job body must be an object');
    err.code = 'invalid_job';
    throw err;
  }

  const out = {};

  for (const key of JOB_TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const v = raw[key];
    if (v === null || v === undefined) {
      out[key] = null;
      continue;
    }
    if (typeof v !== 'string') {
      const err = new Error(`job.${key} must be a string`);
      err.code = 'invalid_job';
      throw err;
    }
    const trimmed = v.trim();
    out[key] = trimmed === '' ? null : trimmed;
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'remote')) {
    const v = raw.remote;
    if (v === true || v === 1 || v === '1') out.remote = 1;
    else if (v === false || v === 0 || v === '0' || v == null) out.remote = 0;
    else {
      const err = new Error('job.remote must be a boolean');
      err.code = 'invalid_job';
      throw err;
    }
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'employment_type')) {
    const v = raw.employment_type;
    if (v === null || v === undefined || v === '') {
      out.employment_type = null;
    } else if (typeof v === 'string' && EMPLOYMENT_TYPES.includes(v)) {
      out.employment_type = v;
    } else {
      const err = new Error('job.employment_type is invalid');
      err.code = 'invalid_job';
      throw err;
    }
  }

  for (const key of ['salary_min', 'salary_max']) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const v = raw[key];
    if (v === null || v === undefined || v === '') {
      out[key] = null;
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
      const err = new Error(`job.${key} must be a positive number`);
      err.code = 'invalid_job';
      throw err;
    }
    out[key] = Math.round(n);
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'is_active')) {
    const v = raw.is_active;
    if (v === true || v === 1 || v === '1') out.is_active = 1;
    else if (v === false || v === 0 || v === '0') out.is_active = 0;
    else {
      const err = new Error('job.is_active must be a boolean');
      err.code = 'invalid_job';
      throw err;
    }
  }

  if (!partial) {
    if (!out.title) {
      const err = new Error('title is required');
      err.code = 'invalid_job';
      throw err;
    }
    if (!('remote' in out)) out.remote = 0;
    if (!('is_active' in out)) out.is_active = 1;
    if (!('salary_currency' in out)) out.salary_currency = 'USD';

    if (
      out.salary_min != null &&
      out.salary_max != null &&
      out.salary_min > out.salary_max
    ) {
      const err = new Error('salary_min cannot exceed salary_max');
      err.code = 'invalid_job';
      throw err;
    }
  }

  return out;
}

function loadJobForRecruiter(jobId, recruiterId) {
  return db
    .prepare(
      `SELECT id, poster_id, title, company, description, location, remote,
              employment_type, salary_min, salary_max, salary_currency,
              is_active, created_at
         FROM job_postings
        WHERE id = ? AND poster_id = ?`
    )
    .get(jobId, recruiterId);
}

function jobApplicantStats(jobId) {
  return db
    .prepare(
      `SELECT
         COUNT(*)                                              AS applicant_count,
         SUM(CASE WHEN status = 'Pending'         THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN status = 'SentToRecruiter' THEN 1 ELSE 0 END) AS sent_count,
         SUM(CASE WHEN status = 'Declined'        THEN 1 ELSE 0 END) AS declined_count,
         SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END)
                                                              AS new_applicants_7d
       FROM applications
      WHERE job_posting_id = ?`
    )
    .get(jobId);
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

router.get('/jobs', requireAuth, requireRecruiter, (req, res) => {
  const userId = req.user.id;
  try {
    const { q, status, limit: rawLimit, offset: rawOffset } = req.query;

    const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 50));
    const offset = Math.max(0, parseInt(rawOffset, 10) || 0);

    const where = ['jp.poster_id = ?'];
    const params = [userId];

    if (q && typeof q === 'string' && q.trim() !== '') {
      const like = `%${q.trim()}%`;
      where.push('(jp.title LIKE ? OR jp.company LIKE ? OR jp.description LIKE ? OR jp.location LIKE ?)');
      params.push(like, like, like, like);
    }

    if (status === 'active') where.push('jp.is_active = 1');
    else if (status === 'closed') where.push('jp.is_active = 0');

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM job_postings jp ${whereSql}`)
      .get(...params);

    const counts = db
      .prepare(
        `SELECT
           SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count,
           SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS closed_count,
           COUNT(*)                                       AS total_count
           FROM job_postings
          WHERE poster_id = ?`
      )
      .get(userId);

    const jobs = db
      .prepare(
        `SELECT
           jp.id, jp.title, jp.company, jp.description, jp.location, jp.remote,
           jp.employment_type, jp.salary_min, jp.salary_max, jp.salary_currency,
           jp.is_active, jp.created_at,
           (SELECT COUNT(*) FROM applications a
              WHERE a.job_posting_id = jp.id) AS applicant_count,
           (SELECT COUNT(*) FROM applications a
              WHERE a.job_posting_id = jp.id
                AND a.status = 'Pending') AS pending_count,
           (SELECT COUNT(*) FROM applications a
              WHERE a.job_posting_id = jp.id
                AND a.status = 'SentToRecruiter') AS sent_count,
           (SELECT COUNT(*) FROM applications a
              WHERE a.job_posting_id = jp.id
                AND a.created_at >= datetime('now', '-7 days')) AS new_applicants_7d
         FROM job_postings jp
         ${whereSql}
         ORDER BY jp.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return res.json({
      total,
      limit,
      offset,
      counts: {
        active: counts?.active_count || 0,
        closed: counts?.closed_count || 0,
        total: counts?.total_count || 0,
      },
      jobs,
    });
  } catch (e) {
    console.error('[recruiter/jobs GET]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/jobs', requireAuth, requireRecruiter, (req, res) => {
  const userId = req.user.id;
  let clean;
  try {
    clean = sanitizeJobPayload(req.body?.job, { partial: false });
  } catch (e) {
    return res.status(400).json({ error: e.code || 'invalid_job', detail: e.message });
  }

  try {
    const info = db
      .prepare(
        `INSERT INTO job_postings
           (poster_id, title, company, description, location, remote,
            employment_type, salary_min, salary_max, salary_currency, is_active)
         VALUES
           (@poster_id, @title, @company, @description, @location, @remote,
            @employment_type, @salary_min, @salary_max, @salary_currency, @is_active)`
      )
      .run({
        poster_id: userId,
        title: clean.title,
        company: clean.company ?? null,
        description: clean.description ?? null,
        location: clean.location ?? null,
        remote: clean.remote ?? 0,
        employment_type: clean.employment_type ?? null,
        salary_min: clean.salary_min ?? null,
        salary_max: clean.salary_max ?? null,
        salary_currency: clean.salary_currency ?? 'USD',
        is_active: clean.is_active ?? 1,
      });

    const job = loadJobForRecruiter(info.lastInsertRowid, userId);
    return res.status(201).json({ job });
  } catch (e) {
    console.error('[recruiter/jobs POST]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/jobs/review', requireAuth, requireRecruiter, async (req, res) => {
  let clean;
  try {
    clean = sanitizeJobPayload(req.body?.job, { partial: true });
  } catch (e) {
    return res.status(400).json({ error: e.code || 'invalid_job', detail: e.message });
  }
  try {
    const result = await reviewJobPosting(clean);
    return res.json(result);
  } catch (e) {
    console.error('[recruiter/jobs/review]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/jobs/:id', requireAuth, requireRecruiter, (req, res) => {
  const userId = req.user.id;
  const jobId = parseInt(req.params.id, 10);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return res.status(400).json({ error: 'invalid_job_id' });
  }
  try {
    const job = loadJobForRecruiter(jobId, userId);
    if (!job) return res.status(404).json({ error: 'not_found' });
    const stats = jobApplicantStats(jobId) || {};
    return res.json({
      job,
      stats: {
        applicant_count: stats.applicant_count || 0,
        pending_count: stats.pending_count || 0,
        sent_count: stats.sent_count || 0,
        declined_count: stats.declined_count || 0,
        new_applicants_7d: stats.new_applicants_7d || 0,
      },
    });
  } catch (e) {
    console.error('[recruiter/jobs/:id GET]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.patch('/jobs/:id', requireAuth, requireRecruiter, (req, res) => {
  const userId = req.user.id;
  const jobId = parseInt(req.params.id, 10);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return res.status(400).json({ error: 'invalid_job_id' });
  }

  let clean;
  try {
    clean = sanitizeJobPayload(req.body?.job, { partial: true });
  } catch (e) {
    return res.status(400).json({ error: e.code || 'invalid_job', detail: e.message });
  }

  try {
    const existing = loadJobForRecruiter(jobId, userId);
    if (!existing) return res.status(404).json({ error: 'not_found' });

    const merged = { ...existing, ...clean };
    if (
      merged.salary_min != null &&
      merged.salary_max != null &&
      merged.salary_min > merged.salary_max
    ) {
      return res.status(400).json({ error: 'invalid_job', detail: 'salary_min cannot exceed salary_max' });
    }

    const keys = Object.keys(clean);
    if (keys.length === 0) {
      return res.json({ job: existing });
    }

    const setSql = keys.map((k) => `${k} = @${k}`).join(', ');
    db.prepare(
      `UPDATE job_postings
          SET ${setSql}
        WHERE id = @id AND poster_id = @poster_id`
    ).run({ ...clean, id: jobId, poster_id: userId });

    const job = loadJobForRecruiter(jobId, userId);
    return res.json({ job });
  } catch (e) {
    console.error('[recruiter/jobs/:id PATCH]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/jobs/:id/applicants', requireAuth, requireRecruiter, (req, res) => {
  const userId = req.user.id;
  const jobId = parseInt(req.params.id, 10);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return res.status(400).json({ error: 'invalid_job_id' });
  }
  try {
    const job = loadJobForRecruiter(jobId, userId);
    if (!job) return res.status(404).json({ error: 'not_found' });

    const applicants = db
      .prepare(
        `SELECT
           a.id              AS application_id,
           a.status          AS status,
           a.notes           AS notes,
           a.created_at      AS applied_at,
           a.updated_at      AS updated_at,
           u.id              AS applicant_id,
           u.username        AS username,
           u.email           AS email,
           up.full_name      AS full_name,
           up.headline       AS headline,
           up.city           AS city,
           up.state          AS state,
           up.country        AS country,
           up.years_experience AS years_experience,
           up.linkedin_url   AS linkedin_url,
           up.github_url     AS github_url,
           up.portfolio_url  AS portfolio_url,
           up.resume_url     AS resume_url
         FROM applications a
         JOIN users u                ON u.id  = a.applicant_id
         LEFT JOIN user_profiles up  ON up.user_id = u.id
        WHERE a.job_posting_id = ?
        ORDER BY a.updated_at DESC, a.id DESC`
      )
      .all(jobId)
      .map((r) => ({
        application_id: r.application_id,
        status: r.status,
        notes: r.notes,
        applied_at: r.applied_at,
        updated_at: r.updated_at,
        applicant: {
          id: r.applicant_id,
          username: r.username,
          email: r.email,
          full_name: r.full_name,
          headline: r.headline,
          city: r.city,
          state: r.state,
          country: r.country,
          years_experience: r.years_experience,
          linkedin_url: r.linkedin_url,
          github_url: r.github_url,
          portfolio_url: r.portfolio_url,
          resume_url: r.resume_url,
        },
      }));

    return res.json({ applicants });
  } catch (e) {
    console.error('[recruiter/jobs/:id/applicants]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/jobs/:id/conversations', requireAuth, requireRecruiter, (req, res) => {
  const userId = req.user.id;
  const jobId = parseInt(req.params.id, 10);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return res.status(400).json({ error: 'invalid_job_id' });
  }
  try {
    const job = loadJobForRecruiter(jobId, userId);
    if (!job) return res.status(404).json({ error: 'not_found' });

    const rows = db
      .prepare(
        `SELECT
           c.id                                              AS id,
           c.user_1_id                                       AS user_1_id,
           c.user_2_id                                       AS user_2_id,
           c.active                                          AS active,
           c.created_at                                      AS created_at,
           CASE WHEN c.user_1_id = ? THEN c.user_2_id
                                     ELSE c.user_1_id END   AS other_user_id,
           (SELECT m.conversation_content
              FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC
             LIMIT 1)                                        AS last_message,
           (SELECT m.created_at
              FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC
             LIMIT 1)                                        AS last_message_at,
           (SELECT m.user_id
              FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC
             LIMIT 1)                                        AS last_message_user_id,
           (SELECT COUNT(*) FROM messages m
             WHERE m.conversation_id = c.id)                AS message_count
         FROM conversations c
        WHERE c.job_posting_id = ?
          AND (c.user_1_id = ? OR c.user_2_id = ?)
        ORDER BY COALESCE(
          (SELECT m.created_at FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.conversation_index DESC LIMIT 1),
          c.created_at
        ) DESC`
      )
      .all(userId, jobId, userId, userId);

    const otherIds = [...new Set(rows.map((r) => r.other_user_id))];
    const others = otherIds.length
      ? db
          .prepare(
            `SELECT u.id, u.username, u.role, up.full_name, up.headline
               FROM users u
               LEFT JOIN user_profiles up ON up.user_id = u.id
              WHERE u.id IN (${otherIds.map(() => '?').join(',')})`
          )
          .all(...otherIds)
      : [];
    const otherById = new Map(others.map((u) => [u.id, u]));

    const conversations = rows.map((r) => ({
      id: r.id,
      active: r.active,
      created_at: r.created_at,
      message_count: r.message_count,
      last_message: r.last_message,
      last_message_at: r.last_message_at,
      last_message_from_me:
        r.last_message_user_id != null ? r.last_message_user_id === userId : null,
      other_party: otherById.get(r.other_user_id) || {
        id: r.other_user_id,
        username: 'unknown',
        role: 'Unknown',
        full_name: null,
        headline: null,
      },
    }));

    return res.json({ conversations });
  } catch (e) {
    console.error('[recruiter/jobs/:id/conversations]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get(
  '/applicants/:applicantId/agent-conversation',
  requireAuth,
  requireRecruiter,
  (req, res) => {
    const userId = req.user.id;
    const applicantId = parseInt(req.params.applicantId, 10);
    const jobIdRaw = req.query.job_id;
    const jobId = jobIdRaw != null ? parseInt(jobIdRaw, 10) : null;

    if (!Number.isInteger(applicantId) || applicantId <= 0) {
      return res.status(400).json({ error: 'invalid_applicant_id' });
    }
    if (jobIdRaw != null && (!Number.isInteger(jobId) || jobId <= 0)) {
      return res.status(400).json({ error: 'invalid_job_id' });
    }

    try {
      if (jobId) {
        const job = loadJobForRecruiter(jobId, userId);
        if (!job) return res.status(404).json({ error: 'not_found' });
        const application = db
          .prepare(
            `SELECT 1 FROM applications WHERE applicant_id = ? AND job_posting_id = ?`
          )
          .get(applicantId, jobId);
        if (!application) {
          return res.status(404).json({ error: 'application_not_found' });
        }
      } else {
        const anyApp = db
          .prepare(
            `SELECT 1
               FROM applications a
               JOIN job_postings jp ON jp.id = a.job_posting_id
              WHERE a.applicant_id = ? AND jp.poster_id = ?
              LIMIT 1`
          )
          .get(applicantId, userId);
        if (!anyApp) {
          return res.status(403).json({ error: 'forbidden' });
        }
      }

      let convo = null;
      if (jobId) {
        convo = db
          .prepare(
            `SELECT c.id, c.created_at, c.active, c.user_1_id, c.user_2_id, c.job_posting_id
               FROM conversations c
               JOIN users u
                 ON u.id = CASE WHEN c.user_1_id = ? THEN c.user_2_id ELSE c.user_1_id END
              WHERE (c.user_1_id = ? OR c.user_2_id = ?)
                AND u.role = 'Agent'
                AND c.job_posting_id = ?
              ORDER BY c.created_at DESC
              LIMIT 1`
          )
          .get(applicantId, applicantId, applicantId, jobId);
      }
      if (!convo) {
        convo = db
          .prepare(
            `SELECT c.id, c.created_at, c.active, c.user_1_id, c.user_2_id, c.job_posting_id
               FROM conversations c
               JOIN users u
                 ON u.id = CASE WHEN c.user_1_id = ? THEN c.user_2_id ELSE c.user_1_id END
              WHERE (c.user_1_id = ? OR c.user_2_id = ?)
                AND u.role = 'Agent'
              ORDER BY c.created_at DESC
              LIMIT 1`
          )
          .get(applicantId, applicantId, applicantId);
      }

      if (!convo) {
        return res.json({ conversation: null, messages: [] });
      }

      const agentId =
        convo.user_1_id === applicantId ? convo.user_2_id : convo.user_1_id;

      const agent = db
        .prepare('SELECT id, username, role FROM users WHERE id = ?')
        .get(agentId) || { id: agentId, username: 'agent', role: 'Agent' };
      const applicant = db
        .prepare('SELECT id, username, role FROM users WHERE id = ?')
        .get(applicantId) || { id: applicantId, username: 'applicant', role: 'Applicant' };

      const messages = db
        .prepare(
          `SELECT
             conversation_index   AS msg_index,
             user_id              AS user_id,
             conversation_content AS content,
             created_at           AS created_at
           FROM messages
          WHERE conversation_id = ?
          ORDER BY conversation_index ASC`
        )
        .all(convo.id)
        .map((m) => ({
          index: m.msg_index,
          user_id: m.user_id,
          content: m.content,
          created_at: m.created_at,
          from_agent: m.user_id === agentId,
        }));

      return res.json({
        conversation: {
          id: convo.id,
          job_posting_id: convo.job_posting_id,
          active: convo.active,
          created_at: convo.created_at,
          agent,
          applicant,
        },
        messages,
      });
    } catch (e) {
      console.error('[recruiter/applicants/agent-conversation]', e);
      return res.status(500).json({ error: 'server_error' });
    }
  }
);

module.exports = router;
