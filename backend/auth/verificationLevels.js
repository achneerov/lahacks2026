// Canonical World ID verification levels and ordering.
// Ranks are used to enforce per-job minimum requirements: an applicant
// satisfies a job's minimum iff their level's rank is >= the job's.
const LEVEL_RANK = {
  orb: 4,
  document: 3,
  face: 2,
  device: 1,
};

const ALL_LEVELS = ['orb', 'document', 'face', 'device'];

// Maps various names World ID might return (legacy or 4.0) to canonical levels.
const LEVEL_ALIASES = {
  orb: 'orb',
  iris: 'orb',
  proof_of_human: 'orb',
  document: 'document',
  passport: 'document',
  secure_document: 'document',
  face: 'face',
  selfie_check: 'face',
  selfie_face: 'face',
  device: 'device',
};

function normalizeLevel(raw) {
  if (typeof raw !== 'string') return 'device';
  return LEVEL_ALIASES[raw.toLowerCase()] || 'device';
}

function isValidLevel(level) {
  return typeof level === 'string' && Object.prototype.hasOwnProperty.call(LEVEL_RANK, level);
}

function meetsLevel(userLevel, requiredLevel) {
  const u = LEVEL_RANK[userLevel] || 0;
  const r = LEVEL_RANK[requiredLevel] || 0;
  return u >= r;
}

module.exports = { LEVEL_RANK, ALL_LEVELS, LEVEL_ALIASES, normalizeLevel, isValidLevel, meetsLevel };
