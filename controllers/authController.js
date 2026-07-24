const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Settings = require('../models/Settings');

const generateToken = (id, remember) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: remember ? '30d' : '1d'
    });
};

exports.getSignup = (req, res) => res.render('auth/signup');
exports.getLogin = (req, res) => res.render('auth/login');

exports.postSignup = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            req.flash('error_msg', 'Email already registered');
            return res.redirect('/signup');
        }
        user = await User.create({ name, email, password });
        const token = generateToken(user._id, false);
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        req.flash('success_msg', 'Account created successfully');
        res.redirect('/dashboard');
    } catch (err) {
        req.flash('error_msg', 'Server Error');
        res.redirect('/signup');
    }
};

exports.postLogin = async (req, res) => {
    const { email, password, remember } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password))) {
            req.flash('error_msg', 'Invalid credentials');
            return res.redirect('/login');
        }
        if (user.status === 'banned') {
            req.flash('error_msg', 'Your account is banned');
            return res.redirect('/login');
        }
        const token = generateToken(user._id, remember);
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        
        if (user.role === 'admin') return res.redirect('/admin/dashboard');
        res.redirect('/dashboard');
    } catch (err) {
        req.flash('error_msg', 'Server Error');
        res.redirect('/login');
    }
};

exports.logout = (req, res) => {
    res.clearCookie('token');
    req.flash('success_msg', 'You are logged out');
    res.redirect('/login');
};