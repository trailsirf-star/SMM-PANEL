const express = require('express');
const { protect } = require('../middleware/auth');
const pagesController = require('../controllers/pagesController');

const router = express.Router();

// Public — also linked from the logged-out footer.
router.get('/terms', pagesController.getTerms);

// Logged-in only — part of the user dashboard sidebar.
router.get('/refer-earn', protect, pagesController.getReferEarn);
router.get('/reviews', protect, pagesController.getReviews);

module.exports = router;
