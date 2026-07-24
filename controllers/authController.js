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
        console.error('[Signup Error]', err);
        req.flash('error_msg', 'Server Error');
        res.redirect('/signup');
    }
};

exports.postLogin = async (req, res) => {
    const { email, password, remember } = req.body;
    console.log('[Login Attempt] Email:', email);
    
    try {
        const user = await User.findOne({ email });
        console.log('[Login] User found?', !!user);
        
        if (!user) {
            console.log('[Login] User not found for email:', email);
            req.flash('error_msg', 'Invalid credentials');
            return res.redirect('/login');
        }
        
        const passwordMatches = await user.matchPassword(password);
        console.log('[Login] Password matches?', passwordMatches);
        
        if (!passwordMatches) {
            console.log('[Login] Password mismatch for user:', email);
            req.flash('error_msg', 'Invalid credentials');
            return res.redirect('/login');
        }
        
        if (user.status === 'banned') {
            console.log('[Login] User banned:', email);
            req.flash('error_msg', 'Your account is banned');
            return res.redirect('/login');
        }
        
        const token = generateToken(user._id, remember);
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        console.log('[Login] Success for user:', email, 'Role:', user.role);
        
        if (user.role === 'admin') return res.redirect('/admin/dashboard');
        res.redirect('/dashboard');
    } catch (err) {
        console.error('[Login Error]', err);
        req.flash('error_msg', 'Server Error');
        res.redirect('/login');
    }
};

exports.logout = (req, res) => {
    res.clearCookie('token');
    req.flash('success_msg', 'You are logged out');
    res.redirect('/login');
};

