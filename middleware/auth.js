const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_NAME = process.env.COOKIE_NAME || 'smm_token';

/**
 * Protects routes that require a logged-in user.
 * Reads JWT from httpOnly cookie, verifies it, loads the user, and attaches
 * it to req.user + res.locals.user (so EJS views can use it directly).
 */
async function protect(req, res, next) {
  try {
    const token = req.cookies ? req.cookies[COOKIE_NAME] : null;

    if (!token) {
      return redirectOrJson(req, res, 'Please log in to continue.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      res.clearCookie(COOKIE_NAME);
      return redirectOrJson(req, res, 'Session expired. Please log in again.');
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      res.clearCookie(COOKIE_NAME);
      return redirectOrJson(req, res, 'Account not found. Please log in again.');
    }

    if (user.status === 'banned') {
      res.clearCookie(COOKIE_NAME);
      return redirectOrJson(req, res, 'Your account has been banned. Contact support.');
    }

    req.user = user;
    res.locals.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function redirectOrJson(req, res, message) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ success: false, error: message });
  }
  req.flashError = message;
  return res.redirect('/login');
}

module.exports = { protect, COOKIE_NAME };
