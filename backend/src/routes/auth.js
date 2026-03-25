const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../mysql');

const JWT_SECRET = process.env.JWT_SECRET || 'fraudlens_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function makeAvatar(name) {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '??';
}

async function createSession(userId, token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
}

// POST /auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const avatar = makeAvatar(name);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, avatar, role, plan) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), email.toLowerCase(), hash, avatar, 'researcher', 'free']
    );
    const userId = result.insertId;

    // Init dashboard stats row
    await pool.query('INSERT IGNORE INTO dashboard_stats (user_id) VALUES (?)', [userId]);

    const payload = { id: userId, email: email.toLowerCase(), name: name.trim(), avatar, role: 'researcher', plan: 'free' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    await createSession(userId, token);

    return res.status(201).json({ token, user: payload });
  } catch (err) {
    console.error('Signup error:', err.message);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    // Ensure stats row exists
    await pool.query('INSERT IGNORE INTO dashboard_stats (user_id) VALUES (?)', [user.id]);

    const payload = { id: user.id, email: user.email, name: user.name, avatar: user.avatar, role: user.role, plan: user.plan };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    await createSession(user.id, token);

    return res.json({ token, user: payload });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]).catch(() => {});
  }
  return res.json({ message: 'Logged out' });
});

// GET /auth/me
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.query('SELECT id, name, email, avatar, role, plan FROM users WHERE id = ?', [payload.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: rows[0] });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
