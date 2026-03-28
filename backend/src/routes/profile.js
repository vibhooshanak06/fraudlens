const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../mysql');
const { requireAuth } = require('../middleware/auth');

function makeAvatar(name) {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '??';
}

// PUT /profile — update name (and avatar)
router.put('/', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const avatar = makeAvatar(name.trim());
  try {
    await pool.query('UPDATE users SET name = ?, avatar = ? WHERE id = ?', [name.trim(), avatar, req.user.id]);
    return res.json({ name: name.trim(), avatar });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /profile/password — change password
router.put('/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both fields are required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  try {
    const [[user]] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(current_password, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
    return res.json({ message: 'Password updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;
