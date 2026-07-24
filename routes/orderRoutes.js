const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

router.use(protect);
router.get('/new', orderController.getNewOrder);
router.post('/new', orderController.postNewOrder);
router.get('/', orderController.getMyOrders);
router.get('/status', orderController.getOrderStatuses); // For AJAX auto-refresh

module.exports = router;