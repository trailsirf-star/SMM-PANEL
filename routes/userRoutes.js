const express = require('express');
const { protect } = require('../middleware/auth');
const serviceController = require('../controllers/serviceController');

const router = express.Router();

router.get('/dashboard', protect, serviceController.getDashboard);
router.get('/services', protect, serviceController.getServicesPage);

module.exports = router;
