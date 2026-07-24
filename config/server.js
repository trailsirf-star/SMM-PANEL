require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const helmet = require('helmet');
const cors = require('cors');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const session = require('express-session');
const path = require('path');

// Connect Database
connectDB();

const app = express();

// Security
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());

// Body Parser
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Static
app.use(express.static(path.join(__dirname, 'public')));

// EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Express Session & Flash
app.use(session({
    secret: process.env.JWT_SECRET,
    resave: true,
    saveUninitialized: true
}));
app.use(flash());

// Global Vars
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

// Routes
app.use('/', require('./routes/authRoutes'));
app.use('/dashboard', require('./routes/userRoutes'));
app.use('/orders', require('./routes/orderRoutes'));
app.use('/funds', require('./routes/fundsRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/api/v2', require('./routes/apiRoutes'));

// Error Handler
app.use((req, res) => {
    res.status(404).render('404', { layout: 'layout' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start Cron Jobs
    require('./cron')();
});