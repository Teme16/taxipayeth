'use strict';

const jwt = require('jsonwebtoken');

const User = require('../models/User');
const config = require('../config/env');

const extractBearerToken = (req) => {
  const authorization =
    req.get('authorization');

  if (!authorization) {
    return null;
  }

  const [scheme, token] =
    authorization.split(' ');

  if (
    scheme !== 'Bearer' ||
    !token
  ) {
    return null;
  }

  return token;
};

const protect = async (
  req,
  res,
  next
) => {
  try {
    const token =
      extractBearerToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          'Authentication token is required.',
        requestId: req.requestId
      });
    }

    const decoded = jwt.verify(
      token,
      config.JWT_SECRET
    );

    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message:
          'Authentication token is invalid.',
        requestId: req.requestId
      });
    }

    const user = await User.findById(
      decoded.id
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          'Authentication account no longer exists.',
        requestId: req.requestId
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message:
          'Your account is currently blocked.',
        requestId: req.requestId
      });
    }

    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        message:
          'Your account has been rejected.',
        requestId: req.requestId
      });
    }

    req.user = user;

    next();
  } catch (error) {
    if (
      error.name ===
      'TokenExpiredError'
    ) {
      return res.status(401).json({
        success: false,
        message:
          'Authentication token has expired.',
        expired: true,
        requestId: req.requestId
      });
    }

    return res.status(401).json({
      success: false,
      message:
        'Authentication token is invalid.',
      requestId: req.requestId
    });
  }
};

const authorize = (
  ...allowedRoles
) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message:
        'Authentication is required.',
      requestId: req.requestId
    });
  }

  if (
    allowedRoles.length === 0 ||
    allowedRoles.includes(req.user.role)
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message:
      'You do not have permission to access this resource.',
    requestId: req.requestId
  });
};

const requireApprovedDriver = (
  req,
  res,
  next
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message:
        'Authentication is required.',
      requestId: req.requestId
    });
  }

  if (
    req.user.role !== 'driver'
  ) {
    return res.status(403).json({
      success: false,
      message:
        'Driver access is required.',
      requestId: req.requestId
    });
  }

  if (
    req.user.approvalStatus !==
    'approved'
  ) {
    return res.status(403).json({
      success: false,
      message:
        'Driver account approval is required.',
      requestId: req.requestId
    });
  }

  next();
};

module.exports = {
  protect,
  authorize,
  requireApprovedDriver,
  extractBearerToken
};