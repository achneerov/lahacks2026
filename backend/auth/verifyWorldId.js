const RP_ID = process.env.WORLD_ID_RP_ID;

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
    err.status = 400;
    err.code = data.code;
    throw err;
  }

  const nullifier_hash = data.nullifier || idkitResult.responses?.[0]?.nullifier;
  if (!nullifier_hash) throw new Error('No nullifier found in proof or verify response');

  return { nullifier_hash };
}

module.exports = { verifyWorldId };
