// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// GET Profile
router.get('/profile', protect, async (req, res) => {
  try {
    // req.user is set by the protect middleware
    const user = req.user;
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT Profile (Update)
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone, avatar, preferences } = req.body;

    const user = req.user;
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;
    if (preferences) user.preferences = preferences;

    await user.save();

    // Re-touch session so TTL resets (if session exists)
    if (req.session) {
      req.session.touch();
    }

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;