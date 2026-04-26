const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');
const { subscribeOffer } = require('../agents/bus');
const {
  loadMessages,
  getInterventionPending,
  submitInterventionChoice,
} = require('../agents/offer-negotiator');
const { negotiationToPublic } = require('../messaging/offerConfirmation');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function loadNegotiation(id) {
  return db.prepare('SELECT * FROM offer_negotiations WHERE id = ?').get(id);
}

function canView(negotiation, user) {
  if (!negotiation || !user) return false;
  return (
    user.id === negotiation.recruiter_user_id || user.id === negotiation.applicant_user_id
  );
}

function toPublic(negotiation) {
  return negotiationToPublic(negotiation);
}

router.get('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid_id' });
  }
  const neg = loadNegotiation(id);
  if (!neg) return res.status(404).json({ error: 'not_found' });
  if (!canView(neg, req.user)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  return res.json({ negotiation: toPublic(neg) });
});

router.get('/:id/stream', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid_id' });
  }
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
  const neg = loadNegotiation(id);
  if (!neg) return res.status(404).json({ error: 'not_found' });
  if (!canView(neg, user)) {
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

  const msgs = loadMessages(id);
  const interventionPending = getInterventionPending(id);
  send({
    type: 'state',
    negotiation: toPublic(neg),
    messages: msgs,
    intervention_pending: interventionPending || null,
  });

  if (neg.status !== 'running') {
    send({ type: 'done' });
    res.end();
    return;
  }

  const unsubscribe = subscribeOffer(id, (event) => {
    send(event);
    if (event.type === 'done') {
      try {
        unsubscribe();
      } catch {
        /* */
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
      /* */
    }
  });
});

/**
 * Applicant: respond while the negotiator is paused on an intervention (use agent, or your own text).
 */
router.post('/:id/intervene', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid_id' });
  }
  const body = req.body;
  const turn = Number(body?.turn_index);
  if (!Number.isInteger(turn) || turn < 0) {
    return res.status(400).json({ error: 'invalid_turn_index' });
  }
  const useAgent = body?.use_agent === true;
  const message = typeof body?.message === 'string' ? body.message : null;

  const neg = loadNegotiation(id);
  if (!neg) return res.status(404).json({ error: 'not_found' });
  if (req.user.id !== neg.applicant_user_id) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (neg.status !== 'running') {
    return res.status(409).json({ error: 'not_in_progress' });
  }
  if (useAgent) {
    const r = submitInterventionChoice(id, turn, { useAgent: true, message: null });
    if (!r.ok) return res.status(409).json({ error: r.error });
    return res.json({ ok: true, outcome: 'agent' });
  }
  if (message == null || message.trim() === '') {
    return res.status(400).json({ error: 'message_required' });
  }
  const r2 = submitInterventionChoice(id, turn, { useAgent: false, message });
  if (!r2.ok) return res.status(409).json({ error: r2.error });
  return res.json({ ok: true, outcome: 'human' });
});

module.exports = router;
