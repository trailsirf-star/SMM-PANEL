const express = require('express');
const { protect } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.get('/new', protect, orderController.getNewOrderPage);
router.post('/new', protect, orderController.createOrder);

router.get('/', protect, orderController.getOrdersPage);

module.exports = router;
