const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'taxipay_secret_key_123';

module.exports = async function (req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No authentication token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    // 1. Verify administrative privileges
    if (!user || (!user.isAdmin && user.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
    }

    // 2. Verify account approval status
    if (user.approvalStatus === 'pending') {
      return res.status(403).json({ 
        success: false, 
        message: 'Account pending admin approval. Access restricted.' 
      });
    }

    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({ 
        success: false, 
        message: 'Your admin account registration request was rejected.' 
      });
    }

    req.adminUser = user;
    req.user = user; // preserve compatibility for admin controller usage
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};