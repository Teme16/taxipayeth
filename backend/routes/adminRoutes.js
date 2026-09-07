'use strict';

const express = require('express');

const router = express.Router();

/*
 * adminAuth is an array: [protect, authorize('admin')].
 * We spread it into each route definition so Express
 * receives individual middleware functions.
 */
const adminAuth = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

const {
    listUsers,
    getUser,
    updateUser,
    updateStatus,
    approveUser,
    deleteUser,
    resetPassword,
    listTransactions,
    listTrips,
    listRoutes,
    createRoute,
    updateRoute,
    deleteRoute,
    stats,
    getAnalytics,
    listLogs
} = adminController;

/* =========================
   USER MANAGEMENT
========================= */

router.get(
    '/users',
    ...adminAuth,
    listUsers
);

router.get(
    '/users/:id',
    ...adminAuth,
    getUser
);

router.put(
    '/users/:id',
    ...adminAuth,
    updateUser
);

router.patch(
    '/users/:id/status',
    ...adminAuth,
    updateStatus
);

router.patch(
    '/users/:id/approve',
    ...adminAuth,
    approveUser
);

router.delete(
    '/users/:id',
    ...adminAuth,
    deleteUser
);

router.patch(
    '/users/:id/reset-password',
    ...adminAuth,
    resetPassword
);

/* =========================
   TRANSACTIONS
========================= */

router.get(
    '/transactions',
    ...adminAuth,
    listTransactions
);

/* =========================
   TRIPS
========================= */

router.get(
    '/trips',
    ...adminAuth,
    listTrips
);

/* =========================
   ROUTES
========================= */

router.get(
    '/routes',
    ...adminAuth,
    listRoutes
);

router.post(
    '/routes',
    ...adminAuth,
    createRoute
);

router.put(
    '/routes/:id',
    ...adminAuth,
    updateRoute
);

router.delete(
    '/routes/:id',
    ...adminAuth,
    deleteRoute
);

/* =========================
   DASHBOARD
========================= */

router.get(
    '/stats',
    ...adminAuth,
    stats
);

router.get(
    '/analytics',
    ...adminAuth,
    getAnalytics
);

router.get(
    '/logs',
    ...adminAuth,
    listLogs
);

module.exports = router;