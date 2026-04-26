const express = require('express');
const bcrypt = require('bcrypt');
const { signRequest } = require('@worldcoin/idkit-server');
const db = require('../db');
const { verifyWorldId } = require('./verifyWorldId');
const { signToken, requireAuth } = require('./jwt');
const { recordAttempt } = require('../applicant/criticalChange');

const router = express.Router();

const ROLES = ['Applicant', 'Recruiter', 'Agent'];
const SIGNUP_ROLES = ['Applicant', 'Recruiter'];
const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

const PROFILE_TEXT_FIELDS = [
  'first_name',
  'middle_initial',
  'last_name',
  'preferred_name',
  'pronouns',
  'date_of_birth',
  'phone_number',
  'alternative_phone',
  'street_address',
  'apt_suite_unit',
  'city',
  'state',
  'zip_code',
];

const PROFILE_URL_FIELDS = ['linkedin_url', 'website_portfolio', 'github_or_other_portfolio'];

function worldIdLog(stage, details = {}) {
  try {
    console.log(`[WorldID][${stage}]`, details);
  } catch {
    // Logging should never break request handling.
  }
}

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

  // Pass through nested arrays/objects for sub-tables
  if (Array.isArray(raw.work_experience)) out.work_experience = raw.work_experience;
  if (Array.isArray(raw.education)) out.education = raw.education;
  if (Array.isArray(raw.skills)) out.skills = raw.skills;
  if (Array.isArray(raw.languages)) out.languages = raw.languages;
  if (Array.isArray(raw.references)) out.references = raw.references;
  if (raw.documents && typeof raw.documents === 'object') out.documents = raw.documents;
  if (raw.about_me && typeof raw.about_me === 'object') out.about_me = raw.about_me;
  if (raw.legal && typeof raw.legal === 'object') out.legal = raw.legal;
  if (raw.eeo && typeof raw.eeo === 'object') out.eeo = raw.eeo;

  return out;
}

router.get('/world-id-context', (req, res) => {
  const rawKey = (process.env.WORLD_ID_SIGNING_KEY || '').trim();
  const signingKeyHex = rawKey.startsWith('0x') ? rawKey.slice(2) : rawKey;
  const rp_id = process.env.WORLD_ID_RP_ID;
  const app_id = process.env.WORLD_ID_APP_ID;
  const action = process.env.WORLD_ID_ACTION || 'register';
  worldIdLog('context:start', {
    ip: req.ip,
    has_signing_key: !!signingKeyHex,
    has_rp_id: !!rp_id,
    has_app_id: !!app_id,
    action,
  });

  if (!signingKeyHex || !rp_id || !app_id) {
    worldIdLog('context:missing_config', {
      has_signing_key: !!signingKeyHex,
      has_rp_id: !!rp_id,
      has_app_id: !!app_id,
    });
    return res.status(500).json({ error: 'world_id_not_configured' });
  }

  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex, action });
    worldIdLog('context:ok', {
      ip: req.ip,
      action,
      nonce_prefix: typeof nonce === 'string' ? nonce.slice(0, 10) : null,
      expires_at: expiresAt,
    });
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
    worldIdLog('context:error', {
      ip: req.ip,
      message: e?.message || String(e),
    });
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
  worldIdLog('check:start', {
    ip: req.ip,
    has_result: !!world_id_result,
    has_merkle_root: !!world_id_result?.merkle_root,
    has_proof: !!world_id_result?.proof,
    responses_count: Array.isArray(world_id_result?.responses)
      ? world_id_result.responses.length
      : 0,
  });

  if (!world_id_result) {
    worldIdLog('check:missing_fields', { ip: req.ip });
    return res.status(400).json({ error: 'missing_fields' });
  }

  let nullifier_hash;
  let verification_level;
  try {
    ({ nullifier_hash, verification_level } = await verifyWorldId(world_id_result));
  } catch (e) {
    worldIdLog('check:verify_failed', {
      ip: req.ip,
      status: e?.status,
      code: e?.code,
      message: e?.message || String(e),
    });
    return res.status(e.status || 400).json({ error: 'world_id_failed', detail: e.message });
  }

  const existing = db
    .prepare('SELECT 1 FROM users WHERE worldu_id = ?')
    .get(nullifier_hash);
  if (existing) {
    worldIdLog('check:already_used', {
      ip: req.ip,
      verification_level,
      nullifier_prefix:
        typeof nullifier_hash === 'string' ? nullifier_hash.slice(0, 10) : null,
    });
    return res.status(409).json({ error: 'world_id_already_used' });
  }

  worldIdLog('check:ok', {
    ip: req.ip,
    verification_level,
    nullifier_prefix:
      typeof nullifier_hash === 'string' ? nullifier_hash.slice(0, 10) : null,
  });
  return res.json({ ok: true, verification_level });
});

