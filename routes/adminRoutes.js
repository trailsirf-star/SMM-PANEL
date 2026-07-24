const express = require('express');
const router = express.Router();
const { adminProtect } = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

router.use(adminProtect);

router.get('/dashboard', adminController.getDashboard);
router.get('/orders', adminController.getOrders);

router.get('/payments', adminController.getPayments);
router.post('/payments/:id/approve', adminController.approvePayment);
router.post('/payments/:id/reject', adminController.rejectPayment);

router.get('/users', adminController.getUsers);
router.post('/users/:id/balance', adminController.adjustBalance);
router.post('/users/:id/ban', adminController.toggleBanUser);

router.get('/services', adminController.getServices);
router.get('/api-providers', adminController.getApiProviders);
router.post('/api-providers', adminController.addProvider);
router.post('/api-providers/:id/test', adminController.testProvider);
router.post('/api-providers/:id/import', adminController.importServices);

router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);

module.exports = router;