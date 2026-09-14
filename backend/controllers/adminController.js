'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Trip = require('../models/Trip');
const Route = require('../models/Route');
const SystemLog = require('../models/SystemLog');

const asyncHandler = require('../utils/asyncHandler');

/* =========================================================
   HELPERS
========================================================= */

const createHttpError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const assertValidObjectId = (id, label = 'ID') => {
    if (!mongoose.isValidObjectId(id)) {
        throw createHttpError(
            400,
            `Invalid ${label} identifier.`
        );
    }
};

/* =========================================================
   USER MANAGEMENT
========================================================= */

/**
 * GET /api/admin/users
 * List users with optional filters and pagination.
 */
exports.listUsers = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        role,
        approvalStatus,
        isBlocked,
        search
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const filter = {};

    if (role && ['passenger', 'driver', 'admin'].includes(role)) {
        filter.role = role;
    }

    if (
        approvalStatus &&
        ['pending', 'approved', 'rejected'].includes(approvalStatus)
    ) {
        filter.approvalStatus = approvalStatus;
    }

    if (isBlocked === 'true') {
        filter.isBlocked = true;
    } else if (isBlocked === 'false') {
        filter.isBlocked = false;
    }

    if (search && typeof search === 'string' && search.trim()) {
        const escaped = search.trim().replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

        filter.$or = [
            { name: { $regex: escaped, $options: 'i' } },
            { phone: { $regex: escaped, $options: 'i' } },
            { email: { $regex: escaped, $options: 'i' } }
        ];
    }

    const [users, total] = await Promise.all([
        User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        User.countDocuments(filter)
    ]);

    return res.status(200).json({
        success: true,
        users,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        }
    });
});

/**
 * GET /api/admin/users/:id
 */
exports.getUser = asyncHandler(async (req, res) => {
    assertValidObjectId(req.params.id, 'User');

    const user = await User.findById(req.params.id)
        .select('-password')
        .lean();

    if (!user) {
        throw createHttpError(404, 'User not found.');
    }

    return res.status(200).json({
        success: true,
        user
    });
});

/**
 * PUT /api/admin/users/:id
 */
exports.updateUser = asyncHandler(async (req, res) => {
    assertValidObjectId(req.params.id, 'User');

    const allowedFields = [
        'name', 'email', 'role', 'approvalStatus'
    ];

    const updates = {};

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates[field] = typeof req.body[field] === 'string'
                ? req.body[field].trim()
                : req.body[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        throw createHttpError(
            400,
            'No valid fields provided for update.'
        );
    }

    const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { returnDocument: 'after', runValidators: true }
    ).select('-password');

    if (!user) {
        throw createHttpError(404, 'User not found.');
    }

    await SystemLog.logEvent({
        action: 'admin_update_user',
        level: 'info',
        performedBy: req.user._id,
        targetUser: user._id,
        details: `Updated fields: ${Object.keys(updates).join(', ')}`,
        req
    });

    return res.status(200).json({
        success: true,
        message: 'User updated successfully.',
        user
    });
});

/**
 * PATCH /api/admin/users/:id/status
 * Toggle block/unblock.
 */
