// Fills an empty database with demo data: 15 simulated stocks, some price
// history for the charts, and a demo account (demo / demo123).
const bcrypt = require('bcryptjs');
const { getPool } = require('./db');
const { round2 } = require('./utils');

// Prices are invented for practice. volatility = max move per tick.
const STOCKS = [
  ['TCS',        'Tata Consultancy Services', 'IT',          3850.00, 0.0025],
  ['INFY',       'Infosys',                   'IT',          1520.50, 0.0030],
  ['WIPRO',      'Wipro',                     'IT',           545.60, 0.0035],
  ['RELIANCE',   'Reliance Industries',       'Energy',      2890.75, 0.0030],
  ['HDFCBANK',   'HDFC Bank',                 'Banking',     1675.20, 0.0025],
  ['ICICIBANK',  'ICICI Bank',                'Banking',     1240.00, 0.0030],
  ['SBIN',       'State Bank of India',       'Banking',      812.40, 0.0035],
  ['ITC',        'ITC',                       'FMCG',         465.30, 0.0025],
  ['HINDUNILVR', 'Hindustan Unilever',        'FMCG',        2410.00, 0.0020],
  ['BHARTIARTL', 'Bharti Airtel',             'Telecom',     1685.90, 0.0030],
  ['LT',         'Larsen & Toubro',           'Infrastructure', 3640.00, 0.0030],
  ['MARUTI',     'Maruti Suzuki',             'Auto',       12480.00, 0.0030],
  ['TATAMOTORS', 'Tata Motors',               'Auto',         985.25, 0.0045],
  ['SUNPHARMA',  'Sun Pharmaceutical',        'Pharma',      1745.80, 0.0030],
  ['TATASTEEL',  'Tata Steel',                'Metals',       158.40, 0.0045],
];

// Demo account activity: [symbol, type, quantity, price multiplier].
// Keep these seeded trades close to the current time so the history page reflects
// the current date/time instead of outdated demo dates.
const DEMO_TRADES = [
  ['TCS',      'BUY', 10, 0.97],
  ['INFY',     'BUY', 25, 1.02],
  ['RELIANCE', 'BUY', 15, 0.96],
  ['ITC',      'BUY', 120, 1.03],
  ['HDFCBANK', 'BUY', 30, 0.99],
  ['TATAMOTORS','BUY', 40, 1.04],
  ['ITC',      'SELL', 40, 1.05],
  ['SBIN',     'BUY', 50, 0.98],
  ['TATAMOTORS','SELL', 15, 0.97],
];

async function seedIfEmpty() {
  const pool = getPool();
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM stocks');
  if (n > 0) return false;

  console.log('Empty database - loading demo data...');

  // 1) stocks + ~90 minutes of price history that ends at today's price
  const ids = {};
  const baseBySymbol = {};
  for (const [symbol, name, sector, price, vol] of STOCKS) {
    const [r] = await pool.query(
      `INSERT INTO stocks (symbol, name, sector, price, prev_close, prev_close_date, base_price, volatility)
       VALUES (?, ?, ?, ?, ?, UTC_DATE(), ?, ?)`,
      [symbol, name, sector, price, price, price, vol]
    );
    ids[symbol] = r.insertId;
    baseBySymbol[symbol] = price;

    // random walk backwards from the current price
    const points = [price];
    for (let i = 1; i < 90; i++) {
      const prev = points[0];
      points.unshift(round2(Math.max(1, prev * (1 + (Math.random() * 2 - 1) * vol * 1.5))));
    }
    const rows = points.map((p, i) => [r.insertId, p, new Date(Date.now() - (89 - i) * 60000)]);
    await pool.query('INSERT INTO price_history (stock_id, price, recorded_at) VALUES ?', [rows]);
    // yesterday's close = first point, so "today's change" is not zero
    await pool.query('UPDATE stocks SET prev_close = ? WHERE id = ?', [points[0], r.insertId]);
  }

  // 2) demo user
  const hash = await bcrypt.hash('demo123', 10);
  let cash = 1000000;
  const [u] = await pool.query(
    'INSERT INTO users (username, password_hash, balance) VALUES (?, ?, ?)',
    ['demo', hash, cash]
  );
  const userId = u.insertId;
  const held = {}; // symbol -> { qty, cost }

  for (const [symbol, type, qty, factor] of DEMO_TRADES) {
    const price = round2(baseBySymbol[symbol] * factor);
    const total = round2(price * qty);
    const when = new Date();
    const h = (held[symbol] = held[symbol] || { qty: 0, cost: 0 });
    let realized = null;
    if (type === 'BUY') {
      cash = round2(cash - total);
      h.qty += qty;
      h.cost = round2(h.cost + total);
    } else {
      const costRemoved = round2((h.cost / h.qty) * qty);
      realized = round2(total - costRemoved);
      cash = round2(cash + total);
      h.qty -= qty;
      h.cost = round2(h.cost - costRemoved);
    }
    await pool.query(
      `INSERT INTO transactions (user_id, stock_id, type, quantity, price, total, realized_pl, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, ids[symbol], type, qty, price, total, realized, when]
    );
  }
  for (const [symbol, h] of Object.entries(held)) {
    if (h.qty > 0) {
      await pool.query(
        'INSERT INTO holdings (user_id, stock_id, quantity, total_cost) VALUES (?, ?, ?, ?)',
        [userId, ids[symbol], h.qty, h.cost]
      );
    }
  }
  await pool.query('UPDATE users SET balance = ? WHERE id = ?', [cash, userId]);

  console.log('Demo account ready  ->  username: demo   password: demo123');
  return true;
}

module.exports = { seedIfEmpty };
