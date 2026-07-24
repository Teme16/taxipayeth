const mongoose = require('mongoose');

const TariffSchema = new mongoose.Schema({
  fromLocation: { type: String, required: true },
  toLocation: { type: String, required: true },
  price: { type: Number, required: true },
  estimatedDurationMins: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tariff', TariffSchema);
