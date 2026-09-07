const mongoose = require('mongoose');

const SystemLogSchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  details: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SystemLog', SystemLogSchema);
