const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,      // Allows multiple documents to omit email
      default: undefined // Ensures empty fields default to undefined
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      index: true
    },
    password: {
      type: String,
      required: [true, 'Password is required']
    },
    role: {
      type: String,
      enum: ['passenger', 'driver', 'admin'],
      default: 'passenger'
    },
    targaNo: {
      type: String,
      trim: true,
      default: ''
    },
    avatar: {
      type: String,
      default: ''
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    telegramChatId: {
      type: String,
      default: ''
    },
    verificationCode: {
      type: String,
      default: ''
    },
    verificationExpires: {
      type: Date
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved'
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    isBlocked: {
      type: Boolean,
      default: false
    }
  },
  { 
    timestamps: true 
  }
);

/**
 * Ensure empty/null emails convert to undefined for sparse index safety
 */
userSchema.pre('validate', function () {
  if (this.email !== undefined && (this.email === null || String(this.email).trim() === '')) {
    this.email = undefined;
  }
});

/**
 * Password Hashing Hook before saving document
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compare entered password with hashed password stored in DB
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);