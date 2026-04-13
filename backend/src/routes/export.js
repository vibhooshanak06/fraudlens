const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const pool = require('../mysql');
const Paper = require('../models/Paper');
const { requireAuth } = require('../middleware/auth');

const MARGIN = 45;
const PAGE_W = 595.28; // A4
const CONTENT_W = PAGE_W - MARGIN * 2;

// Colour palette
const C = {
  bg:        '#060b18',
  surface:   '#0d1526',
  border:    '#1e2d4a',
  accent:    '#4f8ef7',
  muted:     '#8fa3c8',
  text:      '#dce8ff',
  low:       '#10b981',
  medium:    '#f59e0b',
  high:      '#ef4444',
  white:     '#ffffff',
};

function riskColor(level) {
  return C[level] || C.muted;
}

// Draw a filled rounded rect (pdfkit doesn't have roundedRect natively in all versions)
function filledRect(doc, x, y, w, h, color, strokeColor) {
  doc.save().rect(x, y, w, h).fillAndStroke(color, strokeColor || color).restore();
}

// Section heading
function sectionHeading(doc, title) {
  doc.moveDown(0.6);
  const y = doc.y;
  doc.save()
    .rect(MARGIN, y, 3, 13)
    .fill(C.accent)
    .restore();
  doc.fontSize(11).font('Helvetica-Bold').fillColor(C.text)
    .text(title, MARGIN + 10, y, { width: CONTENT_W - 10 });
  doc.moveDown(0.5);
}

// Labelled row: "Label   Value"
function labelValue(doc, label, value) {
  const y = doc.y;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(C.muted)
    .text(label.toUpperCase(), MARGIN, y, { width: 120, continued: false });
  doc.fontSize(9).font('Helvetica').fillColor(C.text)
    .text(value || '—', MARGIN + 125, y, { width: CONTENT_W - 125 });
  doc.moveDown(0.35);
}

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

    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', autoFirstPage: true });
    const filename = meta.filename.replace(/[^a-z0-9_\-\.]/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fraudlens-report-${filename}.pdf"`);
    doc.pipe(res);

    // ── PAGE 1 ───────────────────────────────────────────────────────────────

    // Header banner
    filledRect(doc, 0, 0, PAGE_W, 64, C.bg);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(C.accent)
      .text('FraudLens', MARGIN, 18, { continued: true });
    doc.fontSize(9).font('Helvetica').fillColor(C.muted)
      .text('  ·  Research Integrity Analysis Report', { continued: false });
    doc.fontSize(8).fillColor(C.muted)
      .text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, MARGIN, 40);

    doc.y = 80;

    // ── Paper info block ─────────────────────────────────────────────────────
    sectionHeading(doc, 'Paper Information');
    labelValue(doc, 'Filename', meta.filename);
    labelValue(doc, 'Analyzed', new Date(meta.uploaded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    labelValue(doc, 'Status', (meta.status || '').toUpperCase());

    // ── Risk summary box ─────────────────────────────────────────────────────
    if (fraud_report) {
      const pct = Math.round((fraud_report.plagiarism_score || 0) * 100);
      const rc = riskColor(fraud_report.risk_level);
      const issueCount = (fraud_report.issues || []).length;

      sectionHeading(doc, 'Fraud Analysis');

      const boxY = doc.y;
      const boxH = 52;
      filledRect(doc, MARGIN, boxY, CONTENT_W, boxH, C.surface, C.border);

      // Plagiarism score
      doc.fontSize(22).font('Helvetica-Bold').fillColor(rc)
        .text(`${pct}%`, MARGIN + 14, boxY + 8, { width: 70 });
      doc.fontSize(8).font('Helvetica').fillColor(C.muted)
        .text('Plagiarism Score', MARGIN + 14, boxY + 34);

      // Divider
      doc.save().moveTo(MARGIN + 90, boxY + 10).lineTo(MARGIN + 90, boxY + boxH - 10)
        .strokeColor(C.border).lineWidth(1).stroke().restore();

      // Risk level
      doc.fontSize(13).font('Helvetica-Bold').fillColor(rc)
        .text(`${(fraud_report.risk_level || '').toUpperCase()} RISK`, MARGIN + 104, boxY + 10, { width: 140 });
      doc.fontSize(8).font('Helvetica').fillColor(C.muted)
        .text(`${issueCount} issue${issueCount !== 1 ? 's' : ''} detected`, MARGIN + 104, boxY + 30);

      doc.y = boxY + boxH + 12;

      // ── Issues ───────────────────────────────────────────────────────────
      if (issueCount > 0) {
        sectionHeading(doc, 'Detected Issues');
        (fraud_report.issues || []).forEach((issue, i) => {
          const label = issue.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          doc.fontSize(9).font('Helvetica-Bold').fillColor(C.accent)
            .text(`${i + 1}.  ${label}`, MARGIN, doc.y, { width: CONTENT_W });
          doc.fontSize(8.5).font('Helvetica').fillColor(C.muted)
            .text(issue.description, MARGIN + 14, doc.y, { width: CONTENT_W - 14 });
          doc.moveDown(0.5);
        });
      } else {
        doc.fontSize(9).font('Helvetica').fillColor(C.low)
          .text('✓  No issues detected — paper passed all fraud detection checks.', MARGIN, doc.y);
        doc.moveDown(0.5);
      }
    }

    // ── Summary (same page if space, else page 2) ────────────────────────────
    if (summary) {
      // If less than 200pt remaining, add a new page
      if (doc.y > doc.page.height - 220) {
        doc.addPage();
        doc.y = MARGIN;
      }

      sectionHeading(doc, 'AI-Generated Summary');

      const summaryFields = [
        { key: 'title',              label: 'Title' },
        { key: 'main_contributions', label: 'Main Contributions' },
        { key: 'methodology',        label: 'Methodology' },
        { key: 'conclusions',        label: 'Conclusions' },
      ];

      summaryFields.forEach(f => {
        if (!summary[f.key]) return;
        // Truncate long values to keep within 2 pages (~400 chars each)
        const val = summary[f.key].length > 420
          ? summary[f.key].slice(0, 420).trimEnd() + '…'
          : summary[f.key];

        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.accent)
          .text(f.label, MARGIN, doc.y, { width: CONTENT_W });
        doc.fontSize(8.5).font('Helvetica').fillColor(C.muted)
          .text(val, MARGIN + 10, doc.y, { width: CONTENT_W - 10 });
        doc.moveDown(0.55);
      });
    }

    // ── Footer on every page ─────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.save()
        .moveTo(MARGIN, doc.page.height - 28)
        .lineTo(PAGE_W - MARGIN, doc.page.height - 28)
        .strokeColor(C.border).lineWidth(0.5).stroke()
        .restore();
      doc.fontSize(7).font('Helvetica').fillColor(C.muted)
        .text(
          `FraudLens · Confidential · Page ${i + 1} of ${range.count}`,
          MARGIN, doc.page.height - 20,
          { width: CONTENT_W, align: 'center' }
        );
    }

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
