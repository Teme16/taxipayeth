'use strict';

const Route = require('../models/Route');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/tariffs/active
 * Returns all active routes and their tariffs.
 */
exports.getActiveTariffs = asyncHandler(async (req, res) => {
    const activeRoutes = await Route.find({ isActive: true }).select('name origin destination baseFare distance').lean();
    
    return res.status(200).json({
        success: true,
        tariffs: activeRoutes
    });
});
