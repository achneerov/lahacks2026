const RP_ID = process.env.WORLD_ID_RP_ID;
const { normalizeLevel, LEVEL_RANK } = require('./verificationLevels');

function pickFirstString(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') return c;
  }
  return undefined;
}

function strongestLevelFromResults(results) {
  if (!Array.isArray(results) || results.length === 0) return undefined;
  let best = undefined;
  for (const row of results) {
    if (!row || typeof row !== 'object') continue;
    // When present, only consider successful verifications.
    if (row.success === false) continue;
    const candidate = pickFirstString(
      row.identifier,
      row.verification_level,
      row.credential_type
    );
    if (!candidate) continue;
    const normalized = normalizeLevel(candidate);
    if (!best || (LEVEL_RANK[normalized] || 0) > (LEVEL_RANK[best] || 0)) {
      best = normalized;
    }
  }
  return best;
}

async function verifyWorldId(idkitResult) {
  if (!RP_ID) throw new Error('WORLD_ID_RP_ID not set');

  const res = await fetch(
    `https://developer.world.org/api/v4/verify/${RP_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(idkitResult),
    }
  );

  const data = await res.json().catch(() => ({}));
  console.log('[WorldID] verify status:', res.status, 'body:', data);

  if (!res.ok || data.success === false) {
    const err = new Error(data.detail || data.code || 'World ID verification failed');
    err.status = res.status || 400;
    err.code = data.code;
    console.error('[WorldID] verify failed:', {
      status: err.status,
      code: err.code,
      detail: data.detail || null,
    });
    throw err;
  }

  const nullifier_hash = data.nullifier || idkitResult.responses?.[0]?.nullifier;
  if (!nullifier_hash) throw new Error('No nullifier found in proof or verify response');

  // World ID payloads vary across versions. Accept multiple known fields and
  // normalize to our canonical levels.
  const resultsLevel = strongestLevelFromResults(data.results);
  const rawLevel = pickFirstString(
    data.verification_level,
    data.max_verification_level,
    data.credential_type,
    Array.isArray(data.credential_types) ? data.credential_types[0] : undefined,
    data.level,
    resultsLevel,
    idkitResult.responses?.[0]?.verification_level,
    idkitResult.responses?.[0]?.credential_type,
    Array.isArray(idkitResult.responses?.[0]?.credential_types)
      ? idkitResult.responses[0].credential_types[0]
      : undefined,
    idkitResult.verification_level,
    idkitResult.credential_type,
    Array.isArray(idkitResult.credential_types) ? idkitResult.credential_types[0] : undefined
  );
  const verification_level = normalizeLevel(rawLevel);

  console.log('[WorldID] level resolution:', {
    rawLevel: rawLevel || null,
    resultsLevel: resultsLevel || null,
    normalized: verification_level,
  });

  return { nullifier_hash, verification_level };
}

module.exports = { verifyWorldId };
