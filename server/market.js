// The price engine. Every few seconds each stock moves a little (a random
// walk that is gently pulled back toward its base price so it never drifts
// to zero). All prices are SIMULATED - nothing here is real market data.
const { getPool } = require('./db');
const { round2 } = require('./utils');

const SPARK_POINTS = 30;
const recent = new Map();   // symbol -> last prices, used for the small sparkline charts
let tickCount = 0;

async function loadRecent() {
  const pool = getPool();
  const [stocks] = await pool.query('SELECT id, symbol FROM stocks');
  for (const s of stocks) {
    const [rows] = await pool.query(
      'SELECT price FROM price_history WHERE stock_id = ? ORDER BY id DESC LIMIT ?',
      [s.id, SPARK_POINTS]
    );
    recent.set(s.symbol, rows.map((r) => r.price).reverse());
  }
}

async function tick() {
  const pool = getPool();
  const [stocks] = await pool.query('SELECT * FROM stocks');
  tickCount++;

  for (const s of stocks) {
    const pull = 0.002 * ((s.base_price - s.price) / s.price);   // gentle pull to base price
    const shock = (Math.random() * 2 - 1) * s.volatility;        // random move
    const price = Math.max(1, round2(s.price * (1 + pull + shock)));

    // New UTC day -> yesterday's last price becomes "previous close" (MySQL evaluates SET left to right,
    // so prev_close still sees the OLD price here, because price is assigned last).
    await pool.query(
      `UPDATE stocks
          SET prev_close = IF(prev_close_date < UTC_DATE(), price, prev_close),
              prev_close_date = UTC_DATE(),
              price = ?
        WHERE id = ?`,
      [price, s.id]
    );
    await pool.query('INSERT INTO price_history (stock_id, price) VALUES (?, ?)', [s.id, price]);

    const list = recent.get(s.symbol) || [];
    list.push(price);
    if (list.length > SPARK_POINTS) list.shift();
    recent.set(s.symbol, list);

    // keep only the latest 600 history rows per stock
    if (tickCount % 100 === 0) {
      await pool.query(
        `DELETE FROM price_history WHERE stock_id = ? AND id < (
           SELECT MIN(id) FROM (SELECT id FROM price_history WHERE stock_id = ? ORDER BY id DESC LIMIT 600) t)`,
        [s.id, s.id]
      );
    }
  }
}

function startEngine(intervalMs) {
  const timer = setInterval(() => tick().catch((e) => console.error('Price tick failed:', e.message)), intervalMs);
  timer.unref();
  return timer;
}

// Turns a database row into what the website needs.
function toDto(s) {
  const change = round2(s.price - s.prev_close);
  return {
    symbol: s.symbol,
    name: s.name,
    sector: s.sector,
    price: s.price,
    prevClose: s.prev_close,
    change,
    changePct: s.prev_close ? round2((change / s.prev_close) * 100) : 0,
    spark: recent.get(s.symbol) || [s.price],
  };
}

module.exports = { loadRecent, startEngine, tick, toDto };
