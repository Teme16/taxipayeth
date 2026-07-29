const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  driverId: { type: String, required: true },
  passengerPhone: { type: String, required: true },
  amountPaid: { type: Number, required: true },
  seatsBooked: { type: Number, required: true }, // Count of seats
  seats: [{ type: Number }],                     // Array of selected seat numbers (e.g., [1, 2, 5])
  paymentStatus: { 
    type: String, 
    enum: ['PENDING', 'SUCCESS', 'FAILED'], 
    default: 'SUCCESS' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);