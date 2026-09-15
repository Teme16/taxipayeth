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

// 6. Change Password
exports.changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    const error = new Error('Old and new passwords are required.');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const isMatch = await user.matchPassword(oldPassword);
  if (!isMatch) {
    const error = new Error('Incorrect old password.');
    error.statusCode = 401;
    throw error;
  }

  if (newPassword.length < 8) {
    const error = new Error('New password must contain at least 8 characters.');
    error.statusCode = 400;
    throw error;
  }

  user.password = newPassword;
  await user.save();

  // Telegram Alert
  const { bot } = require('../config/telegram');
  if (bot && user.telegramChatId) {
    const msg = `🔒 *Security Alert*\n\nYour TaxiPay account password was recently changed. If you did not make this change, please contact support immediately.`;
    bot.sendMessage(user.telegramChatId, msg, { parse_mode: 'Markdown' })
      .catch(err => console.error('Telegram notification failed:', err));
  }

  return res.status(200).json({
    success: true,
    message: 'Password changed successfully.'
  });
});

// 7. Delete Account
exports.deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  // Soft delete or hard delete. Let's do hard delete for now.
  await User.findByIdAndDelete(req.user._id);

  return res.status(200).json({
    success: true,
    message: 'Account deleted successfully.'
  });
});

// 8. Submit Verification Request
exports.verifyRequest = asyncHandler(async (req, res) => {
  const { docType } = req.body;
  if (!docType || !['national_id', 'kebele_id'].includes(docType)) {
    const error = new Error('Valid docType (national_id, kebele_id) is required.');
    error.statusCode = 400;
    throw error;
  }

  const files = req.files;
  if (!files || !files.frontId || !files.frontId[0] || !files.backId || !files.backId[0]) {
    const error = new Error('Both front and back ID images are required.');
    error.statusCode = 400;
    throw error;
  }

  // Convert memory buffer to Base64 for DB storage
  const frontBase64 = `data:${files.frontId[0].mimetype};base64,${files.frontId[0].buffer.toString('base64')}`;
  const backBase64 = `data:${files.backId[0].mimetype};base64,${files.backId[0].buffer.toString('base64')}`;

  const user = await User.findById(req.user._id);
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  user.verificationStatus = 'pending';
  user.idDocuments = {
    docType,
    frontUrl: frontBase64,
    backUrl: backBase64,
    submittedAt: new Date(),
    rejectionReason: null
  };

  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Verification request submitted successfully. Status is now pending.',
    user: {
      ...user.toObject(),
      verificationStatus: user.verificationStatus
    }
  });
});