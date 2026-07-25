const express = require('express');
const { protect } = require('../middleware/auth');
const adminOnly = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Every route below requires a logged-in user AND role === 'admin'.
router.use(protect, adminOnly);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Orders
router.get('/orders', adminController.getOrders);
router.post('/orders/:id/refresh', adminController.refreshOrderStatus);

// Payments / Fund requests
router.get('/payments', adminController.getPayments);
router.post('/payments/:id/approve', adminController.approvePayment);
router.post('/payments/:id/reject', adminController.rejectPayment);

// Users
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetail);
router.post('/users/:id/adjust-balance', adminController.adjustBalance);
router.post('/users/:id/toggle-ban', adminController.toggleBan);

// Services
router.get('/services', adminController.getServices);
router.post('/services', adminController.createService);
router.post('/services/:id/update', adminController.updateService);
router.post('/services/:id/delete', adminController.deleteService);
router.post('/services/import/:providerId', adminController.importServicesFromProvider);
router.post('/services/apply-commission', adminController.applyCommissionToServices);
router.post('/services/bulk-status', adminController.bulkUpdateServiceStatus);

// API Providers
router.get('/api-providers', adminController.getApiProviders);
router.post('/api-providers', adminController.createApiProvider);
router.post('/api-providers/:id/test', adminController.testApiProviderConnection);
router.post('/api-providers/:id/toggle', adminController.toggleApiProviderActive);
router.post('/api-providers/:id/delete', adminController.deleteApiProvider);

// Settings
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);

module.exports = router;
