require('dotenv').config({ quiet: true });

module.exports = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'tradesim',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  startingBalance: Number(process.env.STARTING_BALANCE) || 100000,
  tickMs: Number(process.env.TICK_MS) || 5000,
  maxBalance: 100000000,   // Rs. 10 crore cap on virtual cash
};
