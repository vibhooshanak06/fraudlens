require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectMongo } = require('./db');
const pool = require('./mysql');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/upload', require('./routes/upload'));
app.use('/analyze', require('./routes/analyze'));
app.use('/chat', require('./routes/chat'));
app.use('/recommend', require('./routes/recommend'));
app.use('/paper', require('./routes/paper'));
app.use('/dashboard', require('./routes/dashboard'));

// JSON parse error
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON in request body' });
  next(err);
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack?.split('\n')[0] || err.message);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  // Verify MySQL connection then start
  pool.query('SELECT 1')
    .then(() => {
      console.log('MySQL connected');
      connectMongo(); // non-blocking
      app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
    })
    .catch(err => {
      console.error('MySQL connection failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;
