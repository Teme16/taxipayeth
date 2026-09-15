'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const {
  normalizePhone,
  normalizeWhitespace
} = require('../utils/modelHelpers');

const preferencesSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      trim: true,
      maxlength: 10,
      default: 'en'
    },
    notificationsEnabled: {
      type: Boolean,
      default: true
    }
  },
  {
    _id: false,
    strict: true
  }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must contain at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
      set: normalizeWhitespace
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      immutable: false,
      index: true,
      set: normalizePhone,
      validate: {
        validator(value) {
          return /^\+2519\d{8}$/.test(value);
        },
        message: 'Phone number must be a valid Ethiopian mobile number.'
      }
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email cannot exceed 254 characters'],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address.'
      ]
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must contain at least 8 characters'],
      maxlength: [128, 'Password cannot exceed 128 characters'],
      select: false
    },

    role: {
      type: String,
      enum: {
        values: ['passenger', 'driver', 'admin'],
        message: 'Invalid user role.'
      },
      default: 'passenger',
      index: true
    },

    avatar: {
      type: String,
      trim: true,
      default: ''
    },

    telegramChatId: {
      type: String,
      trim: true,
      maxlength: [100, 'Telegram chat ID cannot exceed 100 characters'],
      default: ''
    },

    balance: {
      type: Number,
      default: 0,
      min: [0, 'Wallet balance cannot be negative']
    },

    verificationStatus: {
      type: String,
      enum: ['not_verified', 'pending', 'verified'],
      default: 'not_verified',
      index: true
    },

    idDocuments: {
      docType: {
        type: String,
        enum: ['national_id', 'kebele_id']
      },
      frontUrl: String,
      backUrl: String,
      submittedAt: Date,
      rejectionReason: String
    },

    isBlocked: {
      type: Boolean,
      default: false,
      index: true
    },

    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      index: true
    },

    preferences: {
      type: preferencesSchema,
      default: () => ({})
    }
  },
  {
    timestamps: true,
    versionKey: '__v',
    optimisticConcurrency: true,
    strict: 'throw',
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

userSchema.index({ role: 1, isBlocked: 1 });
userSchema.index({ approvalStatus: 1, createdAt: -1 });
userSchema.index(
  { telegramChatId: 1 },
  {
    sparse: true,
    partialFilterExpression: {
      telegramChatId: { $type: 'string', $ne: '' }
    }
  }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return;
  }

  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
});

userSchema.methods.matchPassword = async function matchPassword(
  enteredPassword
) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);