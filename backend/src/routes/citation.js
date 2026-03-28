const express = require('express');
const router = express.Router();
const pool = require('../mysql');
const axios = require('axios');
const path = require('path');
const { requireAuth } = require('../middleware/auth');

// GET /citation/:uuid/graph
router.get('/:uuid/graph', requireAuth, async (req, res) => {
  const { uuid } = req.params;
  const userId = req.user.id;

  try {
    const [[paper]] = await pool.query(
      'SELECT uuid, file_path, status FROM papers WHERE uuid = ? AND user_id = ?',
      [uuid, userId]
    );
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.status !== 'completed') {
      return res.status(400).json({ error: 'Paper not yet analyzed' });
    }

    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';

    // Pass the absolute file path so AI engine can re-extract full text
    // (stored extracted_text is capped and may miss the references section)
    const absolutePath = path.resolve(paper.file_path);
    const response = await axios.post(
      `${aiEngineUrl}/citation-graph`,
      { uuid, pdf_path: absolutePath },
      { timeout: 30000 }
    );
    return res.json(response.data);
  } catch (err) {
    const isConnRefused = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND';
    const detail = isConnRefused
      ? 'AI engine is not running. Start it with: cd ai-engine && python main.py'
      : (err?.response?.data?.detail || err?.response?.data?.error || err.message);
    console.error('Citation graph error:', detail);
    return res.status(isConnRefused ? 503 : 500).json({ error: 'Failed to build citation graph', detail });
  }
});

module.exports = router;
