const express = require('express');
const { getPool } = require('../db');
const { HttpError, wrap, round2, rupees } = require('../utils');

const router = express.Router();

/**
 * Runs one buy or sell inside a database transaction. Rows are locked with
 * SELECT ... FOR UPDATE so two quick clicks (or two browser tabs) can never
 * spend the same money or sell the same shares twice.
 * The price used is ALWAYS the server's current price, never one sent by the browser.
 */
async function execute(type, userId, symbolRaw, quantityRaw) {
  const symbol = String(symbolRaw || '').toUpperCase();
  const quantity = Number(quantityRaw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000)
    throw new HttpError(400, 'Quantity must be a whole number between 1 and 1,00,000.');

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    const [[user]] = await conn.query('SELECT id, balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!user) throw new HttpError(401, 'Account not found. Please log in again.');
    const [[stock]] = await conn.query('SELECT * FROM stocks WHERE symbol = ? FOR UPDATE', [symbol]);
    if (!stock) throw new HttpError(404, 'That stock does not exist.');

    const price = stock.price;
    const total = round2(price * quantity);
    let realized = null;

    if (type === 'BUY') {
      if (total > user.balance)
        throw new HttpError(400,
          `Insufficient balance. This order costs ${rupees(total)} but you have ${rupees(user.balance)}.`);

      await conn.query('UPDATE users SET balance = balance - ? WHERE id = ?', [total, userId]);
      await conn.query(
        `INSERT INTO holdings (user_id, stock_id, quantity, total_cost) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), total_cost = total_cost + VALUES(total_cost)`,
        [userId, stock.id, quantity, total]
      );
    } else {
      const [[h]] = await conn.query(
        'SELECT id, quantity, total_cost FROM holdings WHERE user_id = ? AND stock_id = ? FOR UPDATE',
        [userId, stock.id]
      );
      if (!h) throw new HttpError(400, `You do not own any shares of ${stock.name}.`);
      if (quantity > h.quantity)
        throw new HttpError(400, `You only own ${h.quantity} share${h.quantity === 1 ? '' : 's'} of ${stock.name}.`);

      const costRemoved = quantity === h.quantity ? h.total_cost : round2((h.total_cost / h.quantity) * quantity);
      realized = round2(total - costRemoved);

      if (quantity === h.quantity) {
        await conn.query('DELETE FROM holdings WHERE id = ?', [h.id]);
      } else {
        await conn.query(
          'UPDATE holdings SET quantity = quantity - ?, total_cost = total_cost - ? WHERE id = ?',
          [quantity, costRemoved, h.id]
        );
      }
      await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [total, userId]);
    }

    const [r] = await conn.query(
      `INSERT INTO transactions (user_id, stock_id, type, quantity, price, total, realized_pl)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, stock.id, type, quantity, price, total, realized]
    );
    const [[after]] = await conn.query('SELECT balance FROM users WHERE id = ?', [userId]);
    await conn.commit();

    const verb = type === 'BUY' ? 'Bought' : 'Sold';
    return {
      message: `${verb} ${quantity} share${quantity === 1 ? '' : 's'} of ${stock.name} at ${rupees(price)}.`,
      transaction: { id: r.insertId, type, symbol: stock.symbol, name: stock.name, quantity, price, total, realizedPl: realized },
      balance: after.balance,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

router.post('/trade/buy',  wrap(async (req, res) =>
  res.status(201).json(await execute('BUY',  req.userId, req.body.symbol, req.body.quantity))));
router.post('/trade/sell', wrap(async (req, res) =>
  res.status(201).json(await execute('SELL', req.userId, req.body.symbol, req.body.quantity))));

module.exports = router;
