const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { getDriverRoomName } = require('../utils/driverRooms');

const generateReference = () => `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const handleCheckout = async (req, res) => {
  try {
    const { driverId, targaNo, passengerName, passengerPhone, seats, amount, userId, tripId } = req.body;

    if (!driverId || !seats || !amount) {
      return res.status(400).json({ success: false, message: 'Missing payment details.' });
    }

    const seatNumbers = Array.isArray(seats) ? seats.map(Number) : [Number(seats)];
    const paymentReference = generateReference();

    const transaction = new Transaction({
      user: userId || undefined,
      trip: tripId || undefined,
      amount: Number(amount),
      type: 'payment',
      status: 'completed',
      reference: paymentReference,
      metadata: {
        driverId,
        targaNo,
        passengerName: passengerName || passengerPhone || 'Passenger',
        passengerPhone: passengerPhone || '',
        seats: seatNumbers
      }
    });

    await transaction.save();

    const io = req.app.get('io');
    if (io) {
      const roomName = getDriverRoomName(driverId);
      io.to(roomName).emit('seat_status_changed', {
        seatNumbers,
        status: 'paid',
        passengerName: passengerName || passengerPhone || 'Passenger',
        amount: Number(amount),
        transactionId: paymentReference
      });

      io.to(roomName).emit('payment_received', {
        message: 'Instant payment collection alert',
        amount: Number(amount),
        seats: seatNumbers.length,
        seatNumbers,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        transactionId: paymentReference
      });
    }

    return res.status(200).json({
      success: true,
      receipt: {
        transactionId: paymentReference,
        targaNo,
        amountPaid: Number(amount),
        seatsBooked: seatNumbers,
        timestamp: transaction.createdAt
      }
    });
  } catch (err) {
    console.error('Payment Error:', err);
    return res.status(500).json({ success: false, message: 'Payment gateway error' });
  }
};

router.post('/checkout', handleCheckout);
router.post('/process-fare', handleCheckout);

router.get('/history/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const transactions = await Transaction.find({ 'metadata.driverId': driverId }).sort({ createdAt: -1 });
    res.json({ success: true, count: transactions.length, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = (io) => router;
