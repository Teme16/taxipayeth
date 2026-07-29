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
      enum: ['passenger', 'driver'], 
      required: true 
    },
    driverData: {
      targaNo: { type: String, default: '', trim: true },
      driverId: { type: String, default: '', sparse: true }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);