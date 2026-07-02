const express = require('express');
const router = express.Router();
const pool = require('../mysql');
const axios = require('axios');
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

    // file_path is a Supabase public URL. Send it to the AI engine so it can
    // download the full, untruncated PDF and extract a complete reference list.
    // The stored extracted_text in MongoDB is capped at 50 000 chars and will
    // often miss the references section entirely.
    const response = await axios.post(
      `${aiEngineUrl}/citation-graph`,
      { uuid, pdf_url: paper.file_path },
      { timeout: 60000 }
    );
    return res.json(response.data);
  } catch (err) {
    const isConnRefused = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND';
    const detail = isConnRefused
      ? 'AI engine is not running.'
      : (err?.response?.data?.detail || err?.response?.data?.error || err.message);
    console.error('Citation graph error:', detail);
    return res
      .status(isConnRefused ? 503 : 500)
      .json({ error: 'Failed to build citation graph', detail });
  }
});

module.exports = router;
