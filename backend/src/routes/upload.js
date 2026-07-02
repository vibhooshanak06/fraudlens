const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const pool = require('../mysql');
const Paper = require('../models/Paper');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ---------------------------------------------------------------------------
// Supabase client (service role — can upload to any bucket)
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'papers';

// ---------------------------------------------------------------------------
// Multer — disk storage for temporary local file before Supabase upload
// ---------------------------------------------------------------------------
const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(Object.assign(new Error('Only PDF files are accepted'), { code: 'INVALID_TYPE' }));
  },
});

// ---------------------------------------------------------------------------
// Upload PDF to Supabase Storage and return a public URL
// ---------------------------------------------------------------------------
async function uploadToSupabase(localPath, originalName, uuid) {
  const ext = path.extname(originalName) || '.pdf';
  const storageKey = `${uuid}${ext}`;

  const fileBuffer = fs.readFileSync(localPath);

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(storageKey, fileBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(storageKey);

  if (!urlData || !urlData.publicUrl) {
    throw new Error('Supabase did not return a public URL.');
  }

  return urlData.publicUrl;
}

// ---------------------------------------------------------------------------
// Fire-and-forget: call AI engine, then update MySQL + MongoDB with results
// ---------------------------------------------------------------------------
async function triggerAIEngine(uuid, pdfUrl, userId, originalName) {
  const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';

  try {
    const response = await axios.post(
      `${aiEngineUrl}/process`,
      { uuid, pdf_url: pdfUrl },
      { timeout: 120000 }
    );

    const data = response.data || {};
    const fraudReport = data.fraud_report || {};
    const plagiarismScore = fraudReport.plagiarism_score ?? null;
    const riskLevel = fraudReport.risk_level || null;
    const issueCount = (fraudReport.issues || []).length;

    await pool.query(
      `UPDATE papers
       SET status='completed',
           risk_level=?,
           plagiarism_score=?,
           issue_count=?,
           completed_at=NOW()
       WHERE uuid=?`,
      [riskLevel, plagiarismScore, issueCount, uuid]
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await Paper.findOneAndUpdate(
      { uuid },
      {
        $set: {
          fraud_report: data.fraud_report || {},
          summary: data.summary || {},
          keywords: data.keywords || [],
          extracted_text: data.extracted_text || '',
          status: 'completed',
        },
        $setOnInsert: {
          uuid,
          filename: originalName,
          file_path: pdfUrl,
          expires_at: expiresAt,
        },
      },
      { upsert: true }
    );

    await pool.query(
      `INSERT INTO dashboard_stats
         (user_id, total_analyses, high_risk_count, cleared_count, avg_plagiarism)
       VALUES (?, 0, 0, 0, 0)
       ON DUPLICATE KEY UPDATE updated_at=NOW()`,
      [userId]
    );

    console.log(`Analysis completed: ${uuid}`);
  } catch (err) {
    console.error(`AI engine error for ${uuid}:`, err.response?.data || err.message);

    await pool.query(
      `UPDATE papers SET status='failed' WHERE uuid=?`,
      [uuid]
    );
  }
}

// ---------------------------------------------------------------------------
// POST /upload
// ---------------------------------------------------------------------------
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const uuid = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const userId = req.user.id;
  const localPath = req.file.path;

  let pdfUrl;

  try {
    // 1. Upload to Supabase Storage
    pdfUrl = await uploadToSupabase(localPath, req.file.originalname, uuid);
  } catch (err) {
    console.error('Supabase upload error:', err.message);

    fs.unlink(localPath, () => {});

    return res.status(502).json({ error: 'Failed to upload PDF to storage. Please try again.' });
  } finally {
    // Always remove the temporary local file regardless of outcome
    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, () => {});
    }
  }

  try {
    // 2. Persist paper record in MySQL with the public Supabase URL
    await pool.query(
      `INSERT INTO papers
         (uuid, user_id, filename, file_path, status, expires_at)
       VALUES (?, ?, ?, ?, 'processing', ?)`,
      [uuid, userId, req.file.originalname, pdfUrl, expiresAt]
    );
  } catch (err) {
    console.error('MySQL insert error:', err.message);
    return res.status(500).json({ error: 'Failed to save paper record.' });
  }

  // 3. Trigger AI engine asynchronously (do not await — respond immediately)
  triggerAIEngine(uuid, pdfUrl, userId, req.file.originalname);

  return res.status(200).json({ uuid, status: 'processing' });
});

// ---------------------------------------------------------------------------
// Route-level error handler (multer errors)
// ---------------------------------------------------------------------------
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: 'File too large. Maximum size is 20 MB.' });
  if (err.code === 'INVALID_TYPE')
    return res.status(400).json({ error: 'Only PDF files are accepted.' });
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
