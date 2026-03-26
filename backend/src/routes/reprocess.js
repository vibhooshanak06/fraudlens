const express = require('express');
const router = express.Router();
const pool = require('../mysql');
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');
const path = require('path');

async function triggerAIEngine(uuid, pdfPath, userId) {
  const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
  const absolutePath = path.resolve(pdfPath);
  try {
    const response = await axios.post(`${aiEngineUrl}/process`, { uuid, pdf_path: absolutePath }, { timeout: 120000 });
    const data = response.data || {};
    const fraudReport = data.fraud_report || {};
    const plagiarismScore = fraudReport.plagiarism_score ?? null;
    const riskLevel = fraudReport.risk_level || null;
    const issueCount = (fraudReport.issues || []).length;

    await pool.query(
      `UPDATE papers SET status='completed', risk_level=?, plagiarism_score=?, issue_count=?, completed_at=NOW() WHERE uuid=?`,
      [riskLevel, plagiarismScore, issueCount, uuid]
    );
  } catch (err) {
    console.error(`Reprocess AI engine failed for ${uuid}:`, err.message);
    await pool.query(`UPDATE papers SET status='failed' WHERE uuid=?`, [uuid]);
  }
}

// POST /reprocess/:uuid — retry a failed or stuck paper
router.post('/:uuid', requireAuth, async (req, res) => {
  const { uuid } = req.params;
  const userId = req.user.id;

  try {
    const [[paper]] = await pool.query(
      'SELECT uuid, file_path, status FROM papers WHERE uuid = ? AND user_id = ?',
      [uuid, userId]
    );
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.status === 'processing') {
      return res.status(202).json({ message: 'Already processing' });
    }

    await pool.query(`UPDATE papers SET status='processing', completed_at=NULL WHERE uuid=?`, [uuid]);

    // fire-and-forget
    triggerAIEngine(uuid, paper.file_path, userId);

    return res.json({ uuid, status: 'processing', message: 'Reprocessing started' });
  } catch (err) {
    console.error('Reprocess error:', err.message);
    return res.status(500).json({ error: 'Failed to start reprocessing' });
  }
});

module.exports = router;
