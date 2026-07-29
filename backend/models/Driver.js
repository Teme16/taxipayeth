const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema(
  {
    driverId: { type: String, unique: true, sparse: true },
    fullName: { type: String, required: true, trim: true },
    targaNo: { type: String, required: true, trim: true },
    mobileNumber: { type: String, default: '' },
    birthDate: { type: String, default: '' },
    licenseNumber: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    address: { type: String, default: '' },
    profilePic: { type: String, default: '' },
    digitalIdDoc: { type: String, default: '' },
    isProfileCompleted: { type: Boolean, default: false },
    totalEarnings: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Driver', DriverSchema);