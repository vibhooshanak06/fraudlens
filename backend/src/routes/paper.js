const express = require('express');
const router = express.Router();
const pool = require('../mysql');
const mongoose = require('mongoose');
const Paper = require('../models/Paper');
const { requireAuth } = require('../middleware/auth');

// GET /paper/:uuid — returns MySQL metadata + MongoDB analysis data
router.get('/:uuid', requireAuth, async (req, res) => {
  const { uuid } = req.params;
  const userId = req.user.id;

  try {
    // Get metadata from MySQL (ensures user owns this paper)
    const [[meta]] = await pool.query(
      `SELECT uuid, filename, status, risk_level, plagiarism_score, issue_count, uploaded_at, completed_at
       FROM papers WHERE uuid = ? AND user_id = ?`,
      [uuid, userId]
    );
    if (!meta) return res.status(404).json({ error: 'Paper not found' });

    // Get analysis data from MongoDB
    let analysisData = {};
    try {
      const mongoPaper = await Paper.findOne({ uuid }).lean();
      if (mongoPaper) {
        analysisData = {
          fraud_report: mongoPaper.fraud_report,
          summary: mongoPaper.summary,
          keywords: mongoPaper.keywords,
          extracted_text: mongoPaper.extracted_text,
        };
      }
    } catch (mongoErr) {
      console.warn('MongoDB fetch failed for', uuid, mongoErr.message);
    }

    return res.json({ ...meta, ...analysisData });
  } catch (err) {
    console.error('Paper fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch paper' });
  }
});

module.exports = router;
