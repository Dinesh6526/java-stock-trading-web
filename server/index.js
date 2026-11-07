const path = require('path');
const express = require('express');
const config = require('./config');
const { initDb } = require('./db');
const { seedIfEmpty } = require('./seed');
const { loadRecent, startEngine } = require('./market');
const requireAuth = require('./middleware/auth');

async function main() {
  await initDb();
  await seedIfEmpty();
  await loadRecent();
  startEngine(config.tickMs);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  // ---- API ----
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api', requireAuth, require('./routes/user'));
  app.use('/api', requireAuth, require('./routes/market'));
  app.use('/api', requireAuth, require('./routes/trade'));
  app.use('/api', requireAuth, require('./routes/portfolio'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // ---- Website (static files) ----
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

  // ---- Errors: always answer with { error: "message" } ----
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });

  app.listen(config.port, () => {
    console.log(`TradeSim running at http://localhost:${config.port}`);
  });
}

main().catch((e) => {
  console.error('\nCould not start TradeSim:', e.message);
  if (/ECONNREFUSED|ER_ACCESS_DENIED|ENOTFOUND/.test(e.code || e.message)) {
    console.error('Check that MySQL is running and that DB_USER / DB_PASSWORD in your .env file are correct.');
  }
  process.exit(1);
});
