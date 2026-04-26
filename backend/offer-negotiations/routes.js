const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');
const { subscribeOffer } = require('../agents/bus');
const { loadMessages } = require('../agents/offer-negotiator');
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
  send({
    type: 'state',
    negotiation: toPublic(neg),
    messages: msgs,
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

module.exports = router;
