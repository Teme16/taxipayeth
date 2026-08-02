const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'taxipay_secret_key_123';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Temporary in-memory storage for OTP codes (In production, use Redis or a Mongo collection)
const otpStore = new Map();

// Helper to generate 6-digit code
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ---------------------------------------------------------
// 1. SEND TELEGRAM OTP CODE
// ---------------------------------------------------------
router.post('/send-telegram-code', async (req, res) => {
  try {
    const { telegramChatId, phone } = req.body;

    if (!telegramChatId || !phone) {
      return res.status(400).json({ message: 'Phone number and Telegram Chat ID are required.' });
    }

    // Check if phone is already registered
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this phone number.' });
    }

    const code = generateOTP();

    // Store code with 5-minute expiration
    otpStore.set(phone, {
      code,
      telegramChatId,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    // Send code via Telegram Bot API
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(telegramUrl, {
      chat_id: telegramChatId,
      text: `🔒 Your TaxiPay verification code is: *${code}*\n\nIt will expire in 5 minutes. Do not share this with anyone.`,
      parse_mode: 'Markdown'
    });

    res.json({ success: true, message: 'Verification code sent to Telegram!' });
  } catch (err) {
    console.error('Telegram API Error:', err?.response?.data || err.message);
    res.status(500).json({ 
      message: 'Failed to send Telegram message. Make sure you started the bot in Telegram first!' 
    });
  }
});

// ---------------------------------------------------------
// 2. VERIFY TELEGRAM CODE
// ---------------------------------------------------------
router.post('/verify-telegram-code', (req, res) => {
  const { phone, code } = req.body;
  const record = otpStore.get(phone);

  if (!record) {
    return res.status(400).json({ message: 'No verification code found. Please request a new code.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return res.status(400).json({ message: 'Verification code has expired. Request a new one.' });
  }

  if (record.code !== code) {
    return res.status(400).json({ message: 'Invalid verification code.' });
  }

  // Mark phone as verified in memory
  record.verified = true;
  otpStore.set(phone, record);

  res.json({ success: true, message: 'Code verified successfully!' });
});

// ---------------------------------------------------------
// 3. REGISTER (UPDATED TO REQUIRE VERIFICATION)
// ---------------------------------------------------------
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, role, targaNo, telegramChatId, code } = req.body;

    // Verify code state
    const record = otpStore.get(phone);
    if (!record || !record.verified || record.code !== code) {
      return res.status(400).json({ message: 'Please verify your Telegram code before registering.' });
    }

    let user = await User.findOne({ phone });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      name,
      phone,
      password: hashedPassword,
      role,
      telegramChatId,
      isVerified: true,
      driverData: role === 'driver' ? { targaNo, driverId: 'DRV-' + Date.now() } : {}
    });

    await user.save();

    // Clean up OTP record from memory
    otpStore.delete(phone);

    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------------------------------------------------
// 4. LOGIN (UNCHANGED)
// ---------------------------------------------------------
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

    res.json({
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
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;