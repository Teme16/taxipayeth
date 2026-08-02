const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const { getFallbackStore } = require('../utils/fallbackStore');

const JWT_SECRET = process.env.JWT_SECRET || 'taxipay_secret_key_123';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'taxipay_admin_secret_2026';
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

    const cleanChatId = String(telegramChatId).trim();

    // Generate random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any previous unused OTPs for this chatId
    await VerificationCode.deleteMany({ telegramChatId: cleanChatId });

    // Save new code to MongoDB
    await VerificationCode.create({
      telegramChatId: cleanChatId,
      code
    });

    // Send message via Telegram Bot API
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(telegramApiUrl, {
      chat_id: cleanChatId,
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

    // Delete record so it can't be reused
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
    
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required' });
    }

    const cleanPhone = String(phone).trim();
    const cleanTelegramId = telegramChatId ? String(telegramChatId).trim() : '';

    let user = await User.findOne({ phone: cleanPhone });
    if (user) return res.status(400).json({ success: false, message: 'User already exists with this phone number' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'passenger';
    const isAdminRole = userRole === 'admin';

    user = new User({
      name: name ? name.trim() : 'User',
      phone: cleanPhone,
      password: hashedPassword,
      role: userRole,
      isAdmin: isAdminRole,
      telegramChatId: cleanTelegramId,
      isTelegramVerified: Boolean(cleanTelegramId),
      approvalStatus: userRole === 'driver' ? 'pending' : 'approved',
      driverData: userRole === 'driver' ? { targaNo: targaNo?.trim(), driverId: 'DRV-' + Date.now() } : {}
    });

    await user.save();

    // ⚡ Emit Real-Time Socket Event to Admin Dashboard
    const io = req.app.get('io');
    if (io) {
      io.emit('new_user_registered', {
        userId: user._id,
        name: user.name,
        role: user.role,
        approvalStatus: user.approvalStatus
      });
    }

    // Send confirmation message to Telegram
    if (cleanTelegramId && TELEGRAM_BOT_TOKEN) {
      try {
        const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(telegramApiUrl, {
          chat_id: cleanTelegramId,
          text: `🎉 *Registration Successful!*\n\nWelcome to TaxiPay, *${name}*! Your account as a *${userRole}* has been created successfully. You can now sign in using your phone number.`,
          parse_mode: 'Markdown'
        });
      } catch (telegramErr) {
        console.error('Failed to send registration confirmation to Telegram:', telegramErr.message);
      }
    }

    return res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    if (isMongoUnavailableError(err)) {
      const cleanPhone = String(req.body.phone).trim();
      const existingUser = fallbackStore.findUserByPhone(cleanPhone);
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User already exists' });
      }

      const newUser = await fallbackStore.registerUser({
        name: req.body.name?.trim(),
        phone: cleanPhone,
        password: req.body.password,
        role: req.body.role || 'passenger',
        isAdmin: req.body.role === 'admin',
        telegramChatId: req.body.telegramChatId ? String(req.body.telegramChatId).trim() : '',
        driverData: req.body.role === 'driver' ? { targaNo: req.body.targaNo, driverId: 'DRV-' + Date.now() } : {}
      });

      // ⚡ Emit Socket Event in Fallback Mode as well
      const io = req.app.get('io');
      if (io) {
        io.emit('new_user_registered', {
          userId: newUser.id,
          name: newUser.name,
          role: newUser.role,
          approvalStatus: newUser.approvalStatus || 'approved'
        });
      }

      return res.status(201).json({ success: true, message: 'User registered successfully' });
    }

    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/register-admin - Express route to register System Administrators
router.post('/register-admin', async (req, res) => {
  try {
    const { name, phone, password, adminSecret } = req.body;

    if (adminSecret !== ADMIN_SECRET_KEY) {
      return res.status(403).json({ success: false, message: 'Invalid Admin Authorization Secret' });
    }

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required' });
    }

    const cleanPhone = String(phone).trim();
    let user = await User.findOne({ phone: cleanPhone });
    if (user) return res.status(400).json({ success: false, message: 'User already exists with this phone' });

    const hashedPassword = await bcrypt.hash(password, 10);

    user = new User({
      name: name ? name.trim() : 'System Admin',
      phone: cleanPhone,
      password: hashedPassword,
      role: 'admin',
      isAdmin: true,
      approvalStatus: 'approved'
    });

    await user.save();

    // ⚡ Emit Real-Time Socket Event to Admin Dashboard
    const io = req.app.get('io');
    if (io) {
      io.emit('new_user_registered', {
        userId: user._id,
        name: user.name,
        role: user.role,
        approvalStatus: user.approvalStatus
      });
    }

    return res.status(201).json({ success: true, message: 'System Administrator registered successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required' });
    }

    const cleanPhone = String(phone).trim();
    const user = await User.findOne({ phone: cleanPhone });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const isAdmin = user.isAdmin || user.role === 'admin';

    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        isAdmin,
        name: user.name, 
        driverData: user.driverData 
      },
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
        isAdmin,
        telegramChatId: user.telegramChatId,
        approvalStatus: user.approvalStatus,
        driverData: user.driverData
      }
    });
  } catch (err) {
    if (isMongoUnavailableError(err)) {
      const cleanPhone = String(req.body.phone).trim();
      const user = await fallbackStore.validateUser(cleanPhone, req.body.password);
      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid credentials' });
      }

      const isAdmin = user.isAdmin || user.role === 'admin';

      const token = jwt.sign(
        { 
          id: user.id, 
          role: user.role, 
          isAdmin,
          name: user.name, 
          driverData: user.driverData 
        },
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
          isAdmin,
          telegramChatId: user.telegramChatId,
          driverData: user.driverData
        }
      });
    }

    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;