// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  deposit,
  withdraw,
  profileValidators = []
} = require('../controllers/userController');

// Multer Storage Configuration
const storage = multer.memoryStorage();

// File Filter Validation
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware Wrapper to Handle Multer Errors (File size limit, format error)
const handleAvatarUpload = (req, res, next) => {
  const singleUpload = upload.single('avatarFile');

  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds the 5MB limit.'
        });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// ================= ROUTE DEFINITIONS ================= //

// GET /api/users/profile — Fetch authenticated user's profile
router.get('/profile', protect, getProfile);

// PUT /api/users/profile — Update profile with optional avatar file upload
router.put(
  '/profile',
  protect,
  handleAvatarUpload,
  ...profileValidators,
  updateProfile
);

// POST /api/users/deposit — Deposit funds
router.post('/deposit', protect, deposit);

// POST /api/users/withdraw — Withdraw funds
router.post('/withdraw', protect, withdraw);

module.exports = router;