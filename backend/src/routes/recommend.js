const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, async (req, res) => {
  const { query } = req.body;
  if (typeof query !== 'string' || query.trim().length < 3) {
    return res.status(400).json({ error: 'query must be at least 3 characters' });
  }
  try {
    const response = await axios.post(`${process.env.AI_ENGINE_URL}/recommend`, { query: query.trim() }, { timeout: 30000 });
    return res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(503).json({ error: 'AI engine unavailable' });
  }
});

module.exports = router;
