const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
  telegramChatId: { type: String, default: '' },
  phone: { type: String, required: true },
  code: { type: String, required: true },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 1800 } // 30 minutes TTL
});

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);
