'use strict';

const mongoose = require('mongoose');

const { normalizePhone } = require('../utils/modelHelpers');

const verificationCodeSchema = new mongoose.Schema(
  {
    telegramChatId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      set: normalizePhone,
      index: true
    },

    codeHash: {
      type: String,
      required: [true, 'Verification code hash is required'],
      select: false
    },

    purpose: {
      type: String,
      enum: ['registration', 'login', 'password_reset'],
      default: 'registration',
      index: true
    },

    verified: {
      type: Boolean,
      default: false,
      index: true
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },

    expiresAt: {
      type: Date,
      required: true
    },

    verifiedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    strict: 'throw'
  }
);

verificationCodeSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0
  }
);

verificationCodeSchema.index({
  phone: 1,
  purpose: 1,
  createdAt: -1
});

verificationCodeSchema.index({
  telegramChatId: 1,
  purpose: 1,
  createdAt: -1
});

module.exports = mongoose.model(
  'VerificationCode',
  verificationCodeSchema
);