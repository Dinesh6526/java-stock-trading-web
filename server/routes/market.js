const express = require('express');
const { getPool } = require('../db');
const { HttpError, wrap } = require('../utils');
const { toDto } = require('../market');

const router = express.Router();

// All stocks. Optional ?search=tata&sector=IT
router.get('/stocks', wrap(async (req, res) => {
  const [rows] = await getPool().query('SELECT * FROM stocks ORDER BY symbol');
  const search = String(req.query.search || '').trim().toLowerCase();
  const sector = String(req.query.sector || '').trim();

  let list = rows.map(toDto);
  if (search) list = list.filter((s) => s.symbol.toLowerCase().includes(search) || s.name.toLowerCase().includes(search));
  if (sector) list = list.filter((s) => s.sector === sector);

  const sectors = [...new Set(rows.map((r) => r.sector))].sort();
  res.json({ stocks: list, sectors });
}));

// One stock, with price history for the chart and how many shares the user owns.
router.get('/stocks/:symbol', wrap(async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM stocks WHERE symbol = ?', [req.params.symbol.toUpperCase()]);
  if (!rows[0]) throw new HttpError(404, 'That stock does not exist.');
  const stock = rows[0];

  const [history] = await pool.query(
    'SELECT price, recorded_at AS t FROM price_history WHERE stock_id = ? ORDER BY id DESC LIMIT 150',
    [stock.id]
  );
  const [own] = await pool.query(
    'SELECT quantity, total_cost FROM holdings WHERE user_id = ? AND stock_id = ?',
    [req.userId, stock.id]
  );
  const [[user]] = await pool.query('SELECT balance FROM users WHERE id = ?', [req.userId]);

  res.json({
    stock: toDto(stock),
    history: history.reverse(),
    owned: own[0] ? { quantity: own[0].quantity, avgCost: own[0].total_cost / own[0].quantity } : { quantity: 0, avgCost: 0 },
    balance: user.balance,
  });
}));

module.exports = router;
