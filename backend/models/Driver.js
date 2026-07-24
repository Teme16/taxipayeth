const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  licenseNumber: { type: String },
  targaNo: { type: String },
  mobileNumber: { type: String },
  payoutAccount: { type: String },
  qrCodeString: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Driver', DriverSchema);