exports.updateStatus = asyncHandler(async (req, res) => {
    assertValidObjectId(req.params.id, 'User');

    const { isBlocked } = req.body;

    if (typeof isBlocked !== 'boolean') {
        throw createHttpError(
            422,
            'isBlocked must be a boolean value.'
        );
    }

    const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { isBlocked } },
        { returnDocument: 'after', runValidators: true }
    ).select('-password');

    if (!user) {
        throw createHttpError(404, 'User not found.');
    }

    await SystemLog.logEvent({
        action: isBlocked ? 'admin_block_user' : 'admin_unblock_user',
        level: 'security',
        performedBy: req.user._id,
        targetUser: user._id,
        details: `User ${isBlocked ? 'blocked' : 'unblocked'}.`,
        req
    });

    return res.status(200).json({
        success: true,
        message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully.`,
        user
    });
});

/**
 * PATCH /api/admin/users/:id/approve
 */
exports.approveUser = asyncHandler(async (req, res) => {
    assertValidObjectId(req.params.id, 'User');

    const { approvalStatus } = req.body;

    if (
        !approvalStatus ||
        !['approved', 'rejected'].includes(approvalStatus)
    ) {
        throw createHttpError(
            422,
            'approvalStatus must be "approved" or "rejected".'
        );
    }

    const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { approvalStatus } },
        { returnDocument: 'after', runValidators: true }
    ).select('-password');

    if (!user) {
        throw createHttpError(404, 'User not found.');
    }
   // Send Telegram Notification
    const { bot } = require('../config/telegram');
    if (bot && user.telegramChatId) {
        let msg = '';
        if (approvalStatus === 'approved') {
            const loginUrl = 'https://frontend-nine-lyart-jigjn9fy6c.vercel.app'; // URL to the login page
            msg = `✅ *Account Approved!*\n\nCongratulations ${user.name}, your TaxiPay account has been verified and approved.\n\nYou can now log in and access the system here:\n👉 [Log in to TaxiPay](${loginUrl})`;
        } else if (approvalStatus === 'rejected') {
            msg = `❌ *Account Rejected*\n\nHello ${user.name}, unfortunately your TaxiPay account application has been rejected by our team. Please contact support for more details.`;
        }

        if (msg) {
            bot.sendMessage(user.telegramChatId, msg, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            }).catch(err => console.error('Telegram notification failed:', err));
        }
    }


    await SystemLog.logEvent({
        action: `admin_${approvalStatus}_user`,
        level: 'info',
        performedBy: req.user._id,
        targetUser: user._id,
        details: `User approval status set to "${approvalStatus}".`,
        req
    });

    return res.status(200).json({
        success: true,
        message: `User ${approvalStatus} successfully.`,
        user
    });
});

/**
 * DELETE /api/admin/users/:id
 */
exports.deleteUser = asyncHandler(async (req, res) => {
    assertValidObjectId(req.params.id, 'User');

    if (String(req.params.id) === String(req.user._id)) {
        throw createHttpError(
            403,
            'You cannot delete your own account.'
        );
    }

    const user = await User.findByIdAndDelete(
        req.params.id
    );

    if (!user) {
        throw createHttpError(404, 'User not found.');
    }

    await SystemLog.logEvent({
        action: 'admin_delete_user',
        level: 'security',
        performedBy: req.user._id,
        targetUser: req.params.id,
        details: `Deleted user: ${user.name} (${user.phone}).`,
        req
    });

    return res.status(200).json({
        success: true,
        message: 'User deleted successfully.'
    });
});

/**
 * PATCH /api/admin/users/:id/reset-password
 */
exports.resetPassword = asyncHandler(async (req, res) => {
    assertValidObjectId(req.params.id, 'User');

    const newPassword =
        req.body.newPassword ||
        crypto.randomBytes(6).toString('hex');

    if (newPassword.length < 8 || newPassword.length > 128) {
        throw createHttpError(
            422,
            'Password must be between 8 and 128 characters.'
        );
    }

    const user = await User.findById(req.params.id)
        .select('+password');

    if (!user) {
        throw createHttpError(404, 'User not found.');
    }

    user.password = newPassword;
    await user.save();

    await SystemLog.logEvent({
        action: 'admin_reset_password',
        level: 'security',
        performedBy: req.user._id,
        targetUser: user._id,
        details: 'Password was reset by admin.',
        req
    });

    return res.status(200).json({
        success: true,
        message: 'Password reset successfully.',
        ...(req.body.newPassword
            ? {}
            : { temporaryPassword: newPassword })
    });
});

/* =========================================================
   TRANSACTIONS
========================================================= */

/**
 * GET /api/admin/transactions
 */
exports.listTransactions = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        status,
        type
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const filter = {};

    if (
        status &&
        ['pending', 'completed', 'failed', 'refunded'].includes(status)
    ) {
        filter.status = status;
    }

    if (
        type &&
        ['payment', 'refund', 'payout', 'deposit'].includes(type)
    ) {
        filter.type = type;
    }

    const [transactions, total] = await Promise.all([
        Transaction.find(filter)
            .populate('user', 'name phone')
            .populate('driver', 'name phone')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        Transaction.countDocuments(filter)
    ]);

    return res.status(200).json({
        success: true,
        transactions,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        }
    });
});

/* =========================================================
   TRIPS
========================================================= */

/**
 * GET /api/admin/trips
 */
exports.listTrips = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        status
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const filter = {};

    if (
        status &&
        ['requested', 'ongoing', 'completed', 'cancelled'].includes(status)
    ) {
        filter.status = status;
    }

    const [trips, total] = await Promise.all([
        Trip.find(filter)
            .populate('driver', 'name phone')
            .populate('passenger', 'name phone')
            .populate('route', 'name origin destination')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        Trip.countDocuments(filter)
    ]);

    return res.status(200).json({
        success: true,
        trips,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        }
    });
});

/* =========================================================
   ROUTES MANAGEMENT
========================================================= */

/**
 * GET /api/admin/routes
 */
exports.listRoutes = asyncHandler(async (req, res) => {
    const routes = await Route.find()
        .sort({ createdAt: -1 })
        .lean();

    return res.status(200).json({
        success: true,
        routes
    });
});

/**
 * POST /api/admin/routes
 */
exports.createRoute = asyncHandler(async (req, res) => {
    const {
        name,
        origin,
        destination,
        baseFare,
        distance
    } = req.body;

    const route = await Route.create({
        name,
        origin,
        destination,
        baseFare,
        distance
    });

    await SystemLog.logEvent({
        action: 'admin_create_route',
        level: 'info',
        performedBy: req.user._id,
        details: `Created route: ${route.name} (${route.origin} → ${route.destination}).`,
        req
    });

    return res.status(201).json({
        success: true,
        message: 'Route created successfully.',
        route
    });
});

/**
 * PUT /api/admin/routes/:id
 */
exports.updateRoute = asyncHandler(async (req, res) => {
    assertValidObjectId(req.params.id, 'Route');

    const allowedFields = [
        'name', 'origin', 'destination',
        'baseFare', 'distance', 'isActive'
    ];

    const updates = {};

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        throw createHttpError(
            400,
            'No valid fields provided for update.'
        );
    }

    const route = await Route.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { returnDocument: 'after', runValidators: true }
    );

    if (!route) {
        throw createHttpError(404, 'Route not found.');
    }

    await SystemLog.logEvent({
        action: 'admin_update_route',
        level: 'info',
        performedBy: req.user._id,
        details: `Updated route: ${route.name}. Fields: ${Object.keys(updates).join(', ')}.`,
        req
    });

    return res.status(200).json({
        success: true,
        message: 'Route updated successfully.',
        route
    });
});

/**
 * DELETE /api/admin/routes/:id
 */
exports.deleteRoute = asyncHandler(async (req, res) => {
    assertValidObjectId(req.params.id, 'Route');

    const route = await Route.findByIdAndDelete(
        req.params.id
    );

    if (!route) {
        throw createHttpError(404, 'Route not found.');
    }

    await SystemLog.logEvent({
        action: 'admin_delete_route',
        level: 'info',
        performedBy: req.user._id,
        details: `Deleted route: ${route.name}.`,
        req
    });

    return res.status(200).json({
        success: true,
        message: 'Route deleted successfully.'
    });
});

/* =========================================================
   DASHBOARD STATS & ANALYTICS
========================================================= */

/**
 * GET /api/admin/stats
 */
exports.stats = asyncHandler(async (req, res) => {
    const [
        totalUsers,
        totalDrivers,
        totalPassengers,
        pendingApprovals,
        blockedUsers,
        totalTrips,
        activeTrips,
        completedTrips,
        totalTransactions,
        revenueResult,
        totalRoutes
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'driver' }),
        User.countDocuments({ role: 'passenger' }),
        User.countDocuments({
            role: 'driver',
            approvalStatus: 'pending'
        }),
        User.countDocuments({ isBlocked: true }),
        Trip.countDocuments(),
        Trip.countDocuments({
            status: { $in: ['requested', 'ongoing'] }
        }),
        Trip.countDocuments({ status: 'completed' }),
        Transaction.countDocuments(),
        Transaction.aggregate([
            {
                $match: { status: 'completed' }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$amount' }
                }
            }
        ]),
        Route.countDocuments()
    ]);

    const totalRevenue =
        revenueResult.length > 0
            ? revenueResult[0].totalRevenue
            : 0;

    return res.status(200).json({
        success: true,
        stats: {
            users: {
                total: totalUsers,
                drivers: totalDrivers,
                passengers: totalPassengers,
                pendingApprovals,
                blocked: blockedUsers
            },
            trips: {
                total: totalTrips,
                active: activeTrips,
                completed: completedTrips
            },
            transactions: {
                total: totalTransactions,
                totalRevenue
            },
            routes: {
                total: totalRoutes
            }
        }
    });
});

/**
 * GET /api/admin/analytics
 */
exports.getAnalytics = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const daysNum = Math.min(365, Math.max(1, Number(days)));

    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    const [
        dailyRevenue,
        dailyTrips,
        newUsers
    ] = await Promise.all([
        Transaction.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: since }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    revenue: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]),
        Trip.aggregate([
            {
                $match: {
                    createdAt: { $gte: since }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]),
        User.aggregate([
            {
                $match: {
                    createdAt: { $gte: since }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ])
    ]);

    return res.status(200).json({
        success: true,
        period: {
            days: daysNum,
            since: since.toISOString()
        },
        analytics: {
            dailyRevenue,
            dailyTrips,
            newUsers
        }
    });
});

/* =========================================================
   SYSTEM LOGS
========================================================= */

/**
 * GET /api/admin/logs
 */
exports.listLogs = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 50,
        level,
        action
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));

    const filter = {};

    if (
        level &&
        ['info', 'warning', 'error', 'security'].includes(level)
    ) {
        filter.level = level;
    }

    if (action && typeof action === 'string') {
        filter.action = {
            $regex: action.trim().replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
            ),
            $options: 'i'
        };
    }

    const [logs, total] = await Promise.all([
        SystemLog.find(filter)
            .populate('performedBy', 'name phone role')
            .populate('targetUser', 'name phone role')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        SystemLog.countDocuments(filter)
    ]);

    return res.status(200).json({
        success: true,
        logs,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        }
    });
});
