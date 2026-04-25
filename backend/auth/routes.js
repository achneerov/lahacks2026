const express = require('express');
const bcrypt = require('bcrypt');
const { signRequest } = require('@worldcoin/idkit-server');
const db = require('../db');
const { verifyWorldId } = require('./verifyWorldId');
const { signToken, requireAuth } = require('./jwt');

const router = express.Router();

const ROLES = ['Applicant', 'Recruiter', 'Agent'];
const SIGNUP_ROLES = ['Applicant', 'Recruiter'];
const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

router.get('/world-id-context', (req, res) => {
  const rawKey = (process.env.WORLD_ID_SIGNING_KEY || '').trim();
  const signingKeyHex = rawKey.startsWith('0x') ? rawKey.slice(2) : rawKey;
  const rp_id = process.env.WORLD_ID_RP_ID;
  const app_id = process.env.WORLD_ID_APP_ID;
  const action = process.env.WORLD_ID_ACTION || 'register';

  if (!signingKeyHex || !rp_id || !app_id) {
    return res.status(500).json({ error: 'world_id_not_configured' });
  }

  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex, action });
    return res.json({
      app_id,
      action,
      rp_context: {
        rp_id,
        nonce,
        created_at: createdAt,
        expires_at: expiresAt,
        signature: sig,
      },
    });
  } catch (e) {
    console.error('[WorldID] signRequest failed:', e);
    return res.status(500).json({ error: 'sign_failed', detail: e.message });
  }
});

router.post('/signup/check-basics', (req, res) => {
  const { email, password, username, role } = req.body || {};

  if (!email || !password || !username || !role) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (!SIGNUP_ROLES.includes(role)) {
    return res.status(400).json({ error: 'invalid_role' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
    return res.status(400).json({ error: 'invalid_username' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password_too_short' });
  }

  const normalizedEmail = email.trim();
  const normalizedUsername = username.trim();

  const existingEmail = db
    .prepare('SELECT 1 FROM users WHERE email = ?')
    .get(normalizedEmail);
  if (existingEmail) return res.status(409).json({ error: 'email_taken' });

  const existingUsername = db
    .prepare('SELECT 1 FROM users WHERE username = ?')
    .get(normalizedUsername);
  if (existingUsername) return res.status(409).json({ error: 'username_taken' });

  return res.json({
    ok: true,
    email: normalizedEmail,
    username: normalizedUsername,
    role,
  });
});

router.post('/register', async (req, res) => {
  const { email, password, username, role, world_id_result } = req.body || {};

  if (!email || !password || !username || !role || !world_id_result) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'invalid_role' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password_too_short' });
  }

  let nullifier_hash;
  try {
    ({ nullifier_hash } = await verifyWorldId(world_id_result));
  } catch (e) {
    return res.status(e.status || 400).json({ error: 'world_id_failed', detail: e.message });
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const info = db
      .prepare(
        `INSERT INTO users (role, worldu_id, email, username, password_hash)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(role, nullifier_hash, email, username, password_hash);

    const user = db.prepare('SELECT id, role, email, username FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const field = /worldu_id/.test(e.message)
        ? 'world_id_already_used'
        : /email/.test(e.message)
        ? 'email_taken'
        : /username/.test(e.message)
        ? 'username_taken'
        : 'conflict';
      return res.status(409).json({ error: field });
    }
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const token = signToken(user);
  return res.json({
    token,
    user: { id: user.id, role: user.role, email: user.email, username: user.username },
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, role, email, username, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  return res.json({ user });
});

module.exports = router;
