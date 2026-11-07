const express = require('express');
const config = require('../config');
const { getPool } = require('../db');
const { HttpError, wrap, round2, rupees } = require('../utils');

const router = express.Router();

router.get('/me', wrap(async (req, res) => {
  const [rows] = await getPool().query(
    'SELECT id, username, balance, created_at FROM users WHERE id = ?', [req.userId]);
  if (!rows[0]) throw new HttpError(401, 'Account not found. Please log in again.');
  res.json({ user: rows[0] });
}));

// Adds simulated cash.
router.post('/me/funds', wrap(async (req, res) => {
  const amount = round2(Number(req.body.amount));
  if (!Number.isFinite(amount) || amount <= 0)
    throw new HttpError(400, 'Enter an amount greater than zero.');
  if (amount > 1000000)
    throw new HttpError(400, 'You can add up to ₹10,00,000 at a time.');

  const pool = getPool();
  const [[user]] = await pool.query('SELECT balance FROM users WHERE id = ?', [req.userId]);
  if (user.balance + amount > config.maxBalance)
    throw new HttpError(400, `Balance cannot go above ${rupees(config.maxBalance)}.`);

  await pool.query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, req.userId]);
  const [[after]] = await pool.query('SELECT balance FROM users WHERE id = ?', [req.userId]);
  res.json({ message: `Added ${rupees(amount)} to your balance.`, balance: after.balance });
}));

module.exports = router;