router.post('/register', async (req, res) => {
  const { email, password, username, role, world_id_result, profile } = req.body || {};
  worldIdLog('register:start', {
    ip: req.ip,
    role,
    email,
    username,
    has_world_id_result: !!world_id_result,
    has_profile: !!profile,
  });

  if (!email || !password || !username || !role || !world_id_result) {
    worldIdLog('register:missing_fields', {
      ip: req.ip,
      role,
      email,
      username,
      has_world_id_result: !!world_id_result,
    });
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
  let verification_level;
  try {
    ({ nullifier_hash, verification_level } = await verifyWorldId(world_id_result));
  } catch (e) {
    worldIdLog('register:verify_failed', {
      ip: req.ip,
      role,
      email,
      username,
      status: e?.status,
      code: e?.code,
      message: e?.message || String(e),
    });
    return res.status(e.status || 400).json({ error: 'world_id_failed', detail: e.message });
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const txn = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO users (role, worldu_id, email, username, password_hash, verification_level)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(role, nullifier_hash, email, username, password_hash, verification_level);

      const userId = info.lastInsertRowid;

      if (role === 'Applicant' && cleanProfile) {
        // user_profiles (personal info + address)
        const profileCols = PROFILE_TEXT_FIELDS.concat(PROFILE_URL_FIELDS);
        db.prepare(
          `INSERT INTO user_profiles (user_id, ${profileCols.join(', ')})
           VALUES (@user_id, ${profileCols.map(c => '@' + c).join(', ')})`
        ).run({
          user_id: userId,
          ...Object.fromEntries(profileCols.map(c => [c, cleanProfile[c] ?? null])),
        });

        // documents
        if (cleanProfile.documents) {
          const d = cleanProfile.documents;
          db.prepare(
            `INSERT INTO user_documents (user_id, resume, writing_samples, portfolio_work_samples, transcripts, certifications, other_documents)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(
            userId,
            typeof d.resume === 'string' ? d.resume.trim() || null : null,
            Array.isArray(d.writing_samples) ? JSON.stringify(d.writing_samples) : null,
            Array.isArray(d.portfolio_work_samples) ? JSON.stringify(d.portfolio_work_samples) : null,
            Array.isArray(d.transcripts) ? JSON.stringify(d.transcripts) : null,
            Array.isArray(d.certifications) ? JSON.stringify(d.certifications) : null,
            Array.isArray(d.other_documents) ? JSON.stringify(d.other_documents) : null,
          );
        }

        // work_experience
        if (Array.isArray(cleanProfile.work_experience)) {
          const stmt = db.prepare(
            `INSERT INTO user_work_experience
               (user_id, job_title, company, city, state, employment_type, start_date, end_date, current_job, responsibilities, key_achievements)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          for (const w of cleanProfile.work_experience) {
            if (!w || typeof w !== 'object') continue;
            stmt.run(userId, w.job_title||null, w.company||null, w.city||null, w.state||null,
              w.employment_type||null, w.start_date||null, w.end_date||null,
              w.current_job ? 1 : 0, w.responsibilities||null, w.key_achievements||null);
          }
        }

        // education
        if (Array.isArray(cleanProfile.education)) {
          const stmt = db.prepare(
            `INSERT INTO user_education
               (user_id, school, city, state, degree, major, minor, start_date, graduation_date, graduated, gpa, honors, relevant_coursework)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          for (const e of cleanProfile.education) {
            if (!e || typeof e !== 'object') continue;
            stmt.run(userId, e.school||null, e.city||null, e.state||null, e.degree||null,
              e.major||null, e.minor||null, e.start_date||null, e.graduation_date||null,
              e.graduated ? 1 : 0, e.gpa||null, e.honors||null,
              Array.isArray(e.relevant_coursework) ? JSON.stringify(e.relevant_coursework) : null);
          }
        }

        // skills
        if (Array.isArray(cleanProfile.skills)) {
          const stmt = db.prepare(
            `INSERT INTO user_skills (user_id, skill, proficiency, years) VALUES (?, ?, ?, ?)`
          );
          for (const s of cleanProfile.skills) {
            if (!s || typeof s !== 'object' || !s.skill) continue;
            stmt.run(userId, s.skill, s.proficiency||null, s.years != null ? Number(s.years) : null);
          }
        }

        // languages
        if (Array.isArray(cleanProfile.languages)) {
          const stmt = db.prepare(
            `INSERT INTO user_languages (user_id, language, proficiency) VALUES (?, ?, ?)`
          );
          for (const l of cleanProfile.languages) {
            if (!l || typeof l !== 'object' || !l.language) continue;
            stmt.run(userId, l.language, l.proficiency||null);
          }
        }

        // references
        if (Array.isArray(cleanProfile.references)) {
          const stmt = db.prepare(
            `INSERT INTO user_references (user_id, name, relationship, company, title, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)`
          );
          for (const r of cleanProfile.references) {
            if (!r || typeof r !== 'object') continue;
            stmt.run(userId, r.name||null, r.relationship||null, r.company||null, r.title||null, r.phone||null, r.email||null);
          }
        }

        // about_me
        if (cleanProfile.about_me) {
          const a = cleanProfile.about_me;
          db.prepare(
            `INSERT INTO user_about_me (user_id, challenge_you_overcame, greatest_strength, greatest_weakness, five_year_goals, leadership_experience, anything_else)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(userId, a.challenge_you_overcame||null, a.greatest_strength||null, a.greatest_weakness||null,
            a.five_year_goals||null, a.leadership_experience||null, a.anything_else||null);
        }

        // legal
        if (cleanProfile.legal) {
          const l = cleanProfile.legal;
          db.prepare(
            `INSERT INTO user_legal (user_id, us_work_authorization, requires_sponsorship, visa_type, over_18, security_clearance, needs_accommodation)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(userId, l.us_work_authorization ? 1 : 0, l.requires_sponsorship ? 1 : 0,
            l.visa_type||null, l.over_18 ? 1 : 0, l.security_clearance||null, l.needs_accommodation ? 1 : 0);
        }

        // eeo
        if (cleanProfile.eeo) {
          const e = cleanProfile.eeo;
          db.prepare(
            `INSERT INTO user_eeo (user_id, gender, race_ethnicity, disability_status, veteran_status)
             VALUES (?, ?, ?, ?, ?)`
          ).run(userId, e.gender||null, e.race_ethnicity||null, e.disability_status||null, e.veteran_status||null);
        }
      }

      // Seed a baseline entry in profile_change_log for applicants so that
      // the very first PATCH /applicant/profile that touches a critical
      // field goes through Gemini review (instead of being auto-approved as
      // a "no prior history" baseline). The signup payload is the truth we
      // compare future critical edits against.
      if (role === 'Applicant') {
        recordAttempt({
          userId,
          decision: 'approved',
          diff: { changes: [] },
          agentDecision: null,
          agentReasoning: 'Signup baseline.',
        });
      }

      return userId;
    });

    const userId = txn();

    const user = db
      .prepare('SELECT id, role, email, username, verification_level, trust_score FROM users WHERE id = ?')
      .get(userId);
    worldIdLog('register:ok', {
      ip: req.ip,
      user_id: userId,
      role: user?.role,
      email: user?.email,
      username: user?.username,
      verification_level,
    });
    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      worldIdLog('register:unique_conflict', {
        ip: req.ip,
        role,
        email,
        username,
        message: e?.message || String(e),
      });
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
    worldIdLog('register:error', {
      ip: req.ip,
      role,
      email,
      username,
      message: e?.message || String(e),
    });
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
    user: {
      id: user.id,
      role: user.role,
      email: user.email,
      username: user.username,
      verification_level: user.verification_level,
      trust_score: user.trust_score,
    },
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, role, email, username, created_at, verification_level, trust_score FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.status(401).json({ error: 'user_not_found' });
  return res.json({ user });
});

module.exports = router;
