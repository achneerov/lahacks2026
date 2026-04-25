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
const URL_RE = /^https?:\/\/[^\s]+$/i;

const PROFILE_TEXT_FIELDS = [
  'full_name',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postal_code',
  'country',
  'headline',
  'bio',
];

const PROFILE_URL_FIELDS = ['resume_url', 'linkedin_url', 'github_url', 'portfolio_url'];

function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const out = {};

  for (const key of PROFILE_TEXT_FIELDS) {
    const v = raw[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') {
      const err = new Error(`profile.${key} must be a string`);
      err.code = 'invalid_profile';
      throw err;
    }
    const trimmed = v.trim();
    out[key] = trimmed === '' ? null : trimmed;
  }

  for (const key of PROFILE_URL_FIELDS) {
    const v = raw[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') {
      const err = new Error(`profile.${key} must be a string`);
      err.code = 'invalid_profile';
      throw err;
    }
    const trimmed = v.trim();
    if (trimmed === '') {
      out[key] = null;
      continue;
    }
    if (!URL_RE.test(trimmed)) {
      const err = new Error(`profile.${key} must be an http(s) URL`);
      err.code = 'invalid_profile_url';
      throw err;
    }
    out[key] = trimmed;
  }

  if (raw.years_experience !== undefined && raw.years_experience !== null && raw.years_experience !== '') {
    const n = Number(raw.years_experience);
    if (!Number.isInteger(n) || n < 0 || n > 80) {
      const err = new Error('profile.years_experience must be an integer between 0 and 80');
      err.code = 'invalid_profile_years';
      throw err;
    }
    out.years_experience = n;
  } else {
    out.years_experience = null;
  }

  return out;
}

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

router.post('/signup/check-world-id', async (req, res) => {
  const { world_id_result } = req.body || {};

  if (!world_id_result) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  let nullifier_hash;
  try {
    ({ nullifier_hash } = await verifyWorldId(world_id_result));
  } catch (e) {
    return res.status(e.status || 400).json({ error: 'world_id_failed', detail: e.message });
  }

  const existing = db
    .prepare('SELECT 1 FROM users WHERE worldu_id = ?')
    .get(nullifier_hash);
  if (existing) {
    return res.status(409).json({ error: 'world_id_already_used' });
  }

  return res.json({ ok: true });
});

router.post('/register', async (req, res) => {
  const { email, password, username, role, world_id_result, profile } = req.body || {};

  if (!email || !password || !username || !role || !world_id_result) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'invalid_role' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password_too_short' });
  }

  let cleanProfile = null;
  if (role === 'Applicant' && profile !== undefined && profile !== null) {
    try {
      cleanProfile = sanitizeProfile(profile);
    } catch (e) {
      return res.status(400).json({ error: e.code || 'invalid_profile', detail: e.message });
    }
  }

  let nullifier_hash;
  try {
    ({ nullifier_hash } = await verifyWorldId(world_id_result));
  } catch (e) {
    return res.status(e.status || 400).json({ error: 'world_id_failed', detail: e.message });
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const txn = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO users (role, worldu_id, email, username, password_hash)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(role, nullifier_hash, email, username, password_hash);

      const userId = info.lastInsertRowid;

      if (role === 'Applicant' && cleanProfile) {
        db.prepare(
          `INSERT INTO user_profiles (
             user_id, full_name, phone,
             address_line1, address_line2, city, state, postal_code, country,
             headline, bio, resume_url, linkedin_url, github_url, portfolio_url,
             years_experience
           ) VALUES (
             @user_id, @full_name, @phone,
             @address_line1, @address_line2, @city, @state, @postal_code, @country,
             @headline, @bio, @resume_url, @linkedin_url, @github_url, @portfolio_url,
             @years_experience
           )`
        ).run({
          user_id: userId,
          full_name: cleanProfile.full_name ?? null,
          phone: cleanProfile.phone ?? null,
          address_line1: cleanProfile.address_line1 ?? null,
          address_line2: cleanProfile.address_line2 ?? null,
          city: cleanProfile.city ?? null,
          state: cleanProfile.state ?? null,
          postal_code: cleanProfile.postal_code ?? null,
          country: cleanProfile.country ?? null,
          headline: cleanProfile.headline ?? null,
          bio: cleanProfile.bio ?? null,
          resume_url: cleanProfile.resume_url ?? null,
          linkedin_url: cleanProfile.linkedin_url ?? null,
          github_url: cleanProfile.github_url ?? null,
          portfolio_url: cleanProfile.portfolio_url ?? null,
          years_experience: cleanProfile.years_experience ?? null,
        });
      }

      return userId;
    });

    const userId = txn();

    const user = db
      .prepare('SELECT id, role, email, username FROM users WHERE id = ?')
      .get(userId);
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
