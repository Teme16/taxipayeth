const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const { handleTelegramWebhook } = require('../config/telegram');

const JWT_SECRET = process.env.JWT_SECRET || 'taxipay_secret_key_123';
const TOKEN_LIFETIME = '1d';
const VERIFICATION_TTL_MS = 300 * 1000; // 5 minutes in milliseconds

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

// Formats phone input into common variations (e.g. 912345678, 0912345678, 251912345678, +251912345678)
const getPhoneVariations = (phone = '') => {
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('251')) cleaned = cleaned.slice(3);
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);

  return [
    cleaned,
    `0${cleaned}`,
    `251${cleaned}`,
    `+251${cleaned}`
  ];
};

const normalizePhone = (phone = '') => {
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('251')) cleaned = cleaned.slice(3);
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  return cleaned;
};

// Generates JWT auth token
const createToken = (user) => 
  jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_LIFETIME });

// Generates 6-digit numeric verification code
const generateCode = () => 
  Math.floor(100000 + Math.random() * 900000).toString();

// Strips sensitive details before returning user object in responses
const safeUserPayload = (user) => {
  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.verificationCode;
  delete safeUser.verificationExpires;
  return safeUser;
};

// Helper function to attach user metadata to Express Sessions safely
const initExpressSession = (req, user) => {
  if (req.session) {
    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.phone = user.phone;
  }
};

// -----------------------------------------------------------------------------
// Controller Actions
// -----------------------------------------------------------------------------

/**
 * Initiates Telegram Verification by storing/updating a 6-digit code
 */
