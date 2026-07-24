const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.adminProtect = async (req, res, next) => {
    let token;
    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.redirect('/');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
        if (!req.user || req.user.role !== 'admin') {
            return res.redirect('/dashboard');
        }
        next();
    } catch (err) {
        return res.redirect('/');
    }
};