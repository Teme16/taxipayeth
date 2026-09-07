'use strict';

const { check } = require('express-validator');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// 1. Validation Middleware Array (Fixes the undefined iterable error in userRoutes.js)
exports.profileValidators = [
  check('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  check('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  check('phone')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Phone number cannot be empty')
];

// 2. Fetch Logged-in User Profile
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');

  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  return res.status(200).json({
    success: true,
    user
  });
});

// 3. Update User Profile
exports.updateProfile = asyncHandler(async (req, res) => {
  const updates = {};
  const allowedFields = ['name', 'email', 'phone', 'preferences', 'avatar'];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = typeof req.body[field] === 'string'
        ? req.body[field].trim()
        : req.body[field];
    }
  }

  // File Upload Handling (Convert memory buffer to Base64 string for DB storage)
  if (req.file) {
    const base64Image = req.file.buffer.toString('base64');
    updates.avatar = `data:${req.file.mimetype};base64,${base64Image}`;
  }

  // Parse JSON String for Multipart Form Submissions
  if (typeof updates.preferences === 'string') {
    try {
      updates.preferences = JSON.parse(updates.preferences);
    } catch {
      const error = new Error('Preferences must contain valid JSON.');
      error.statusCode = 400;
      throw error;
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    {
      returnDocument: 'after',
      runValidators: true
    }
  ).select('-password');

  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  return res.status(200).json({
    success: true,
    message: 'Profile updated successfully.',
    user
  });
});

// 4. Deposit Funds
exports.deposit = asyncHandler(async (req, res) => {
  const amount = parseFloat(req.body.amount);
  if (isNaN(amount) || amount <= 0) {
    const error = new Error('Invalid deposit amount.');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $inc: { balance: amount } },
    { returnDocument: 'after' }
  ).select('-password');

  return res.status(200).json({
    success: true,
    message: 'Deposit successful.',
    user
  });
});

// 5. Withdraw Funds
exports.withdraw = asyncHandler(async (req, res) => {
  const amount = parseFloat(req.body.amount);
  if (isNaN(amount) || amount <= 0) {
    const error = new Error('Invalid withdraw amount.');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOneAndUpdate(
    { _id: req.user._id, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { returnDocument: 'after' }
  ).select('-password');

  if (!user) {
    const error = new Error('Insufficient wallet balance.');
    error.statusCode = 409;
    throw error;
  }

  return res.status(200).json({
    success: true,
    message: 'Withdrawal successful.',
    user
  });
});