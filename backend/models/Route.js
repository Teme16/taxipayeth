const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  origin: { type: String, required: true, trim: true },
  destination: { type: String, required: true, trim: true },
  baseFare: { type: Number, required: true, min: 0 },
  distance: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Route', RouteSchema);
