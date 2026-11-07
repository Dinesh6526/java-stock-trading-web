const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

// Creates the database (if missing), the tables, and returns the pool.
async function initDb() {
  const { host, port, user, password, name } = config.db;

  const admin = await mysql.createConnection({ host, port, user, password });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await admin.end();

  pool = mysql.createPool({
    host, port, user, password,
    database: name,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,   // return DECIMAL columns as JS numbers, not strings
    timezone: 'Z',
  });
  // Make CURRENT_TIMESTAMP agree with the 'Z' (UTC) setting above.
  pool.pool.on('connection', (c) => c.query("SET time_zone = '+00:00'"));

  const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  const statements = sql
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);
  for (const s of statements) await pool.query(s);

  return pool;
}

const getPool = () => pool;

module.exports = { initDb, getPool };
