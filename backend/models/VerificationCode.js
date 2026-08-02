const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
  telegramChatId: { type: String, required: true },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 } // Auto-deletes after 5 min
});

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);