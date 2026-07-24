const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

router.get('/', (req, res) => res.redirect('/login'));
router.get('/signup', authController.getSignup);
router.post('/signup', limiter, authController.postSignup);
router.get('/login', authController.getLogin);
router.post('/login', limiter, authController.postLogin);
router.get('/logout', authController.logout);

module.exports = router;