const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Middleware to handle express-validator errors cleanly
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg, // Returns the first error message
      errors: errors.array()
    });
  }
  next();
};

// Common Input Validation Rules
const phoneValidation = body('phone')
  .trim()
  .notEmpty()
  .withMessage('Phone number is required.');

const codeValidation = body('code')
  .trim()
  .isLength({ min: 6, max: 6 })
  .withMessage('Verification code must be exactly 6 digits.');

// -----------------------------------------------------------------------------
// Telegram Verification Flow Routes
// -----------------------------------------------------------------------------

router.post(
  '/request-telegram-verification',
  phoneValidation,
  validate,
  authController.requestTelegramVerification
);

router.post(
  '/check-telegram-verification',
  phoneValidation,
  codeValidation,
  validate,
  authController.checkTelegramVerification
);

// -----------------------------------------------------------------------------
// Account Registration & Login Routes
// -----------------------------------------------------------------------------

router.post(
  '/register',
  body('name').trim().notEmpty().withMessage('Name is required.'),
  phoneValidation,
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters.'),
  body('role')
    .optional()
    .isIn(['passenger', 'driver'])
    .withMessage('Invalid role specified. Standard registration only supports passenger or driver.'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be 6 digits.'),
  validate,
  authController.register
);

router.post(
  '/login',
  phoneValidation,
  body('password').notEmpty().withMessage('Password is required.'),
  validate,
  authController.login
);

// -----------------------------------------------------------------------------
// Telegram Webhook Endpoint
// -----------------------------------------------------------------------------

router.post('/telegram-webhook', authController.telegramWebhook);

module.exports = router;