const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const pool = require('../mysql');
const Paper = require('../models/Paper');
const { requireAuth } = require('../middleware/auth');

// GET /export/:uuid/pdf
router.get('/:uuid/pdf', requireAuth, async (req, res) => {
  const { uuid } = req.params;
  const userId = req.user.id;

  try {
    const [[meta]] = await pool.query(
      `SELECT uuid, filename, status, risk_level, plagiarism_score, uploaded_at
       FROM papers WHERE uuid = ? AND user_id = ?`,
      [uuid, userId]
    );
    if (!meta) return res.status(404).json({ error: 'Paper not found' });

    let fraud_report = null;
    let summary = null;
    try {
      const mongoPaper = await Paper.findOne({ uuid }).lean();
      if (mongoPaper) {
        fraud_report = mongoPaper.fraud_report;
        summary = mongoPaper.summary;
      }
    } catch (_) {}

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const filename = meta.filename.replace(/[^a-z0-9_\-\.]/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fraudlens-report-${filename}.pdf"`);
    doc.pipe(res);

    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill('#060b18');
    doc.fontSize(22).fillColor('#4f8ef7').font('Helvetica-Bold').text('FraudLens', 50, 24);
    doc.fontSize(10).fillColor('#8fa3c8').font('Helvetica').text('Research Integrity Analysis Report', 50, 50);
    doc.moveDown(3);

    // ── Paper info ───────────────────────────────────────────────────────────
    doc.fillColor('#f0f4ff').fontSize(14).font('Helvetica-Bold').text('Paper', { underline: false });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor('#8fa3c8')
      .text(`Filename: `, { continued: true }).fillColor('#f0f4ff').text(meta.filename);
    doc.fillColor('#8fa3c8').text(`Analyzed: `, { continued: true })
      .fillColor('#f0f4ff').text(new Date(meta.uploaded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    doc.moveDown(1.5);

    // ── Risk summary ─────────────────────────────────────────────────────────
    if (fraud_report) {
      const pct = Math.round((fraud_report.plagiarism_score || 0) * 100);
      const riskColors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
      const riskColor = riskColors[fraud_report.risk_level] || '#8fa3c8';

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#f0f4ff').text('Fraud Analysis');
      doc.moveDown(0.3);
      doc.rect(50, doc.y, doc.page.width - 100, 60).fill('#0d1526').stroke('#1e2d4a');
      const boxY = doc.y - 60;
      doc.fontSize(11).font('Helvetica').fillColor('#8fa3c8').text('Plagiarism Score', 66, boxY + 10);
      doc.fontSize(24).font('Helvetica-Bold').fillColor(riskColor).text(`${pct}%`, 66, boxY + 24);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(riskColor)
        .text(`${(fraud_report.risk_level || '').toUpperCase()} RISK`, 200, boxY + 28);
      doc.fontSize(10).font('Helvetica').fillColor('#8fa3c8')
        .text(`${(fraud_report.issues || []).length} issue(s) detected`, 200, boxY + 44);
      doc.moveDown(1.5);

      // Issues
      if (fraud_report.issues && fraud_report.issues.length > 0) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#f0f4ff').text('Detected Issues');
        doc.moveDown(0.5);
        fraud_report.issues.forEach((issue, i) => {
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#4f8ef7').text(`${i + 1}. ${issue.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`);
          doc.fontSize(10).font('Helvetica').fillColor('#8fa3c8').text(issue.description, { width: doc.page.width - 100 });
          if (issue.excerpt) {
            doc.moveDown(0.2);
            doc.fontSize(9).fillColor('#4a6080').font('Helvetica-Oblique')
              .text(`"${issue.excerpt.slice(0, 200)}"`, { width: doc.page.width - 120, indent: 20 });
          }
          doc.moveDown(0.6);
        });
      } else {
        doc.fontSize(11).font('Helvetica').fillColor('#10b981').text('No issues detected — paper passed all fraud detection checks.');
        doc.moveDown(1);
      }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    if (summary) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#f0f4ff').text('AI-Generated Summary');
      doc.moveDown(0.5);

      const fields = [
        { key: 'title', label: 'Title' },
        { key: 'main_contributions', label: 'Main Contributions' },
        { key: 'methodology', label: 'Methodology' },
        { key: 'conclusions', label: 'Conclusions' },
      ];
      fields.forEach(f => {
        if (summary[f.key]) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#4f8ef7').text(f.label);
          doc.fontSize(10).font('Helvetica').fillColor('#8fa3c8')
            .text(summary[f.key], { width: doc.page.width - 100 });
          doc.moveDown(0.8);
        }
      });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.fontSize(8).fillColor('#4a6080').font('Helvetica')
      .text(`Generated by FraudLens · ${new Date().toISOString()}`, 50, doc.page.height - 40, { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
