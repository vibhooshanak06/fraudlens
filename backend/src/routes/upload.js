const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const cloudinary = require('../../cloudinary');
const pool = require('../mysql');
const Paper = require('../models/Paper');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(Object.assign(new Error('Only PDF files are accepted'), { code: 'INVALID_TYPE' }));
  },
});

async function triggerAIEngine(uuid, pdfUrl, userId) {
  const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
  try {
    const response = await axios.post(
    `${aiEngineUrl}/process`,
    {
        uuid,
        pdf_url: pdfUrl
    },
    {
        timeout: 120000
    }
);
    const data = response.data || {};
    const fraudReport = data.fraud_report || {};
    const plagiarismScore = fraudReport.plagiarism_score ?? null;
    const riskLevel = fraudReport.risk_level || null;
    const issueCount = (fraudReport.issues || []).length;

    // Update MySQL paper record
    await pool.query(
      `UPDATE papers SET status='completed', risk_level=?, plagiarism_score=?, issue_count=?, completed_at=NOW() WHERE uuid=?`,
      [riskLevel, plagiarismScore, issueCount, uuid]
    );

    // Save full analysis data to MongoDB (upsert in case doc wasn't pre-created)
    // Note: extracted_text and keywords are saved directly by the AI engine.
    // We only upsert fraud_report and summary here as a safety net.
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await Paper.findOneAndUpdate(
      { uuid },
      {
        $set: {
          fraud_report: data.fraud_report || {},
          summary: data.summary || {},
          ...(data.keywords && data.keywords.length > 0 && { keywords: data.keywords }),
          ...(data.extracted_text && { extracted_text: data.extracted_text }),
          status: 'completed',
        },
        $setOnInsert: {
          uuid,
          filename: pdfUrl.split('/').pop(),
          file_path: pdfUrl,
          expires_at: expiresAt,
        },
      },
      { upsert: true, new: true }
    );

    // Update dashboard stats
    await pool.query(`
      INSERT INTO dashboard_stats (user_id, total_analyses, high_risk_count, cleared_count, avg_plagiarism)
      VALUES (?, 0, 0, 0, 0)
      ON DUPLICATE KEY UPDATE updated_at=NOW()
    `, [userId]);

  } catch (err) {
    console.error(`AI engine failed for ${uuid}:`, err.message);
    await pool.query(`UPDATE papers SET status='failed' WHERE uuid=?`, [uuid]);
  }
}

// router.post('/', requireAuth, upload.single('file'), async (req, res) => {
//   if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

//   const uuid = uuidv4();
//   const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
//   const userId = req.user.id;

//   const uploadResult = await cloudinary.uploader.upload(req.file.path, {
//     resource_type: "raw",
//     folder: "FraudLens"
// });

//   const pdfUrl = uploadResult.secure_url;


//   try {
//     await pool.query(
//       `INSERT INTO papers (uuid, user_id, filename, file_path, status, expires_at) VALUES (?, ?, ?, ?, 'processing', ?)`,
//       [uuid, userId, req.file.originalname, pdfUrl, expiresAt]
//     );


//     triggerAIEngine(uuid, pdfUrl, userId);

//     fs.unlink(req.file.path, () => {});

//     return res.status(200).json({ uuid, status: 'processing' });
//   } catch (err) {
//     console.error('Upload error:', err.message);
//     return res.status(500).json({ error: 'Failed to save paper record.' });
//   }
// });

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const uuid = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const userId = req.user.id;

  try {

    // Upload PDF to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "raw",
      folder: "FraudLens"
    });

    const pdfUrl = uploadResult.secure_url;

    // Save paper metadata in MySQL
    await pool.query(
      `INSERT INTO papers
      (uuid, user_id, filename, file_path, status, expires_at)
      VALUES (?, ?, ?, ?, 'processing', ?)`,
      [
        uuid,
        userId,
        req.file.originalname,
        pdfUrl,
        expiresAt
      ]
    );

    // Trigger AI Engine (don't wait)
    triggerAIEngine(uuid, pdfUrl, userId);

    // Delete temporary local file
    fs.unlink(req.file.path, () => {});

    return res.status(200).json({
      uuid,
      status: "processing"
    });

  } catch (err) {
    console.error("Upload error:", err);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }

    return res.status(500).json({
      error: "Failed to process uploaded PDF."
    });
  }
});


router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large. Maximum size is 20 MB.' });
  if (err.code === 'INVALID_TYPE') return res.status(400).json({ error: 'Only PDF files are accepted.' });
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
