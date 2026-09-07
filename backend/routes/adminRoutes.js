const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

router.get('/users', adminAuth, adminController.listUsers);
router.get('/users/:id', adminAuth, adminController.getUser);
router.put('/users/:id', adminAuth, adminController.updateUser);
router.patch('/users/:id/status', adminAuth, adminController.updateStatus);
router.patch('/users/:id/approve', adminAuth, adminController.approveUser);
router.delete('/users/:id', adminAuth, adminController.deleteUser);
router.patch('/users/:id/reset-password', adminAuth, adminController.resetPassword || adminController.updateUser);

router.get('/transactions', adminAuth, adminController.listTransactions);
router.get('/trips', adminAuth, adminController.listTrips);
router.get('/routes', adminAuth, adminController.listRoutes);
router.post('/routes', adminAuth, adminController.createRoute);
router.put('/routes/:id', adminAuth, adminController.updateRoute);
router.delete('/routes/:id', adminAuth, adminController.deleteRoute);
router.get('/stats', adminAuth, adminController.stats);
router.get('/analytics', adminAuth, adminController.getAnalytics);
router.get('/logs', adminAuth, adminController.listLogs);

module.exports = router;
