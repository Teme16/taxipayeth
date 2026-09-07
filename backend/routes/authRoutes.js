'use strict';

const express = require('express');
const { body } = require('express-validator');

const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const {
  authLimiter,
  verificationLimiter,
  pollingLimiter
} = require('../middleware/rateLimiters');

const router = express.Router();

const phoneValidation = body('phone')
  .trim()
  .notEmpty()
  .withMessage('Phone number is required.');

const passwordValidation = body('password')
  .isString()
  .isLength({ min: 8, max: 128 })
  .withMessage(
    'Password must be between 8 and 128 characters.'
  );

const codeValidation = body('code')
  .optional({ checkFalsy: true })
  .trim()
  .matches(/^\d{6}$/)
  .withMessage(
    'Verification code must contain exactly 6 digits.'
  );

router.post(
  '/request-telegram-verification',
  verificationLimiter,
  phoneValidation,
  validateRequest,
  authController.requestTelegramVerification
);

router.post(
  '/check-telegram-verification',
  pollingLimiter,
  phoneValidation,
  codeValidation,
  validateRequest,
  authController.checkTelegramVerification
);

router.post(
  '/register',
  authLimiter,
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage(
      'Name must be between 2 and 100 characters.'
    ),
  phoneValidation,
  passwordValidation,
  body('role')
    .optional()
    .isIn(['passenger', 'driver'])
    .withMessage('Invalid role.'),
  body('targaNo')
    .if(body('role').equals('driver'))
    .trim()
    .notEmpty()
    .withMessage('Vehicle plate number is required for drivers.'),
  codeValidation,
  validateRequest,
  authController.register
);

router.post(
  '/login',
  authLimiter,
  phoneValidation,
  body('password')
    .isString()
    .notEmpty()
    .withMessage('Password is required.'),
  validateRequest,
  authController.login
);

router.get(
  '/me',
  protect,
  authController.getMe
);

router.post(
  '/logout',
  protect,
  authController.logout
);

router.post(
  '/telegram-webhook',
  authController.telegramWebhook
);

module.exports = router;