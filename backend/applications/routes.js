const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');
const { startNegotiation, isConfigured } = require('../agents/negotiator');
const { subscribe } = require('../agents/bus');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function loadApplication(id) {
  return db
    .prepare(
      `SELECT a.id, a.applicant_id, a.job_posting_id, a.status, a.notes,
              a.agent_reasoning, a.match_score, a.created_at, a.updated_at, a.decided_at,
              jp.title         AS job_title,
              jp.company       AS job_company,
              jp.poster_id     AS job_poster_id,
              applicant.username AS applicant_username,
              poster.username    AS poster_username
         FROM applications a
         JOIN job_postings jp ON jp.id = a.job_posting_id
         JOIN users applicant ON applicant.id = a.applicant_id
         JOIN users poster    ON poster.id    = jp.poster_id
        WHERE a.id = ?`
    )
    .get(id);
}

function loadMessages(applicationId) {
  return db
    .prepare(
      `SELECT turn_index, sender, content, created_at
         FROM negotiation_messages
        WHERE application_id = ?
        ORDER BY turn_index ASC`
    )
    .all(applicationId);
}

function canViewApplication(application, user) {
  if (!user) return false;
  return user.id === application.applicant_id || user.id === application.job_poster_id;
}

router.post('/', requireAuth, (req, res) => {
  if (req.user.role !== 'Applicant') {
    return res.status(403).json({ error: 'applicant_only' });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      error: 'service_unavailable',
      detail: 'AI negotiation service is not configured. Please try again later.',
    });
  }

  const jobIdRaw = req.body?.job_posting_id;
  const jobId = Number(jobIdRaw);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return res.status(400).json({ error: 'invalid_job_posting_id' });
  }

  const job = db
    .prepare('SELECT id, is_active FROM job_postings WHERE id = ?')
    .get(jobId);
  if (!job) return res.status(404).json({ error: 'job_not_found' });
  if (!job.is_active) return res.status(409).json({ error: 'job_inactive' });

  let applicationId;
  try {
    const info = db
      .prepare(
        `INSERT INTO applications (applicant_id, job_posting_id, status)
         VALUES (?, ?, 'Pending')`
      )
      .run(req.user.id, jobId);
    applicationId = info.lastInsertRowid;
  } catch (err) {
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'already_applied' });
    }
    console.error('[applications POST]', err);
    return res.status(500).json({ error: 'server_error' });
  }

  const application = loadApplication(applicationId);
  startNegotiation(applicationId);
  return res.status(201).json({ application });
});

router.get('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid_application_id' });
  }
  const application = loadApplication(id);
  if (!application) return res.status(404).json({ error: 'not_found' });
  if (!canViewApplication(application, req.user)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const messages = loadMessages(id);
  return res.json({ application, messages });
});

router.get('/:id/stream', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid_application_id' });
  }

  // EventSource cannot send Authorization headers — accept ?token=
  const token = req.query.token;
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'missing_token' });
  }
  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const application = loadApplication(id);
  if (!application) return res.status(404).json({ error: 'not_found' });
  if (!canViewApplication(application, user)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Replay current state so reconnects (or late subscribers) catch up.
  send({
    type: 'state',
    application,
    messages: loadMessages(id),
  });

  // If the negotiation is already finished, end the stream cleanly.
  if (application.status !== 'Pending') {
    send({ type: 'done' });
    res.end();
    return;
  }

  const unsubscribe = subscribe(id, (event) => {
    send(event);
    if (event.type === 'done') {
      try {
        unsubscribe();
      } catch {
        // ignore
      }
      res.end();
    }
  });

  const heartbeat = setInterval(() => {
    res.write(': hb\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    try {
      unsubscribe();
    } catch {
      // ignore
    }
  });
});

module.exports = router;
