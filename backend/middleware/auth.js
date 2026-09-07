const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'taxipay_secret_key_123';

/**
 * Protect routes by validating JWT Bearer tokens OR Express Session Cookies
 */
const protect = async (req, res, next) => {
  try {
    let userId = null;

    // 1. Check for JWT Bearer Token in Request Headers
    const authorization = req.headers.authorization || req.headers.Authorization;

    if (authorization && authorization.startsWith('Bearer ')) {
      const token = authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id || decoded.userId;
    } 
    // 2. Fallback to Express Session Cookie if JWT is missing
    else if (req.session && req.session.userId) {
      userId = req.session.userId;
    }

    // 3. If neither authentication method exists, reject
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Session missing or expired. Please log in.'
      });
    }

    // 4. Fetch user from MongoDB excluding password
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication context. User no longer exists.'
      });
    }

    // 5. Check if account is suspended or blocked
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    // Attach user payload to request object for route handlers
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session or token expired. Please log in again.',
        expired: true
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or malformed authentication token.'
    });
  }
};

/**
 * Authorize users based on their assigned roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access.'
      });
    }

    const hasAccess =
      allowedRoles.includes(req.user.role) ||
      req.user.role === 'admin' ||
      req.user.isAdmin;

    if (hasAccess) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Forbidden: Insufficient permissions to access this endpoint.'
    });
  };
};

/**
 * Ensure driver accounts are approved before allowing access to ride/payment actions
 */
const requireApprovedDriver = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized access.' });
  }

  if (req.user.role === 'driver' && req.user.approvalStatus !== 'approved') {
    return res.status(403).json({
      success: false,
      message: 'Your driver account is pending admin approval.'
    });
  }

  next();
};

module.exports = {
  protect,
  authorize,
  requireApprovedDriver
};