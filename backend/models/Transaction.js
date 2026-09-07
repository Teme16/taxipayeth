const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: false },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ['payment', 'refund', 'adjustment'],
      default: 'payment'
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed'
    },
    reference: { type: String, required: true, unique: true },
    metadata: {
      driverId: { type: String },
      targaNo: { type: String },
      passengerName: { type: String },
      passengerPhone: { type: String },
      seats: [{ type: Number }]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
