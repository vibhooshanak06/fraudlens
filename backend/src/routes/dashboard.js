const express = require('express');
const router = express.Router();
const pool = require('../mysql');
const { requireAuth } = require('../middleware/auth');

// GET /dashboard/stats — real stats from MySQL
router.get('/stats', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    // Aggregate directly from papers table for accuracy
    const [[totals]] = await pool.query(`
      SELECT
        COUNT(*) AS total_analyses,
        SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high_risk_count,
        SUM(CASE WHEN risk_level IN ('low','medium') AND status = 'completed' THEN 1 ELSE 0 END) AS cleared_count,
        ROUND(AVG(CASE WHEN plagiarism_score IS NOT NULL THEN plagiarism_score ELSE NULL END) * 100, 1) AS avg_plagiarism
      FROM papers
      WHERE user_id = ?
    `, [userId]);

    return res.json({
      total_analyses: totals.total_analyses || 0,
      high_risk_count: totals.high_risk_count || 0,
      cleared_count: totals.cleared_count || 0,
      avg_plagiarism: totals.avg_plagiarism || 0,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
});

// GET /dashboard/recent — last 5 papers for this user
router.get('/recent', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.query(`
      SELECT uuid, filename, status, risk_level, plagiarism_score, issue_count, uploaded_at, completed_at
      FROM papers
      WHERE user_id = ?
      ORDER BY uploaded_at DESC
      LIMIT 5
    `, [userId]);

    return res.json({ papers: rows });
  } catch (err) {
    console.error('Recent papers error:', err.message);
    return res.status(500).json({ error: 'Failed to load recent papers' });
  }
});

// GET /dashboard/papers — all papers with pagination
router.get('/papers', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  try {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM papers WHERE user_id = ?', [userId]);
    const [rows] = await pool.query(`
      SELECT uuid, filename, status, risk_level, plagiarism_score, issue_count, uploaded_at, completed_at
      FROM papers WHERE user_id = ?
      ORDER BY uploaded_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    return res.json({ papers: rows, total, page, limit });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load papers' });
  }
});

module.exports = router;