exports.requestTelegramVerification = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const phoneVariations = getPhoneVariations(phone);
    const normalizedPhone = normalizePhone(phone);

    // Check if user already exists under any phone variation
    const existingUser = await User.findOne({ phone: { $in: phoneVariations } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'This phone is already registered.' });
    }

    const code = generateCode();
    await VerificationCode.findOneAndUpdate(
      { phone: { $in: phoneVariations } },
      { 
        phone: normalizedPhone, 
        code, 
        verified: false, 
        telegramChatId: '', 
        createdAt: new Date() 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
    const telegramBotLink = botUsername ? `https://t.me/${botUsername}?start=${code}` : null;

    return res.json({
      success: true,
      message: 'Telegram verification initiated. Open the TaxiPay bot and follow the instructions.',
      verificationCode: code,
      telegramBotLink,
      expiresInSeconds: VERIFICATION_TTL_MS / 1000
    });
  } catch (err) {
    console.error('requestTelegramVerification error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Checks whether the user completed Telegram phone number verification
 */
exports.checkTelegramVerification = async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and code are required.' });
    }

    const phoneVariations = getPhoneVariations(phone);
    
    const record = await VerificationCode.findOne({ 
      phone: { $in: phoneVariations }, 
      code: String(code).trim() 
    });
    
    if (!record) {
      return res.json({ 
        success: false, 
        verified: false, 
        message: 'Verification code not found. Request a new one in TaxiPay.' 
      });
    }

    // Check code expiry (5 minutes window)
    const isExpired = (Date.now() - new Date(record.createdAt).getTime()) > VERIFICATION_TTL_MS;
    if (isExpired) {
      return res.json({ 
        success: false, 
        verified: false, 
        message: 'Verification code expired. Please request a new code.' 
      });
    }

    if (!record.verified) {
      return res.json({ 
        success: false, 
        verified: false, 
        message: 'Telegram verification is still pending. Complete it in Telegram.' 
      });
    }

    return res.json({ success: true, verified: true, telegramChatId: record.telegramChatId || null });
  } catch (err) {
    console.error('❌ checkTelegramVerification error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Receives incoming webhook updates from Telegram API
 */
exports.telegramWebhook = (req, res, next) => {
  return handleTelegramWebhook(req, res, next);
};

/**
 * Finalizes account registration after Telegram verification is confirmed
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password, avatar, preferences, role = 'passenger', code, verificationCode, targaNo } = req.body;
    
    const activeCode = code || verificationCode;

    if (!name || !phone || !password || !activeCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, phone, password, and verification code are required.' 
      });
    }

    const phoneVariations = getPhoneVariations(phone);
    const normalizedPhone = normalizePhone(phone);

    // Explicitly clean up optional email field
    const emailQuery = email && String(email).trim() !== '' ? String(email).trim().toLowerCase() : null;

    // Build query conditions to check for duplicates
    const queryConditions = [{ phone: { $in: phoneVariations } }];
    if (emailQuery) {
      queryConditions.push({ email: emailQuery });
    }

    const existingUser = await User.findOne({ $or: queryConditions });

    if (existingUser) {
      const isPhoneMatch = phoneVariations.includes(existingUser.phone) || 
                           normalizePhone(existingUser.phone) === normalizedPhone;
                           
      const message = isPhoneMatch 
        ? 'A user with this phone number is already registered.' 
        : 'A user with this email is already registered.';
        
      return res.status(400).json({ success: false, message });
    }

    // Check completed verification record
    const verificationRecord = await VerificationCode.findOne({ 
      phone: { $in: phoneVariations }, 
      code: String(activeCode).trim(), 
      verified: true 
    });

    if (!verificationRecord) {
      return res.status(400).json({ 
        success: false, 
        message: 'Telegram verification is required before registration. Please verify in Telegram first.' 
      });
    }

    // Check expiry (5 min TTL)
    const isExpired = (Date.now() - new Date(verificationRecord.createdAt).getTime()) > VERIFICATION_TTL_MS;
    if (isExpired) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code has expired. Please request a new code.' 
      });
    }

    // Construct user object safely without empty string/null email key
    const userData = {
      name: String(name).trim(),
      phone: normalizedPhone,
      password: String(password),
      role: role === 'driver' ? 'driver' : 'passenger',
      targaNo: role === 'driver' ? String(targaNo || '').trim() : undefined,
      avatar: avatar || '',
      preferences: preferences || {},
      telegramChatId: verificationRecord.telegramChatId || '',
      isVerified: true,
      approvalStatus: role === 'driver' ? 'pending' : 'approved'
    };

    if (emailQuery) {
      userData.email = emailQuery;
    }

    const user = new User(userData);
    await user.save();
    
    // Cleanup temporary verification records for all variations of this phone
    await VerificationCode.deleteMany({ phone: { $in: phoneVariations } });

    const token = createToken(user);

    // Set Express session context
    initExpressSession(req, user);

    // Persist session to MongoDB before returning
    if (req.session) {
      return req.session.save((sessionErr) => {
        if (sessionErr) {
          console.error('Session save error on register:', sessionErr);
        }
        return res.status(201).json({ success: true, token, user: safeUserPayload(user) });
      });
    }

    return res.status(201).json({ success: true, token, user: safeUserPayload(user) });

  } catch (err) {
    console.error('register error:', err.message);

    if (err.code === 11000) {
      const duplicateField = Object.keys(err.keyValue || {})[0] || 'phone';
      return res.status(400).json({ 
        success: false, 
        message: `A user with this ${duplicateField} is already registered.` 
      });
    }

    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * User Login Endpoint
 */
exports.login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required.' });
    }

    const phoneVariations = getPhoneVariations(phone);
    const user = await User.findOne({ phone: { $in: phoneVariations } });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!user.isVerified) {
      return res.status(401).json({ success: false, message: 'Please verify your Telegram before logging in.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = createToken(user);

    // Initialize Express session variables
    initExpressSession(req, user);

    // Explicitly persist session to MongoDB Store before returning the response
    if (req.session) {
      return req.session.save((sessionErr) => {
        if (sessionErr) {
          console.error('Session save error on login:', sessionErr);
        }
        return res.json({ success: true, token, user: safeUserPayload(user) });
      });
    }

    return res.json({ success: true, token, user: safeUserPayload(user) });
  } catch (err) {
    console.error('login error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * User Logout Endpoint
 */
exports.logout = (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Could not log out. Try again.' });
      }
      res.clearCookie('connect.sid'); // Clears Express Session cookie
      return res.json({ success: true, message: 'Logged out successfully.' });
    });
  } else {
    return res.json({ success: true, message: 'Logged out successfully.' });
  }
};