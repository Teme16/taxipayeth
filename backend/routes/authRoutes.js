const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const { getFallbackStore } = require('../utils/fallbackStore');

const JWT_SECRET = process.env.JWT_SECRET || 'taxipay_secret_key_123';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const fallbackStore = getFallbackStore();

const isMongoUnavailableError = (error) => {
  return (
    !error ||
    error.name === 'ValidationError' ||
    error.name === 'MongooseServerSelectionError' ||
    error.name === 'MongoServerSelectionError' ||
    error.message?.includes('ECONNREFUSED') ||
    error.message?.includes('Topology') ||
    error.message?.includes('connect ECONNREFUSED') ||
    error.message?.includes('Cast to ObjectId')
  );
};

// ==========================================
// 1. TELEGRAM OTP ENDPOINTS
// ==========================================

// POST /api/auth/send-telegram-code
router.post('/send-telegram-code', async (req, res) => {
  try {
    const { telegramChatId } = req.body;

    if (!telegramChatId) {
      return res.status(400).json({ success: false, message: 'Telegram Chat ID is required.' });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ success: false, message: 'TELEGRAM_BOT_TOKEN is missing in .env.' });
    }

    // Generate random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any previous unused OTPs for this chatId
    await VerificationCode.deleteMany({ telegramChatId });

    // Save new code to MongoDB (TTL handles 5-minute auto-expiry)
    await VerificationCode.create({
      telegramChatId,
      code
    });

    // Send message via Telegram Bot API
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(telegramApiUrl, {
      chat_id: telegramChatId,
      text: `🚕 *TaxiPay Verification Code*\n\nYour code is: *${code}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
      parse_mode: 'Markdown'
    });

    return res.json({ success: true, message: 'Verification code sent to Telegram!' });

  } catch (err) {
    console.error('Telegram OTP Error:', err.response?.data || err.message);
    return res.status(500).json({ 
      success: false, 
      message: err.response?.data?.description || err.message || 'Failed to send OTP.' 
    });
  }
});

// POST /api/auth/verify-telegram-code
router.post('/verify-telegram-code', async (req, res) => {
  try {
    const { telegramChatId, code } = req.body;

    if (!telegramChatId || !code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Telegram Chat ID and code are required.' 
      });
    }

    // Convert both to string and trim spaces
    const cleanChatId = String(telegramChatId).trim();
    const cleanCode = String(code).trim();

    // Find valid OTP record in DB
    const record = await VerificationCode.findOne({ 
      telegramChatId: cleanChatId, 
      code: cleanCode 
    });

    if (!record) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification code.' 
      });
    }

    // Code matches! Delete record so it can't be reused
    await VerificationCode.deleteOne({ _id: record._id });

    return res.json({ success: true, message: 'Telegram verification successful!' });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. AUTHENTICATION ENDPOINTS
// ==========================================
// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, role, targaNo, telegramChatId } = req.body;
    let user = await User.findOne({ phone });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      name,
      phone,
      password: hashedPassword,
      role,
      driverData: role === 'driver' ? { targaNo, driverId: 'DRV-' + Date.now() } : {}
    });

    await user.save();

    // Send confirmation message to Telegram if Chat ID was provided
    if (telegramChatId && TELEGRAM_BOT_TOKEN) {
      try {
        const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(telegramApiUrl, {
          chat_id: telegramChatId,
          text: `🎉 *Registration Successful!*\n\nWelcome to TaxiPay, *${name}*! Your account as a *${role}* has been created successfully. You can now sign in using your phone number.`,
          parse_mode: 'Markdown'
        });
      } catch (telegramErr) {
        console.error('Failed to send registration confirmation to Telegram:', telegramErr.message);
      }
    }

    return res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    if (isMongoUnavailableError(err)) {
      const existingUser = fallbackStore.findUserByPhone(req.body.phone);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      await fallbackStore.registerUser({
        name: req.body.name,
        phone: req.body.phone,
        password: req.body.password,
        role: req.body.role,
        driverData: req.body.role === 'driver' ? { targaNo: req.body.targaNo, driverId: 'DRV-' + Date.now() } : {}
      });

      return res.status(201).json({ success: true, message: 'User registered successfully' });
    }

    return res.status(500).json({ message: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, driverData: user.driverData },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        driverData: user.driverData
      }
    });
  } catch (err) {
    if (isMongoUnavailableError(err)) {
      const user = await fallbackStore.validateUser(req.body.phone, req.body.password);
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, name: user.name, driverData: user.driverData },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          driverData: user.driverData
        }
      });
    }

    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;