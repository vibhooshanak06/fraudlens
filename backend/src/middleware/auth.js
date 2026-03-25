const jwt = require('jsonwebtoken');
const pool = require('../mysql');

const JWT_SECRET = process.env.JWT_SECRET || 'fraudlens_secret';

/**
 * Middleware: verify JWT, attach req.user = { id, email, name, role, plan }
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Verify session still exists in DB
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
      'SELECT s.id FROM sessions s WHERE s.token_hash = ? AND s.expires_at > NOW() AND s.user_id = ?',
      [tokenHash, payload.id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { requireAuth };
