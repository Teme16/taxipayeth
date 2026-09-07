const { validationResult, body } = require('express-validator');
const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -verificationCode -verificationExpires');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, phone, avatar, preferences } = req.body;
    const updates = {};

    if (name) updates.name = String(name).trim();
    if (email) updates.email = String(email).trim().toLowerCase();
    if (phone) updates.phone = String(phone).trim();
    if (avatar !== undefined) updates.avatar = String(avatar).trim();
    if (preferences !== undefined) {
      updates.preferences = typeof preferences === 'string' ? JSON.parse(preferences) : preferences;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select('-password -verificationCode -verificationExpires');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.profileValidators = [
  body('name').optional().isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().withMessage('Provide a valid email address'),
  body('phone').optional().isString().isLength({ min: 7 }).withMessage('Phone number must be valid'),
  body('avatar').optional().isString().withMessage('Avatar must be a valid URL'),
  body('preferences').optional().custom((value) => {
    if (typeof value === 'string') {
      JSON.parse(value);
    }
    return true;
  }).withMessage('Preferences must be valid JSON')
];
