/**
 * Initialize MySQL database schema for FraudLens auth + paper metadata
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function init() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('Connected to MySQL');

  await conn.query(`CREATE DATABASE IF NOT EXISTS fraudlens CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.query(`USE fraudlens;`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(120) NOT NULL,
      email       VARCHAR(191) NOT NULL UNIQUE,
      password    VARCHAR(255) NOT NULL,
      role        ENUM('researcher','admin') NOT NULL DEFAULT 'researcher',
      plan        ENUM('free','pro') NOT NULL DEFAULT 'free',
      avatar      VARCHAR(10) NOT NULL DEFAULT '',
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email)
    ) ENGINE=InnoDB;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id     INT UNSIGNED NOT NULL,
      token_hash  VARCHAR(255) NOT NULL UNIQUE,
      expires_at  DATETIME NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token_hash),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS papers (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      uuid            VARCHAR(36) NOT NULL UNIQUE,
      user_id         INT UNSIGNED NOT NULL,
      filename        VARCHAR(255) NOT NULL,
      file_path       VARCHAR(500) NOT NULL,
      status          ENUM('processing','completed','failed') NOT NULL DEFAULT 'processing',
      risk_level      ENUM('low','medium','high') NULL,
      plagiarism_score DECIMAL(5,4) NULL,
      issue_count     INT UNSIGNED NOT NULL DEFAULT 0,
      uploaded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at      DATETIME NOT NULL,
      completed_at    DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_uuid (uuid),
      INDEX idx_user_status (user_id, status),
      INDEX idx_uploaded (uploaded_at)
    ) ENGINE=InnoDB;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS dashboard_stats (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id         INT UNSIGNED NOT NULL UNIQUE,
      total_analyses  INT UNSIGNED NOT NULL DEFAULT 0,
      high_risk_count INT UNSIGNED NOT NULL DEFAULT 0,
      avg_plagiarism  DECIMAL(5,4) NOT NULL DEFAULT 0,
      cleared_count   INT UNSIGNED NOT NULL DEFAULT 0,
      updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  console.log('✅ Tables created: users, sessions, papers, dashboard_stats');
  await conn.end();
}

init().catch(e => { console.error('Init failed:', e.message); process.exit(1); });
