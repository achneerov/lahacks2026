const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');
const { subscribe } = require('../agents/bus');
const { startNegotiation } = require('../agents/negotiator');

const router = express.Router();

function getApplicationOrNull(id) {
  return db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
}

function userCanViewApplication(application, userId) {
  if (!application) return false;
  if (application.applicant_id === userId) return true;
  const job = db.prepare('SELECT poster_id FROM job_postings WHERE id = ?').get(application.job_posting_id);
  return !!(job && job.poster_id === userId);
}

function getMessages(applicationId) {
  return db
    .prepare('SELECT turn_index, sender, content, created_at FROM negotiation_messages WHERE application_id = ? ORDER BY turn_index ASC')
    .all(applicationId);
}

router.post('/', requireAuth, (req, res) => {
  if (req.user.role !== 'Applicant') {
    return res.status(403).json({ error: 'only_applicants_can_apply' });
  }
  const { job_posting_id } = req.body || {};
  if (!job_posting_id) return res.status(400).json({ error: 'missing_job_posting_id' });

  const job = db.prepare('SELECT id, is_active FROM job_postings WHERE id = ?').get(job_posting_id);
  if (!job) return res.status(404).json({ error: 'job_not_found' });
  if (!job.is_active) return res.status(400).json({ error: 'job_not_active' });

  let info;
  try {
    info = db
      .prepare('INSERT INTO applications (applicant_id, job_posting_id) VALUES (?, ?)')
      .run(req.user.id, job_posting_id);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'already_applied' });
    }
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }

  const application = getApplicationOrNull(info.lastInsertRowid);
  startNegotiation(application.id);
  return res.status(201).json({ application });
});

router.get('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const application = getApplicationOrNull(id);
  if (!application) return res.status(404).json({ error: 'not_found' });
  if (!userCanViewApplication(application, req.user.id)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  return res.json({ application, messages: getMessages(id) });
});

// SSE: EventSource cannot send Authorization headers, so accept ?token=...
router.get('/:id/stream', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const id = Number(req.params.id);
  const application = getApplicationOrNull(id);
  if (!application) return res.status(404).json({ error: 'not_found' });
  if (!userCanViewApplication(application, user.id)) {
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

  // Replay current state
  send({ type: 'state', application, messages: getMessages(id) });

  if (application.status !== 'Pending') {
    send({ type: 'done' });
    res.end();
    return;
  }

  const unsubscribe = subscribe(id, (event) => {
    send(event);
    if (event.type === 'done') {
      unsubscribe();
      res.end();
    }
  });

  const heartbeat = setInterval(() => {
    res.write(': hb\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
