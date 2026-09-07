const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema({
  passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  fare: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['requested', 'ongoing', 'completed', 'cancelled'],
    default: 'requested'
  },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Trip', TripSchema);
