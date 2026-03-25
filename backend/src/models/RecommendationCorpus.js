const mongoose = require('mongoose');

const recommendationCorpusSchema = new mongoose.Schema({
  title: { type: String, required: true },
  authors: [String],
  abstract: { type: String, required: true },
  embedding: [Number],
  source: String,
});

module.exports = mongoose.model('RecommendationCorpus', recommendationCorpusSchema);
