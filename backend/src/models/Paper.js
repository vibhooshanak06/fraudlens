const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  type: { type: String },
  description: String,
  excerpt: String,
}, { _id: false });

const fraudReportSchema = new mongoose.Schema({
  plagiarism_score: Number,
  risk_level: { type: String, enum: ['low', 'medium', 'high'] },
  issues: [issueSchema],
}, { _id: false });

const summarySchema = new mongoose.Schema({
  title: String,
  main_contributions: String,
  methodology: String,
  conclusions: String,
}, { _id: false });

const paperSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true, index: true },
  filename: { type: String, required: true },
  file_path: { type: String, required: true },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
  uploaded_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true },
  extracted_text: { type: String, default: '' },
  summary: summarySchema,
  fraud_report: fraudReportSchema,
  keywords: [String],
});

module.exports = mongoose.model('Paper', paperSchema);
