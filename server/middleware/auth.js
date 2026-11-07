const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError } = require('../utils');

// Protects a route: requires "Authorization: Bearer <token>".
module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please log in to continue.'));
  try {
    req.userId = jwt.verify(token, config.jwtSecret).id;
    next();
  } catch (e) {
    next(new HttpError(401, 'Your session has expired. Please log in again.'));
  }
};
