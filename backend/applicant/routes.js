const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth/jwt');
const { reviewProfileChanges } = require('./profileReview');
const {
  computeCriticalDiff,
  loadHistory,
  recordAttempt,
  loadLockState,
  lockUser,
} = require('./criticalChange');
const { reviewCriticalChange } = require('../agents/profile-credibility');
const {
  insertMessage,
  setInterviewStatus,
  applyTrustFeedbackDelta,
  markConversationReadThrough,
} = require('../messaging');
const { RECRUITER_RATING_QUESTIONS } = require('../messaging/trustQuestions');
const { verifyWorldId } = require('../auth/verifyWorldId');

const router = express.Router();

function parseJsonOrNull(raw) {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function computeInterviewGateState(convo) {
  if (!convo) return 'none';
  if (convo.interview_status === 'complete') return 'complete';
  if (convo.interview_status === 'scheduled') return 'scheduled';
  if (convo.interview_status === 'availability_proposed') return 'availability_received';
  if (
    convo.interview_status === 'requested' &&
    Number(convo.invite_requires_identity) === 1 &&
    !convo.invite_identity_verified_at
  ) {
    return 'awaiting_identity';
  }
  if (convo.interview_status === 'requested') return 'awaiting_availability';
  return 'none';
}

const PROFILE_COLS = [
  'first_name', 'middle_initial', 'last_name', 'preferred_name', 'pronouns',
  'date_of_birth', 'phone_number', 'alternative_phone',
  'street_address', 'apt_suite_unit', 'city', 'state', 'zip_code',
  'linkedin_url', 'website_portfolio', 'github_or_other_portfolio',
];

const PROFILE_TEXT_FIELDS = [
  'first_name', 'middle_initial', 'last_name', 'preferred_name', 'pronouns',
  'date_of_birth', 'phone_number', 'alternative_phone',
  'street_address', 'apt_suite_unit', 'city', 'state', 'zip_code',
];

const PROFILE_URL_FIELDS = ['linkedin_url', 'website_portfolio', 'github_or_other_portfolio'];
const URL_RE = /^https?:\/\/[^\s]+$/i;

function requireApplicant(req, res, next) {
  if (!req.user || req.user.role !== 'Applicant') {
    return res.status(403).json({ error: 'applicant_only' });
  }
  next();
}

function sanitizeProfileUpdate(raw) {
  if (!raw || typeof raw !== 'object') {
    const err = new Error('profile body must be an object');
    err.code = 'invalid_profile';
    throw err;
  }
  const out = {};
  for (const key of PROFILE_TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const v = raw[key];
    if (v === null || v === undefined) { out[key] = null; continue; }
    if (typeof v !== 'string') { const e = new Error(`profile.${key} must be a string`); e.code = 'invalid_profile'; throw e; }
    const trimmed = v.trim();
    out[key] = trimmed === '' ? null : trimmed;
  }
  for (const key of PROFILE_URL_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const v = raw[key];
    if (v === null || v === undefined) { out[key] = null; continue; }
    if (typeof v !== 'string') { const e = new Error(`profile.${key} must be a string`); e.code = 'invalid_profile'; throw e; }
    const trimmed = v.trim();
    if (trimmed === '') { out[key] = null; continue; }
    if (!URL_RE.test(trimmed)) { const e = new Error(`profile.${key} must be an http(s) URL`); e.code = 'invalid_profile_url'; throw e; }
    out[key] = trimmed;
  }
  // Pass through sub-table data
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

function loadFullProfile(userId) {
  const profile = db.prepare(`SELECT ${PROFILE_COLS.join(', ')}, updated_at FROM user_profiles WHERE user_id = ?`).get(userId);
  const documents = db.prepare('SELECT resume, writing_samples, portfolio_work_samples, transcripts, certifications, other_documents FROM user_documents WHERE user_id = ?').get(userId);
  const work_experience = db.prepare('SELECT id, job_title, company, city, state, employment_type, start_date, end_date, current_job, responsibilities, key_achievements FROM user_work_experience WHERE user_id = ? ORDER BY id').all(userId);
  const education = db.prepare('SELECT id, school, city, state, degree, major, minor, start_date, graduation_date, graduated, gpa, honors, relevant_coursework FROM user_education WHERE user_id = ? ORDER BY id').all(userId);
  const skills = db.prepare('SELECT id, skill, proficiency, years FROM user_skills WHERE user_id = ? ORDER BY id').all(userId);
  const languages = db.prepare('SELECT id, language, proficiency FROM user_languages WHERE user_id = ? ORDER BY id').all(userId);
  const references = db.prepare('SELECT id, name, relationship, company, title, phone, email FROM user_references WHERE user_id = ? ORDER BY id').all(userId);
  const about_me = db.prepare('SELECT challenge_you_overcame, greatest_strength, greatest_weakness, five_year_goals, leadership_experience, anything_else FROM user_about_me WHERE user_id = ?').get(userId);
  const legal = db.prepare('SELECT us_work_authorization, requires_sponsorship, visa_type, over_18, security_clearance, needs_accommodation FROM user_legal WHERE user_id = ?').get(userId);
  const eeo = db.prepare('SELECT gender, race_ethnicity, disability_status, veteran_status FROM user_eeo WHERE user_id = ?').get(userId);

  // Parse JSON arrays
  for (const e of education) {
    try { e.relevant_coursework = e.relevant_coursework ? JSON.parse(e.relevant_coursework) : []; } catch { e.relevant_coursework = []; }
  }
  const docs = documents ? {
    resume: documents.resume,
    writing_samples: tryParseJson(documents.writing_samples, []),
    portfolio_work_samples: tryParseJson(documents.portfolio_work_samples, []),
    transcripts: tryParseJson(documents.transcripts, []),
    certifications: tryParseJson(documents.certifications, []),
    other_documents: tryParseJson(documents.other_documents, []),
  } : null;

  return {
    personal_information: profile || Object.fromEntries(PROFILE_COLS.map(c => [c, null])),
    documents: docs,
    work_experience,
    education,
    skills,
    languages,
    references,
    about_me: about_me || null,
    legal: legal || null,
    eeo: eeo || null,
  };
}

function tryParseJson(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function ensureProfileRow(userId) {
  const existing = db.prepare('SELECT 1 FROM user_profiles WHERE user_id = ?').get(userId);
  if (!existing) db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(userId);
}

function computeProfileCompleteness(userId) {
  const profile = db.prepare(`SELECT ${PROFILE_COLS.join(', ')} FROM user_profiles WHERE user_id = ?`).get(userId);
  if (!profile) return 0;
  const requiredFields = ['first_name', 'last_name', 'phone_number', 'street_address', 'city', 'state', 'zip_code'];
  let filled = 0;
  let total = requiredFields.length + 4; // +4 for having at least one: work_exp, education, skill, about_me
  for (const f of requiredFields) {
    if (profile[f]) filled++;
  }
  const hasWork = db.prepare('SELECT 1 FROM user_work_experience WHERE user_id = ? LIMIT 1').get(userId);
  const hasEdu = db.prepare('SELECT 1 FROM user_education WHERE user_id = ? LIMIT 1').get(userId);
  const hasSkill = db.prepare('SELECT 1 FROM user_skills WHERE user_id = ? LIMIT 1').get(userId);
  const hasAbout = db.prepare('SELECT 1 FROM user_about_me WHERE user_id = ? LIMIT 1').get(userId);
  if (hasWork) filled++;
  if (hasEdu) filled++;
  if (hasSkill) filled++;
  if (hasAbout) filled++;
  return Math.round((filled / total) * 100);
}

function upsertSubTables(userId, clean) {
  // documents
  if (clean.documents) {
    const d = clean.documents;
    db.prepare('DELETE FROM user_documents WHERE user_id = ?').run(userId);
    db.prepare(
      `INSERT INTO user_documents (user_id, resume, writing_samples, portfolio_work_samples, transcripts, certifications, other_documents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId,
      typeof d.resume === 'string' ? d.resume.trim() || null : null,
      Array.isArray(d.writing_samples) ? JSON.stringify(d.writing_samples) : null,
      Array.isArray(d.portfolio_work_samples) ? JSON.stringify(d.portfolio_work_samples) : null,
      Array.isArray(d.transcripts) ? JSON.stringify(d.transcripts) : null,
      Array.isArray(d.certifications) ? JSON.stringify(d.certifications) : null,
      Array.isArray(d.other_documents) ? JSON.stringify(d.other_documents) : null,
    );
  }

  // work_experience — replace all
  if (clean.work_experience) {
    db.prepare('DELETE FROM user_work_experience WHERE user_id = ?').run(userId);
    const stmt = db.prepare(
      `INSERT INTO user_work_experience (user_id, job_title, company, city, state, employment_type, start_date, end_date, current_job, responsibilities, key_achievements)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const w of clean.work_experience) {
      if (!w || typeof w !== 'object') continue;
      stmt.run(userId, w.job_title||null, w.company||null, w.city||null, w.state||null,
        w.employment_type||null, w.start_date||null, w.end_date||null,
        w.current_job ? 1 : 0, w.responsibilities||null, w.key_achievements||null);
    }
  }

  // education — replace all
  if (clean.education) {
    db.prepare('DELETE FROM user_education WHERE user_id = ?').run(userId);
    const stmt = db.prepare(
      `INSERT INTO user_education (user_id, school, city, state, degree, major, minor, start_date, graduation_date, graduated, gpa, honors, relevant_coursework)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const e of clean.education) {
      if (!e || typeof e !== 'object') continue;
      stmt.run(userId, e.school||null, e.city||null, e.state||null, e.degree||null,
        e.major||null, e.minor||null, e.start_date||null, e.graduation_date||null,
        e.graduated ? 1 : 0, e.gpa||null, e.honors||null,
        Array.isArray(e.relevant_coursework) ? JSON.stringify(e.relevant_coursework) : null);
    }
  }

  // skills — replace all
  if (clean.skills) {
    db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(userId);
    const stmt = db.prepare('INSERT INTO user_skills (user_id, skill, proficiency, years) VALUES (?, ?, ?, ?)');
    for (const s of clean.skills) {
      if (!s || typeof s !== 'object' || !s.skill) continue;
      stmt.run(userId, s.skill, s.proficiency||null, s.years != null ? Number(s.years) : null);
    }
  }

  // languages — replace all
  if (clean.languages) {
    db.prepare('DELETE FROM user_languages WHERE user_id = ?').run(userId);
    const stmt = db.prepare('INSERT INTO user_languages (user_id, language, proficiency) VALUES (?, ?, ?)');
    for (const l of clean.languages) {
      if (!l || typeof l !== 'object' || !l.language) continue;
      stmt.run(userId, l.language, l.proficiency||null);
    }
  }

  // references — replace all
  if (clean.references) {
    db.prepare('DELETE FROM user_references WHERE user_id = ?').run(userId);
    const stmt = db.prepare('INSERT INTO user_references (user_id, name, relationship, company, title, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const r of clean.references) {
      if (!r || typeof r !== 'object') continue;
      stmt.run(userId, r.name||null, r.relationship||null, r.company||null, r.title||null, r.phone||null, r.email||null);
    }
  }

  // about_me — upsert
  if (clean.about_me) {
    const a = clean.about_me;
    db.prepare('DELETE FROM user_about_me WHERE user_id = ?').run(userId);
    db.prepare(
      `INSERT INTO user_about_me (user_id, challenge_you_overcame, greatest_strength, greatest_weakness, five_year_goals, leadership_experience, anything_else)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, a.challenge_you_overcame||null, a.greatest_strength||null, a.greatest_weakness||null,
      a.five_year_goals||null, a.leadership_experience||null, a.anything_else||null);
  }

  // legal — upsert
  if (clean.legal) {
    const l = clean.legal;
    db.prepare('DELETE FROM user_legal WHERE user_id = ?').run(userId);
    db.prepare(
      `INSERT INTO user_legal (user_id, us_work_authorization, requires_sponsorship, visa_type, over_18, security_clearance, needs_accommodation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, l.us_work_authorization ? 1 : 0, l.requires_sponsorship ? 1 : 0,
      l.visa_type||null, l.over_18 ? 1 : 0, l.security_clearance||null, l.needs_accommodation ? 1 : 0);
  }

  // eeo — upsert
  if (clean.eeo) {
    const e = clean.eeo;
    db.prepare('DELETE FROM user_eeo WHERE user_id = ?').run(userId);
    db.prepare(
      `INSERT INTO user_eeo (user_id, gender, race_ethnicity, disability_status, veteran_status) VALUES (?, ?, ?, ?, ?)`
    ).run(userId, e.gender||null, e.race_ethnicity||null, e.disability_status||null, e.veteran_status||null);
  }
}

router.get('/profile', requireAuth, requireApplicant, (req, res) => {
  try {
    return res.json({
      profile: loadFullProfile(req.user.id),
      lock: loadLockState(req.user.id),
    });
  } catch (e) {
    console.error('[applicant/profile GET]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/profile/review', requireAuth, requireApplicant, async (req, res) => {
  let clean;
  try {
    clean = sanitizeProfileUpdate(req.body?.profile);
  } catch (e) {
    return res.status(400).json({ error: e.code || 'invalid_profile', detail: e.message });
  }
  try {
    const current = loadFullProfile(req.user.id);
    const result = await reviewProfileChanges(current, clean);
    return res.json(result);
  } catch (e) {
    console.error('[applicant/profile/review]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

function applyProfileWrite(userId, clean) {
  ensureProfileRow(userId);
  const flatKeys = Object.keys(clean).filter((k) => PROFILE_COLS.includes(k));
  if (flatKeys.length > 0) {
    const setSql = flatKeys.map((k) => `${k} = @${k}`).join(', ');
    db.prepare(
      `UPDATE user_profiles SET ${setSql}, updated_at = datetime('now') WHERE user_id = @user_id`
    ).run({
      ...Object.fromEntries(flatKeys.map((k) => [k, clean[k]])),
      user_id: userId,
    });
  }
  upsertSubTables(userId, clean);
}

router.patch('/profile', requireAuth, requireApplicant, async (req, res) => {
  const userId = req.user.id;
  let clean;
  try {
    clean = sanitizeProfileUpdate(req.body?.profile);
  } catch (e) {
    return res.status(400).json({ error: e.code || 'invalid_profile', detail: e.message });
  }

  try {
    const currentProfile = loadFullProfile(userId);
    const lockState = loadLockState(userId);
    const { changes } = computeCriticalDiff(currentProfile, clean);
    const hasCriticalChanges = changes.length > 0;

    // Lock blocks ONLY further critical edits. Non-critical saves still go
    // through so the user can still update non-credibility fields (name,
    // address, about_me, etc.) while waiting on a human review.
    if (lockState.locked && hasCriticalChanges) {
      return res.status(403).json({
        error: 'profile_locked',
        detail:
          lockState.reason ||
          'Your profile is locked pending human review and further changes to links, work experience, or education are blocked.',
        lock: lockState,
      });
    }

    // No critical changes => skip Gemini, save normally, no audit log entry.
    if (!hasCriticalChanges) {
      applyProfileWrite(userId, clean);
      return res.json({
        profile: loadFullProfile(userId),
        lock: loadLockState(userId),
      });
    }

    // Real review path: ask Gemini.
    let verdict;
    try {
      verdict = await reviewCriticalChange({
        currentProfile,
        diff: { changes },
        history: loadHistory(userId),
      });
    } catch (err) {
      // Fail closed: reject the save with an error, but DO NOT lock the user.
      // No fraud verdict was reached.
      console.error('[applicant/profile PATCH] credibility review failed:', err);
      return res.status(503).json({
        error: 'review_unavailable',
        detail:
          'Profile credibility review is temporarily unavailable. Please try saving again in a moment.',
      });
    }

    if (verdict.verdict === 'decline') {
      recordAttempt({
        userId,
        decision: 'rejected',
        diff: { changes },
        agentDecision: 'decline',
        agentReasoning: verdict.reasoning,
      });
      lockUser(userId, verdict.reasoning);
      return res.status(409).json({
        error: 'profile_change_rejected',
        detail: verdict.reasoning,
        lock: loadLockState(userId),
      });
    }

    applyProfileWrite(userId, clean);
    recordAttempt({
      userId,
      decision: 'approved',
      diff: { changes },
      agentDecision: 'approve',
      agentReasoning: verdict.reasoning,
    });
    return res.json({
      profile: loadFullProfile(userId),
      lock: loadLockState(userId),
    });
  } catch (e) {
    console.error('[applicant/profile PATCH]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/home', requireAuth, requireApplicant, (req, res) => {
  const userId = req.user.id;

  try {
    const profile_completeness = computeProfileCompleteness(userId);

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

    const { open_jobs } = db
      .prepare(
        `SELECT COUNT(*) AS open_jobs
           FROM job_postings
          WHERE is_active = 1
            AND id NOT IN (SELECT job_posting_id FROM applications WHERE applicant_id = ?)`
      )
      .get(userId);

    const recentRows = db
      .prepare(
        `SELECT
           c.id                                             AS id,
           c.job_posting_id                                 AS job_posting_id,
           c.created_at                                     AS created_at,
           CASE WHEN c.user_1_id = ? THEN c.user_2_id
                                     ELSE c.user_1_id END   AS other_user_id,
           jp.title                                         AS job_title,
           (SELECT m.conversation_content
              FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC
             LIMIT 1)                                       AS last_message,
           (SELECT m.created_at
              FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC
             LIMIT 1)                                       AS last_message_at
         FROM conversations c
         LEFT JOIN job_postings jp ON jp.id = c.job_posting_id
         WHERE c.active = 1 AND (c.user_1_id = ? OR c.user_2_id = ?)
         ORDER BY COALESCE(
           (SELECT m.created_at FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.conversation_index DESC LIMIT 1),
           c.created_at
         ) DESC
         LIMIT 5`
      )
      .all(userId, userId, userId);

    const otherIds = [...new Set(recentRows.map((r) => r.other_user_id))];
    const otherUsers = otherIds.length
      ? db
          .prepare(
            `SELECT id, username, role
               FROM users
              WHERE id IN (${otherIds.map(() => '?').join(',')})`
          )
          .all(...otherIds)
      : [];
    const otherById = new Map(otherUsers.map((u) => [u.id, u]));

    const recent_conversations = recentRows.map((r) => ({
      id: r.id,
      job_posting_id: r.job_posting_id,
      job_title: r.job_title,
      other_party: otherById.get(r.other_user_id) || {
        id: r.other_user_id,
        username: 'unknown',
        role: 'Unknown',
      },
      last_message: r.last_message,
      last_message_at: r.last_message_at,
      created_at: r.created_at,
    }));

    const featured_jobs = db
      .prepare(
        `SELECT
           jp.id, jp.title, jp.company, jp.location, jp.remote,
           jp.employment_type, jp.salary_min, jp.salary_max, jp.salary_currency,
           jp.created_at,
           u.username AS poster_username
         FROM job_postings jp
         JOIN users u ON u.id = jp.poster_id
         WHERE jp.is_active = 1
           AND jp.id NOT IN (SELECT job_posting_id FROM applications WHERE applicant_id = ?)
         ORDER BY jp.created_at DESC
         LIMIT 5`
      )
      .all(userId);

    return res.json({
      stats: {
        profile_completeness,
        active_conversations,
        messages_received,
        open_jobs,
      },
      recent_conversations,
      featured_jobs,
    });
  } catch (e) {
    console.error('[applicant/home]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/jobs', requireAuth, requireApplicant, (req, res) => {
  try {
    const { q, employment_type, remote, location, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 50));
    const offset = Math.max(0, parseInt(rawOffset, 10) || 0);
    const where = ['jp.is_active = 1'];
    const params = [];

    // Filter out jobs the applicant has already applied to
    where.push(
      `jp.id NOT IN (SELECT job_posting_id FROM applications WHERE applicant_id = ?)`
    );
    params.push(req.user.id);

    if (q && typeof q === 'string' && q.trim() !== '') {
      const like = `%${q.trim()}%`;
      where.push('(jp.title LIKE ? OR jp.company LIKE ? OR jp.description LIKE ?)');
      params.push(like, like, like);
    }
    if (employment_type && typeof employment_type === 'string') {
      const allowed = ['FullTime', 'PartTime', 'Contract', 'Internship', 'Temporary'];
      if (allowed.includes(employment_type)) { where.push('jp.employment_type = ?'); params.push(employment_type); }
    }
    if (remote === '1' || remote === 'true') where.push('jp.remote = 1');
    else if (remote === '0' || remote === 'false') where.push('jp.remote = 0');
    if (location && typeof location === 'string' && location.trim() !== '') {
      where.push('jp.location LIKE ?'); params.push(`%${location.trim()}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM job_postings jp ${whereSql}`).get(...params);
    const jobs = db.prepare(
      `SELECT jp.id, jp.title, jp.company, jp.description, jp.location, jp.remote,
              jp.employment_type, jp.salary_min, jp.salary_max, jp.salary_currency, jp.created_at,
              jp.min_verification_level,
              u.username AS poster_username
         FROM job_postings jp JOIN users u ON u.id = jp.poster_id ${whereSql}
         ORDER BY jp.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);
    return res.json({ total, limit, offset, jobs });
  } catch (e) {
    console.error('[applicant/jobs]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

const APPLICATION_STATUSES = ['Pending', 'Declined', 'SentToRecruiter'];

router.get('/applications', requireAuth, requireApplicant, (req, res) => {
  try {
    const userId = req.user.id;
    const { q, status, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 50));
    const offset = Math.max(0, parseInt(rawOffset, 10) || 0);
    const where = ['a.applicant_id = ?'];
    const params = [userId];
    if (status && typeof status === 'string') {
      const list = status.split(',').map(s => s.trim()).filter(s => APPLICATION_STATUSES.includes(s));
      if (list.length > 0) { where.push(`a.status IN (${list.map(() => '?').join(',')})`); params.push(...list); }
    }
    if (q && typeof q === 'string' && q.trim() !== '') {
      const like = `%${q.trim()}%`;
      where.push('(jp.title LIKE ? OR jp.company LIKE ? OR jp.location LIKE ? OR u.username LIKE ?)');
      params.push(like, like, like, like);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM applications a JOIN job_postings jp ON jp.id = a.job_posting_id JOIN users u ON u.id = jp.poster_id ${whereSql}`).get(...params);
    const counts = db.prepare('SELECT a.status AS status, COUNT(*) AS n FROM applications a WHERE a.applicant_id = ? GROUP BY a.status').all(userId);
    const status_counts = { Pending: 0, Declined: 0, SentToRecruiter: 0 };
    for (const row of counts) status_counts[row.status] = row.n;
    const applications = db.prepare(
      `SELECT a.id, a.status, a.notes, a.created_at AS applied_at, a.updated_at,
              jp.id AS job_id, jp.title AS job_title, jp.company, jp.location, jp.remote,
              jp.employment_type, jp.salary_min, jp.salary_max, jp.salary_currency, jp.is_active AS job_is_active,
              u.username AS poster_username
         FROM applications a JOIN job_postings jp ON jp.id = a.job_posting_id JOIN users u ON u.id = jp.poster_id
         ${whereSql} ORDER BY a.updated_at DESC, a.id DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset).map(r => ({
      id: r.id, status: r.status, notes: r.notes, applied_at: r.applied_at, updated_at: r.updated_at,
      job: { id: r.job_id, title: r.job_title, company: r.company, location: r.location, remote: r.remote,
        employment_type: r.employment_type, salary_min: r.salary_min, salary_max: r.salary_max,
        salary_currency: r.salary_currency, is_active: r.job_is_active, poster_username: r.poster_username },
    }));
    return res.json({ total, limit, offset, status_counts, applications });
  } catch (e) {
    console.error('[applicant/applications]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/conversations', requireAuth, requireApplicant, (req, res) => {
  try {
    const userId = req.user.id;
    const { q, active: activeRaw } = req.query;
    const where = ['(c.user_1_id = ? OR c.user_2_id = ?)'];
    const params = [userId, userId];
    if (activeRaw === '1' || activeRaw === 'true') where.push('c.active = 1');
    else if (activeRaw === '0' || activeRaw === 'false') where.push('c.active = 0');
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const rows = db.prepare(
      `SELECT c.id, c.job_posting_id, c.active, c.created_at,
              CASE WHEN c.user_1_id = ? THEN c.user_2_id ELSE c.user_1_id END AS other_user_id,
              jp.title AS job_title, jp.company AS job_company,
              (SELECT m.conversation_content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.conversation_index DESC LIMIT 1) AS last_message,
              (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.conversation_index DESC LIMIT 1) AS last_message_at,
              (SELECT m.user_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.conversation_index DESC LIMIT 1) AS last_message_user_id,
              (SELECT COUNT(*)
                 FROM messages um
                WHERE um.conversation_id = c.id
                  AND um.user_id <> ?
                  AND um.conversation_index > COALESCE(
                    (SELECT crs.last_read_index
                       FROM conversation_read_states crs
                      WHERE crs.conversation_id = c.id
                        AND crs.user_id = ?),
                    -1
                  )) AS unread_count
         FROM conversations c LEFT JOIN job_postings jp ON jp.id = c.job_posting_id ${whereSql}
         ORDER BY COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.conversation_index DESC LIMIT 1), c.created_at) DESC`
    ).all(userId, userId, userId, ...params);
    const otherIds = [...new Set(rows.map(r => r.other_user_id))];
    const otherUsers = otherIds.length ? db.prepare(`SELECT id, username, role FROM users WHERE id IN (${otherIds.map(() => '?').join(',')})`).all(...otherIds) : [];
    const otherById = new Map(otherUsers.map(u => [u.id, u]));
    let conversations = rows.map(r => ({
      id: r.id, job_posting_id: r.job_posting_id, job_title: r.job_title, job_company: r.job_company,
      active: r.active, created_at: r.created_at, last_message: r.last_message, last_message_at: r.last_message_at,
      last_message_from_me: r.last_message_user_id != null ? r.last_message_user_id === userId : null,
      unread_count: Number.isFinite(Number(r.unread_count)) ? Number(r.unread_count) : 0,
      other_party: otherById.get(r.other_user_id) || { id: r.other_user_id, username: 'unknown', role: 'Unknown' },
    }));
    if (q && typeof q === 'string' && q.trim() !== '') {
      const needle = q.trim().toLowerCase();
      conversations = conversations.filter(c =>
        c.other_party.username.toLowerCase().includes(needle) ||
        (c.job_title && c.job_title.toLowerCase().includes(needle)) ||
        (c.job_company && c.job_company.toLowerCase().includes(needle)) ||
        (c.last_message && c.last_message.toLowerCase().includes(needle))
      );
    }
    return res.json({ conversations });
  } catch (e) {
    console.error('[applicant/conversations]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

function loadConversationForUser(conversationId, userId) {
  return db.prepare(
    `SELECT c.id, c.user_1_id, c.user_2_id, c.job_posting_id, c.active,
            c.interview_status, c.invite_requires_identity, c.invite_identity_verified_at,
            c.created_at,
            jp.title AS job_title, jp.company AS job_company
       FROM conversations c LEFT JOIN job_postings jp ON jp.id = c.job_posting_id
      WHERE c.id = ? AND (c.user_1_id = ? OR c.user_2_id = ?)`
  ).get(conversationId, userId, userId);
}

router.get('/conversations/:id/messages', requireAuth, requireApplicant, (req, res) => {
  const userId = req.user.id;
  const conversationId = parseInt(req.params.id, 10);
  if (!Number.isInteger(conversationId) || conversationId <= 0) return res.status(400).json({ error: 'invalid_conversation_id' });
  try {
    const convo = db.prepare(
      `SELECT c.id, c.user_1_id, c.user_2_id, c.job_posting_id, c.active,
              c.interview_status, c.invite_requires_identity, c.invite_identity_verified_at,
              c.closed_at, c.created_at,
              jp.title AS job_title, jp.company AS job_company
         FROM conversations c LEFT JOIN job_postings jp ON jp.id = c.job_posting_id
        WHERE c.id = ? AND (c.user_1_id = ? OR c.user_2_id = ?)`
    ).get(conversationId, userId, userId);
    if (!convo) return res.status(404).json({ error: 'not_found' });
    const otherUserId = convo.user_1_id === userId ? convo.user_2_id : convo.user_1_id;
    const otherParty = db.prepare(
      `SELECT u.id, u.username, u.role, u.verification_level, u.trust_score,
              up.first_name, up.last_name, up.preferred_name
         FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE u.id = ?`
    ).get(otherUserId) || { id: otherUserId, username: 'unknown', role: 'Unknown' };
    const otherPartyChat = {
      id: otherParty.id,
      username: otherParty.username,
      role: otherParty.role,
      first_name: otherParty.first_name ?? null,
      last_name: otherParty.last_name ?? null,
      preferred_name: otherParty.preferred_name ?? null,
    };
    const otherUser = {
      ...otherPartyChat,
      trust_score: otherParty.trust_score ?? undefined,
      verification_level: otherParty.verification_level ?? undefined,
    };
    const messages = db.prepare(
      `SELECT conversation_index AS msg_index, user_id, conversation_content AS content,
              kind, metadata, created_at
         FROM messages WHERE conversation_id = ? ORDER BY conversation_index ASC`
    ).all(conversationId).map(m => ({
      index: m.msg_index,
      user_id: m.user_id,
      content: m.content,
      kind: m.kind || 'text',
      metadata: parseJsonOrNull(m.metadata),
      created_at: m.created_at,
      from_me: m.user_id === userId,
    }));
    if (messages.length > 0) {
      markConversationReadThrough(conversationId, userId, messages[messages.length - 1].index);
    }
    return res.json({
      conversation: {
        id: convo.id,
        job_posting_id: convo.job_posting_id,
        job_title: convo.job_title,
        job_company: convo.job_company,
        active: convo.active,
        interview_status: convo.interview_status || 'none',
        interview_gate_state: computeInterviewGateState(convo),
        invite_requires_identity: Number(convo.invite_requires_identity) === 1,
        invite_identity_verified_at: convo.invite_identity_verified_at || null,
        closed_at: convo.closed_at,
        created_at: convo.created_at,
        other_party: otherPartyChat,
      },
      other_user: otherUser,
      messages,
    });
  } catch (e) {
    console.error('[applicant/conversations/messages GET]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/conversations/:id/messages', requireAuth, requireApplicant, (req, res) => {
  const userId = req.user.id;
  const conversationId = parseInt(req.params.id, 10);
  if (!Number.isInteger(conversationId) || conversationId <= 0) return res.status(400).json({ error: 'invalid_conversation_id' });
  const rawContent = req.body?.content;
  if (typeof rawContent !== 'string') return res.status(400).json({ error: 'invalid_content' });
  const content = rawContent.trim();
  if (content === '') return res.status(400).json({ error: 'empty_content' });
  if (content.length > 4000) return res.status(400).json({ error: 'content_too_long' });
  try {
    const convo = loadConversationForUser(conversationId, userId);
    if (!convo) return res.status(404).json({ error: 'not_found' });
    if (convo.active === 0) return res.status(409).json({ error: 'conversation_closed' });
    const inserted = insertMessage({ conversationId, userId, content, kind: 'text' });
    return res.status(201).json({
      message: {
        index: inserted.msg_index,
        user_id: inserted.user_id,
        content: inserted.content,
        kind: inserted.kind || 'text',
        metadata: parseJsonOrNull(inserted.metadata),
        created_at: inserted.created_at,
        from_me: true,
      },
    });
  } catch (e) {
    console.error('[applicant/conversations/messages POST]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/conversations/:id/verify-invite-identity', requireAuth, requireApplicant, async (req, res) => {
  const userId = req.user.id;
  const conversationId = parseInt(req.params.id, 10);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ error: 'invalid_conversation_id' });
  }
  const worldIdResult = req.body?.world_id_result;
  if (!worldIdResult) {
    return res.status(400).json({ error: 'missing_world_id_result' });
  }

  try {
    const convo = loadConversationForUser(conversationId, userId);
    if (!convo) return res.status(404).json({ error: 'not_found' });
    if (convo.active === 0) return res.status(409).json({ error: 'conversation_closed' });

    if (Number(convo.invite_requires_identity) !== 1) {
      return res.status(409).json({ error: 'identity_verification_not_required' });
    }
    if (convo.invite_identity_verified_at) {
      return res.json({ ok: true, already_verified: true, message: null });
    }

    let verified;
    try {
      verified = await verifyWorldId(worldIdResult);
    } catch (e) {
      return res.status(e.status || 400).json({ error: 'world_id_failed', detail: e.message });
    }

    const me = db
      .prepare('SELECT worldu_id FROM users WHERE id = ?')
      .get(userId);
    if (!me || !me.worldu_id || verified.nullifier_hash !== me.worldu_id) {
      return res.status(403).json({
        error: 'identity_mismatch',
        detail: 'This verification proof does not match your account identity.',
      });
    }

    db.prepare(
      `UPDATE conversations
          SET invite_identity_verified_at = datetime('now'),
              invite_identity_verified_by_user_id = ?
        WHERE id = ?`
    ).run(userId, conversationId);

    const inserted = insertMessage({
      conversationId,
      userId,
      content: 'Identity confirmed with World Face ID. I will share my availability next.',
      kind: 'system',
      metadata: {
        invite_identity_verified: true,
        provider: 'world',
      },
    });

    return res.status(201).json({
      ok: true,
      already_verified: false,
      message: {
        index: inserted.msg_index,
        user_id: inserted.user_id,
        content: inserted.content,
        kind: inserted.kind || 'system',
        metadata: parseJsonOrNull(inserted.metadata),
        created_at: inserted.created_at,
        from_me: true,
      },
    });
  } catch (e) {
    console.error('[applicant/conversations/:id/verify-invite-identity]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Reply to an interview_request with a list of timeslots. Posts an
// availability_proposal card the recruiter's chat will render with a
// "Send calendar invite" action per slot.
router.post('/conversations/:id/availability', requireAuth, requireApplicant, (req, res) => {
  const userId = req.user.id;
  const conversationId = parseInt(req.params.id, 10);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ error: 'invalid_conversation_id' });
  }

  const slots = Array.isArray(req.body?.slots) ? req.body.slots : null;
  if (!slots || slots.length === 0) {
    return res.status(400).json({ error: 'missing_slots' });
  }

  const cleaned = [];
  for (const s of slots) {
    if (!s || typeof s !== 'object') continue;
    const start = typeof s.start_iso === 'string' ? s.start_iso : null;
    const end = typeof s.end_iso === 'string' ? s.end_iso : null;
    if (!start || !end) continue;
    if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) continue;
    if (Date.parse(end) <= Date.parse(start)) continue;
    const label = typeof s.label === 'string' && s.label.trim() ? s.label.trim() : new Date(start).toLocaleString();
    cleaned.push({ label, start_iso: start, end_iso: end });
    if (cleaned.length >= 6) break;
  }
  if (cleaned.length === 0) {
    return res.status(400).json({ error: 'invalid_slots' });
  }

  try {
    const convo = loadConversationForUser(conversationId, userId);
    if (!convo) return res.status(404).json({ error: 'not_found' });
    if (convo.active === 0) return res.status(409).json({ error: 'conversation_closed' });
    if (
      Number(convo.invite_requires_identity) === 1 &&
      !convo.invite_identity_verified_at
    ) {
      return res.status(409).json({
        error: 'identity_verification_required',
        detail: 'Complete World Face ID verification before sharing availability.',
      });
    }

    const summary = `Here are ${cleaned.length} time${cleaned.length === 1 ? '' : 's'} that work for me — let me know which is best.`;
    const inserted = insertMessage({
      conversationId,
      userId,
      content: summary,
      kind: 'availability_proposal',
      metadata: { slots: cleaned },
    });
    setInterviewStatus(conversationId, 'availability_proposed');

    return res.status(201).json({
      message: {
        index: inserted.msg_index,
        user_id: inserted.user_id,
        content: inserted.content,
        kind: inserted.kind || 'availability_proposal',
        metadata: parseJsonOrNull(inserted.metadata),
        created_at: inserted.created_at,
        from_me: true,
      },
    });
  } catch (e) {
    console.error('[applicant/conversations/:id/availability]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/trust-questions-recruiter', requireAuth, requireApplicant, (_req, res) => {
  return res.json({ questions: RECRUITER_RATING_QUESTIONS });
});

router.post(
  '/conversations/:id/close',
  requireAuth,
  requireApplicant,
  (req, res) => {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json({ error: 'invalid_conversation_id' });
    }

    const responses = Array.isArray(req.body?.responses) ? req.body.responses : null;
    if (!responses || responses.length === 0) {
      return res.status(400).json({ error: 'missing_responses' });
    }

    const validIds = new Set(RECRUITER_RATING_QUESTIONS.map((q) => q.id));
    const byQuestionId = new Map();
    for (const r of responses) {
      if (!r || typeof r !== 'object') continue;
      const qid = r.question_id;
      if (typeof qid !== 'string' || !validIds.has(qid)) continue;
      const score = Number(r.score);
      if (!Number.isFinite(score) || score < 1 || score > 5) continue;
      byQuestionId.set(qid, {
        question_id: qid,
        score,
        note: typeof r.note === 'string' ? r.note.slice(0, 500) : '',
      });
    }
    for (const q of RECRUITER_RATING_QUESTIONS) {
      if (!byQuestionId.has(q.id)) {
        return res.status(400).json({
          error: 'incomplete_responses',
          detail: 'Answer every question (1–5) before closing.',
        });
      }
    }
    const cleaned = RECRUITER_RATING_QUESTIONS.map((q) => byQuestionId.get(q.id));

    try {
      const convo = loadConversationForUser(conversationId, userId);
      if (!convo) return res.status(404).json({ error: 'not_found' });
      if (convo.active === 0) return res.status(409).json({ error: 'conversation_closed' });

      const otherUserId =
        convo.user_1_id === userId ? convo.user_2_id : convo.user_1_id;
      const other = db
        .prepare('SELECT id, role FROM users WHERE id = ?')
        .get(otherUserId);
      if (!other || other.role !== 'Recruiter') {
        return res.status(400).json({
          error: 'only_recruiter_ratings',
          detail: 'Closure ratings apply to recruiter conversations only.',
        });
      }

      const payload = {
        responses: cleaned,
        closed_by: userId,
        closed_at: new Date().toISOString(),
        rated_user_id: otherUserId,
      };

      db.prepare(
        `UPDATE conversations
            SET active = 0,
                closed_at = datetime('now'),
                interview_status = 'complete',
                closure_responses = ?
          WHERE id = ?`
      ).run(JSON.stringify(payload), conversationId);

      insertMessage({
        conversationId,
        userId,
        content: 'Conversation closed. Thanks for the feedback.',
        kind: 'system',
        metadata: { closed: true },
      });

      const newScore = applyTrustFeedbackDelta(
        otherUserId,
        cleaned.map((r) => r.score),
      );

      return res.json({
        ok: true,
        conversation_id: conversationId,
        new_trust_score: newScore,
      });
    } catch (e) {
      console.error('[applicant/conversations/:id/close]', e);
      return res.status(500).json({ error: 'server_error' });
    }
  },
);

module.exports = router;
