const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { COOKIE_NAME } = require('../middleware/auth');

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sendTokenCookie(res, token, rememberMe) {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 days vs 1 day
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
  });
}

exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Log In', error: req.flashError || null });
};

exports.getSignup = (req, res) => {
  res.render('auth/signup', { title: 'Sign Up', error: null });
};

exports.postSignup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('auth/signup', {
      title: 'Sign Up',
      error: errors.array()[0].msg,
    });
  }

  const { name, email, phone, password } = req.body;

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).render('auth/signup', {
        title: 'Sign Up',
        error: 'An account with this email already exists.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
    });

    const token = signToken(user._id);
    sendTokenCookie(res, token, false);

    res.redirect('/dashboard');
  } catch (err) {
    console.error('[Auth] Signup error:', err.message);
    res.status(500).render('auth/signup', {
      title: 'Sign Up',
      error: 'Something went wrong. Please try again.',
    });
  }
};

exports.postLogin = async (req, res) => {
  const { email, password, rememberMe } = req.body;

  try {
    const user = await User.findOne({ email: (email || '').toLowerCase() });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).render('auth/login', {
        title: 'Log In',
        error: 'Invalid email or password.',
      });
    }

    if (user.status === 'banned') {
      return res.status(403).render('auth/login', {
        title: 'Log In',
        error: 'Your account has been banned. Contact support.',
      });
    }

    const token = signToken(user._id);
    sendTokenCookie(res, token, rememberMe === 'on' || rememberMe === true);

    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).render('auth/login', {
      title: 'Log In',
      error: 'Something went wrong. Please try again.',
    });
  }
};

/**
 * Runs after passport's 'google' strategy has already resolved req.user
 * (see config/passport.js + routes/authRoutes.js). We deliberately do NOT
 * rely on a Passport session here - we issue our own JWT cookie exactly
 * like postLogin does, so the rest of the app (middleware/auth.js protect)
 * keeps working completely unchanged for Google-authenticated users too.
 */
exports.googleCallback = (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      req.flashError = 'Google login failed. Please try again.';
      return res.redirect('/login');
    }

    if (user.status === 'banned') {
      return res.status(403).render('auth/login', {
        title: 'Log In',
        error: 'Your account has been banned. Contact support.',
      });
    }

    const token = signToken(user._id);
    sendTokenCookie(res, token, false); // Google login doesn't have a "remember me" checkbox

    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[Auth] Google callback error:', err.message);
    req.flashError = 'Something went wrong during Google login.';
    res.redirect('/login');
  }
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect('/login');
};

exports.getProfile = (req, res) => {
  res.render('profile', {
    title: 'My Profile',
    appUrl: process.env.APP_URL || `${req.protocol}://${req.get('host')}`,
    message: null,
    error: null,
  });
};

exports.postChangePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

  try {
    if (newPassword !== confirmPassword) {
      return res.status(400).render('profile', {
        title: 'My Profile',
        appUrl,
        message: null,
        error: 'New passwords do not match.',
      });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).render('profile', {
        title: 'My Profile',
        appUrl,
        message: null,
        error: 'Current password is incorrect.',
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.render('profile', {
      title: 'My Profile',
      appUrl,
      message: 'Password updated successfully.',
      error: null,
    });
  } catch (err) {
    console.error('[Auth] Change password error:', err.message);
    res.status(500).render('profile', {
      title: 'My Profile',
      appUrl,
      message: null,
      error: 'Something went wrong. Please try again.',
    });
  }
};

exports.regenerateApiKey = async (req, res) => {
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  try {
    const user = await User.findById(req.user._id);
    user.regenerateApiKey();
    await user.save();
    req.user = user;
    res.render('profile', {
      title: 'My Profile',
      appUrl,
      message: 'API key regenerated.',
      error: null,
    });
  } catch (err) {
    console.error('[Auth] Regenerate API key error:', err.message);
    res.redirect('/profile');
  }
};
