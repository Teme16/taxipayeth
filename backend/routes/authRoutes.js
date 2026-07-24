const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getFallbackStore } = require('../utils/fallbackStore');

const JWT_SECRET = process.env.JWT_SECRET || 'taxipay_secret_key_123';
const fallbackStore = getFallbackStore();

const isMongoUnavailableError = (error) => {
  return !error || error.name === 'ValidationError' || error.name === 'MongooseServerSelectionError' || error.name === 'MongoServerSelectionError' || error.message?.includes('ECONNREFUSED') || error.message?.includes('Topology') || error.message?.includes('connect ECONNREFUSED') || error.message?.includes('Cast to ObjectId');
};

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, role, targaNo } = req.body;
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