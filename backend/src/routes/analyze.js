const express = require('express');
const router = express.Router();
const pool = require('../mysql');
const Paper = require('../models/Paper');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { uuid } = req.body;
    if (!uuid) return res.status(400).json({ error: 'uuid is required' });

    const [[meta]] = await pool.query(
      'SELECT uuid, status FROM papers WHERE uuid = ? AND user_id = ?',
      [uuid, req.user.id]
    );
    if (!meta) return res.status(404).json({ error: 'Paper not found' });

    if (meta.status === 'processing') {
      return res.status(202).json({ uuid, status: 'processing', message: 'Analysis in progress' });
    }
    if (meta.status === 'failed') {
      return res.status(500).json({ error: 'Analysis failed for this paper' });
    }

    // Fetch full analysis from MongoDB
    const mongoPaper = await Paper.findOne({ uuid }).lean();
    return res.json({
      uuid,
      fraud_report: mongoPaper?.fraud_report || null,
      summary: mongoPaper?.summary || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
