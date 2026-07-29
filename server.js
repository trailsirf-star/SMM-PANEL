require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const passport = require('passport');
require('./config/passport'); // registers the Google OAuth strategy

const connectDB = require('./config/db');
const startCronJobs = require('./cron/index');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const fundsRoutes = require('./routes/fundsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');
const pagesRoutes = require('./routes/pagesRoutes');

const app = express();

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
connectDB();

// ---------------------------------------------------------------------------
// View engine
// ---------------------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout'); // views/layout.ejs wraps every page by default
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// ---------------------------------------------------------------------------
// Security & core middleware
// ---------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: false, // keep off so Bootstrap/Chart.js CDNs work out of the box
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Session + Passport (Google OAuth only)
// ---------------------------------------------------------------------------
// This app's actual authentication/authorization is still 100% the existing
// JWT-in-httpOnly-cookie system (see middleware/auth.js `protect`). This
// session is only here because Passport's middleware chain expects one to
// exist; the Google OAuth route uses { session: false } (see
// routes/authRoutes.js) so no part of the app relies on this session for
// login state - it's never read anywhere else.
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000, // only needs to survive the brief OAuth redirect round-trip
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// General API rate limiter (auth routes have their own stricter limiter)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

// Make the current path available to all views (for active nav highlighting)
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.user = res.locals.user || null;
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/', (req, res) => res.redirect('/login'));

app.use('/', authRoutes); // /login, /signup, /logout, /profile
app.use('/', userRoutes); // /dashboard, /services
app.use('/orders', orderRoutes); // /orders, /orders/new
app.use('/add-funds', fundsRoutes); // /add-funds
app.use('/admin', adminRoutes); // /admin/*
app.use('/api', apiRoutes); // /api/v2, /api/orders/status
app.use('/', pagesRoutes); // /refer-earn, /reviews, /terms

// ---------------------------------------------------------------------------
// 404 + error handling
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Not Found',
    message: 'The page you are looking for does not exist.',
    user: res.locals.user,
  });
});

app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.stack || err.message);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong on our end. Please try again shortly.',
    user: res.locals.user,
  });
});

// ---------------------------------------------------------------------------
// Start server + cron
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Server] SMM Panel running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  startCronJobs();
});
