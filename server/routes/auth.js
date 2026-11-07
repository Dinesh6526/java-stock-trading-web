const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { getPool } = require('../db');
const { HttpError, wrap } = require('../utils');

const router = express.Router();

// Slow down password guessing: 30 attempts per 15 minutes per IP.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const sign = (user) =>
  jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: '7d' });

const publicUser = (u) => ({ id: u.id, username: u.username, balance: u.balance });

router.post('/register', limiter, wrap(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username))
    throw new HttpError(400, 'Username must be 3-20 characters: letters, numbers or underscore.');
  if (password.length < 6 || password.length > 72)
    throw new HttpError(400, 'Password must be 6-72 characters.');

  const pool = getPool();
  const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  if (existing.length) throw new HttpError(409, 'That username is taken. Try another one.');

  const hash = await bcrypt.hash(password, 10);
  const [r] = await pool.query(
    'INSERT INTO users (username, password_hash, balance) VALUES (?, ?, ?)',
    [username, hash, config.startingBalance]
  );
  const user = { id: r.insertId, username, balance: config.startingBalance };
  res.status(201).json({ token: sign(user), user: publicUser(user) });
}));

router.post('/login', limiter, wrap(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  const [rows] = await getPool().query('SELECT * FROM users WHERE username = ?', [username]);
  const user = rows[0];
  // same message for "no such user" and "wrong password"
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    throw new HttpError(401, 'Wrong username or password.');

  res.json({ token: sign(user), user: publicUser(user) });
}));

module.exports = router;
