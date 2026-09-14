'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const Driver = require('../models/Driver');

const config = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { normalizePhone } = require('../utils/modelHelpers');

const VERIFICATION_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

const createToken = (user) =>
  jwt.sign(
    {
      id: String(user._id),
      role: user.role
    },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_EXPIRES_IN
    }
  );

const generateCode = () =>
  crypto.randomInt(100000, 1000000).toString();

const sanitizeUser = (user) => {
  const value = user?.toObject ? user.toObject() : { ...user };
  delete value.password;
  delete value.__v;
  return value;
};

/* =========================================================
   REQUEST TELEGRAM VERIFICATION
========================================================= */

exports.requestTelegramVerification = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const existingUser = await User.findOne({ phone }).lean();

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'An account already exists for this phone number.'
    });
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 12);
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

  await VerificationCode.findOneAndUpdate(
    { phone, purpose: 'registration' },
    {
      $set: {
        codeHash,
        verified: false,
        verifiedAt: null,
        attempts: 0,
        expiresAt,
        telegramChatId: ''
      }
    },
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true
    }
  );

  const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
  const telegramBotLink = botUsername ? `https://t.me/${botUsername}?start=${code}` : null;

  return res.status(200).json({
    success: true,
    message: 'Verification request created. Complete verification through Telegram.',
    telegramBotLink,
    expiresInSeconds: VERIFICATION_TTL_MS / 1000,
    verificationCode: code // ALWAYS SEND THE OTP CODE TO FRONTEND
  });
});

/* =========================================================
   CHECK TELEGRAM VERIFICATION
========================================================= */

exports.checkTelegramVerification = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const record = await VerificationCode.findOne({ phone, purpose: 'registration' }).select('+codeHash');

  if (!record) {
    return res.status(404).json({ success: false, verified: false, message: 'Verification request was not found.' });
  }

  if (record.expiresAt <= new Date()) {
    return res.status(410).json({ success: false, verified: false, message: 'Verification request has expired.' });
  }

  if (!record.verified) {
    return res.status(200).json({ success: true, verified: false, message: 'Telegram verification has not been completed yet.' });
  }

  return res.status(200).json({
    success: true,
    verified: true,
    telegramChatId: record.telegramChatId || null
  });
});

/* =========================================================
   REGISTER
========================================================= */

exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role = 'passenger', targaNo } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = email?.trim() ? String(email).trim().toLowerCase() : undefined;

  const verification = await VerificationCode.findOne({
    phone: normalizedPhone,
    purpose: 'registration',
    verified: true,
    expiresAt: { $gt: new Date() }
  });

  if (!verification) {
    return res.status(403).json({
      success: false,
      message: 'Telegram verification must be completed before registration.'
    });
  }

  const duplicateQuery = { $or: [{ phone: normalizedPhone }] };
  if (normalizedEmail) duplicateQuery.$or.push({ email: normalizedEmail });

  const existingUser = await User.findOne(duplicateQuery);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'An account with these details already exists.'
    });
  }

  const user = await User.create({
    name: String(name).trim(),
    phone: normalizedPhone,
    email: normalizedEmail,
    password,
    role: role === 'driver' ? 'driver' : 'passenger',
    telegramChatId: verification.telegramChatId || '',
    isVerified: true,
    approvalStatus: 'pending' // ALL users are pending initially
  });

  if (role === 'driver' && targaNo) {
    await Driver.create({
      user: user._id,
      targaNo: targaNo.trim()
    });
  }

  await VerificationCode.deleteOne({ _id: verification._id });

  // Send "Under Review" Telegram Notification
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && user.telegramChatId) {
    const reviewMsg = `🎉 *Registration Successful!*\n\nHello ${user.name}, your TaxiPay account has been created and is currently **under review** by our team.\n\nPlease wait for an approval message before attempting to log in.`;

    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text: reviewMsg,
        parse_mode: 'Markdown'
      })
    }).catch(err => console.error('Telegram notification failed:', err));
  }

  return res.status(201).json({
    success: true,
    message: 'Registration successful. Account under review.',
    user: sanitizeUser(user)
  });
});

/* =========================================================
   LOGIN
========================================================= */

exports.login = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const password = String(req.body.password || '');

  const user = await User.findOne({ phone }).select('+password');

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid phone number or password.' });
  }

  if (user.isBlocked) {
    return res.status(403).json({ success: false, message: 'This account is blocked.' });
  }

  const passwordMatches = await user.matchPassword(password);
  if (!passwordMatches) {
    return res.status(401).json({ success: false, message: 'Invalid phone number or password.' });
  }

  if (user.approvalStatus === 'rejected') {
    return res.status(403).json({ success: false, message: 'Your account has been rejected.' });
  }

  // Block login for ALL pending users
  if (user.approvalStatus === 'pending') {
    return res.status(403).json({
      success: false,
      message: 'Your account is currently under review. Please wait for an approval message.'
    });
  }

  return res.status(200).json({
    success: true,
    token: createToken(user),
    user: sanitizeUser(user)
  });
});

/* =========================================================
   CURRENT USER
========================================================= */

exports.getMe = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    user: sanitizeUser(req.user)
  });
});

/* =========================================================
   LOGOUT
========================================================= */

exports.logout = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

/* =========================================================
   TELEGRAM WEBHOOK
========================================================= */

exports.telegramWebhook = asyncHandler(async (req, res) => {
  const message = req.body?.message;

  if (!message?.chat?.id || !message?.text) {
    return res.status(200).json({ success: true });
  }

  const telegramChatId = String(message.chat.id);
  const text = String(message.text).trim();

  if (!text.startsWith('/start')) {
    return res.status(200).json({ success: true });
  }

  const parts = text.split(/\s+/);
  const code = parts.length > 1 ? parts[1].trim() : '';

  if (!/^\d{6}$/.test(code)) {
    return res.status(200).json({ success: true });
  }

  const records = await VerificationCode.find({
    purpose: 'registration',
    verified: false,
    expiresAt: { $gt: new Date() },
    attempts: { $lt: MAX_VERIFICATION_ATTEMPTS }
  }).select('+codeHash');

  let verifiedRecord = null;

  for (const record of records) {
    const matches = await bcrypt.compare(code, record.codeHash);
    if (matches) {
      verifiedRecord = record;
      break;
    }
  }

  if (!verifiedRecord) {
    return res.status(200).json({ success: true });
  }

  const updated = await VerificationCode.findOneAndUpdate(
    { _id: verifiedRecord._id, verified: false, expiresAt: { $gt: new Date() } },
    { $set: { verified: true, verifiedAt: new Date(), telegramChatId } },
    { returnDocument: 'after' }
  );

  if (!updated) {
    return res.status(200).json({ success: true });
  }

  return res.status(200).json({ success: true });
});

/* =========================================================
   APPROVE USER (Call this from your Admin Portal)
========================================================= */

exports.approveUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findByIdAndUpdate(
    userId,
    { approvalStatus: 'approved' },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  // Send "Approved" Telegram Notification with Login Link
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && user.telegramChatId) {
    const loginUrl = 'https://frontend-nine-lyart-jigjn9fy6c.vercel.app';
    const approvalMsg = `✅ *Account Approved!*\n\nCongratulations ${user.name}, your TaxiPay account has been verified and approved.\n\nYou can now log in and access the system here:\n👉 [Log in to TaxiPay](${loginUrl})`;

    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text: approvalMsg,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    }).catch(err => console.error('Telegram notification failed:', err));
  }

  return res.status(200).json({
    success: true,
    message: 'User approved and notified via Telegram.',
    user: sanitizeUser(user)
  });
});
