'use strict';

const asyncHandler = require('../utils/asyncHandler');
const Route = require('../models/Route');

/**
 * @desc    Get all active routes
 * @route   GET /api/routes
 * @access  Public or Protected
 */
exports.getActiveRoutes = asyncHandler(async (req, res) => {
  const routes = await Route.find({ isActive: true }).sort({ name: 1 });
  
  return res.json({
    success: true,
    routes
  });
});
