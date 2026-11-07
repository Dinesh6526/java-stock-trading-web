const express = require('express');
const { getPool } = require('../db');
const { wrap, round2 } = require('../utils');

const router = express.Router();

router.get('/portfolio', wrap(async (req, res) => {
  const pool = getPool();
  const [[user]] = await pool.query('SELECT balance FROM users WHERE id = ?', [req.userId]);
  const [rows] = await pool.query(
    `SELECT s.symbol, s.name, s.sector, s.price, s.prev_close, h.quantity, h.total_cost
       FROM holdings h JOIN stocks s ON s.id = h.stock_id
      WHERE h.user_id = ? ORDER BY s.symbol`, [req.userId]);
  const [[{ realized }]] = await pool.query(
    'SELECT COALESCE(SUM(realized_pl), 0) AS realized FROM transactions WHERE user_id = ? AND type = ?',
    [req.userId, 'SELL']);

  let invested = 0, value = 0, dayChange = 0;
  const holdings = rows.map((r) => {
    const v = round2(r.price * r.quantity);
    const pl = round2(v - r.total_cost);
    invested += r.total_cost;
    value += v;
    dayChange += (r.price - r.prev_close) * r.quantity;
    return {
      symbol: r.symbol, name: r.name, sector: r.sector, quantity: r.quantity,
      avgCost: round2(r.total_cost / r.quantity), price: r.price,
      invested: round2(r.total_cost), value: v, pl,
      plPct: r.total_cost ? round2((pl / r.total_cost) * 100) : 0,
    };
  });

  invested = round2(invested); value = round2(value);
  const pl = round2(value - invested);
  res.json({
    cash: user.balance,
    holdings,
    totals: {
      invested, value, pl,
      plPct: invested ? round2((pl / invested) * 100) : 0,
      dayChange: round2(dayChange),
      realized: round2(realized),
      netWorth: round2(user.balance + value),
    },
  });
}));

// Transaction history. ?type=BUY|SELL &symbol=TCS &page=1 &limit=15
router.get('/transactions', wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const where = ['t.user_id = ?'];
  const args = [req.userId];
  if (['BUY', 'SELL'].includes(req.query.type)) { where.push('t.type = ?'); args.push(req.query.type); }
  if (req.query.symbol) { where.push('s.symbol = ?'); args.push(String(req.query.symbol).toUpperCase()); }

  const pool = getPool();
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM transactions t JOIN stocks s ON s.id = t.stock_id WHERE ${where.join(' AND ')}`, args);
  const [items] = await pool.query(
    `SELECT t.id, t.type, s.symbol, s.name, t.quantity, t.price, t.total, t.realized_pl AS realizedPl, t.created_at AS createdAt
       FROM transactions t JOIN stocks s ON s.id = t.stock_id
      WHERE ${where.join(' AND ')} ORDER BY t.id DESC LIMIT ? OFFSET ?`,
    [...args, limit, (page - 1) * limit]);

  res.json({ items, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
}));

module.exports = router;
