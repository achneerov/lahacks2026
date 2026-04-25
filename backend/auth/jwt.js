const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EXPIRES_IN = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { signToken, requireAuth };
