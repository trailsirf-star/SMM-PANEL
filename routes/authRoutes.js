const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const passport = require('passport');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts. Please try again later.' },
});

router.get('/signup', authController.getSignup);
router.post(
  '/signup',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  ],
  authController.postSignup
);

router.get('/login', authController.getLogin);
router.post('/login', authLimiter, authController.postLogin);

// Google OAuth 2.0 - session: false because this app authenticates via its
// own JWT cookie (see authController.googleCallback), not Passport sessions.
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authController.googleCallback
);

router.get('/logout', authController.logout);

router.get('/profile', protect, authController.getProfile);
router.post('/profile/change-password', protect, authController.postChangePassword);
router.post('/profile/regenerate-api-key', protect, authController.regenerateApiKey);

module.exports = router;
