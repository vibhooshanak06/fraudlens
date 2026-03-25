const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../mysql');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, async (req, res) => {
  const { uuid, question } = req.body;
  if (!uuid || !question) return res.status(400).json({ error: 'uuid and question are required' });

  // Verify user owns this paper
  const [[paper]] = await pool.query('SELECT uuid FROM papers WHERE uuid = ? AND user_id = ?', [uuid, req.user.id]);
  if (!paper) return res.status(404).json({ error: 'Paper not found' });

  try {
    const response = await axios.post(`${process.env.AI_ENGINE_URL}/chat`, { uuid, question }, { timeout: 60000 });
    return res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(503).json({ error: 'AI engine unavailable' });
  }
});

module.exports = router;
