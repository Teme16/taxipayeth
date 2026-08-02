const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true 
    },
    phone: { 
      type: String, 
      required: true, 
      unique: true,
      trim: true 
    },
    password: { 
      type: String, 
      required: true 
    },
    role: { 
      type: String, 
      enum: ['passenger', 'driver', 'admin'], // Added 'admin' role
      required: true 
    },
    isAdmin: {
      type: Boolean,
      default: false
    },

    // Administrative Approval Workflow
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved' // Set default to 'approved' (or 'pending' if driver verification is required)
    },

    // Telegram Auth & Verification
    telegramChatId: {
      type: String,
      default: '',
      trim: true
    },
    isTelegramVerified: {
      type: Boolean,
      default: false
    },

    driverData: {
      targaNo: { type: String, default: '', trim: true },
      driverId: { type: String, default: '', sparse: true }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);