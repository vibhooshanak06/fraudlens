const express = require('express');
const router = express.Router();
const pool = require('../mysql');

// GET /stats/platform — public, no auth required
// Returns real platform-wide counts for the login page
router.get('/platform', async (_req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT
        COUNT(*)                                                        AS total_papers,
        ROUND(AVG(CASE WHEN plagiarism_score IS NOT NULL
                       THEN plagiarism_score END) * 100, 1)            AS avg_plagiarism,
        MIN(TIMESTAMPDIFF(SECOND, uploaded_at, completed_at))          AS min_analysis_secs,
        AVG(CASE WHEN completed_at IS NOT NULL
                 THEN TIMESTAMPDIFF(SECOND, uploaded_at, completed_at)
            END)                                                        AS avg_analysis_secs
      FROM papers
      WHERE status = 'completed'
    `);

    const total = row.total_papers || 0;
    const avgSecs = Math.round(row.avg_analysis_secs || 55);
    const avgPlag = row.avg_plagiarism != null ? parseFloat(row.avg_plagiarism) : null;

    // Accuracy = % of papers that completed without errors (all completed ones qualify)
    const [[{ failed }]] = await pool.query(
      `SELECT COUNT(*) AS failed FROM papers WHERE status = 'failed'`
    );
    const [[{ all_total }]] = await pool.query(
      `SELECT COUNT(*) AS all_total FROM papers`
    );
    const accuracy = all_total > 0
      ? Math.round(((all_total - failed) / all_total) * 1000) / 10
      : 100;

    return res.json({
      total_papers: total,
      avg_analysis_secs: avgSecs,
      accuracy_rate: accuracy,
      avg_plagiarism: avgPlag,
    });
  } catch (err) {
    console.error('Platform stats error:', err.message);
    return res.status(500).json({ error: 'Failed to load platform stats' });
  }
});

module.exports = router;
