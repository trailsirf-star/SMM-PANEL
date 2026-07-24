const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
    let token;
    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        req.flash('error_msg', 'Please log in to access this page');
        return res.redirect('/');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
        if (!req.user || req.user.status === 'banned') {
            res.clearCookie('token');
            req.flash('error_msg', 'Account not found or banned');
            return res.redirect('/');
        }
        next();
    } catch (err) {
        req.flash('error_msg', 'Session expired, please log in again');
        return res.redirect('/');
    }
};