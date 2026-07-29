const express = require('express');
const router = express.Router();

// Mock database for transactions (or swap with your Mongoose Transaction model)
const transactions = [];

// @route   POST /api/payments/checkout
// @desc    Process Telebirr payment and emit socket event to driver room
// @access  Public
router.post('/checkout', async (req, res) => {
  try {
    const { driverId, targaNo, passengerName, seats, amount } = req.body;

    // Validate required payload fields
    if (!driverId || !seats || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment details (driverId, seats, amount).'
      });
    }

    // Ensure seats is an array (handles single seat or multiple seat selection)
    const seatNumbers = Array.isArray(seats) ? seats : [seats];

    // Generate Telebirr transaction reference
    const txRef = `TX-TLB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transactionRecord = {
      txRef,
      driverId,
      targaNo: targaNo || 'UNREGISTERED',
      passengerName: passengerName || 'Passenger',
      seats: seatNumbers,
      amount: Number(amount),
      status: 'COMPLETED',
      createdAt: new Date()
    };

    // Save transaction
    transactions.push(transactionRecord);

    // 1. Emit to driver's room using the event defined in server.js
    req.io.to(driverId).emit('seat_status_changed', {
      seatNumbers: seatNumbers,
      status: 'paid',
      passengerName: transactionRecord.passengerName,
      txRef: transactionRecord.txRef
    });

    // 2. Direct event fallback targeting payment listeners
    req.io.emit(`payment_completed_${driverId}`, {
      seats: seatNumbers,
      amount: transactionRecord.amount,
      passengerName: transactionRecord.passengerName,
      txRef: transactionRecord.txRef
    });

    console.log(`[PAYMENT] ${amount} ETB received for Driver ${driverId} | Seats: ${seatNumbers.join(', ')}`);

    return res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      transaction: transactionRecord
    });
  } catch (error) {
    console.error('Payment Processing Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server fault processing payment transaction'
    });
  }
});

// @route   GET /api/payments/history/:driverId
// @desc    Fetch driver payment transaction history
// @access  Public
router.get('/history/:driverId', (req, res) => {
  try {
    const { driverId } = req.params;
    const driverTx = transactions.filter((t) => t.driverId === driverId);

    return res.status(200).json({
      success: true,
      count: driverTx.length,
      transactions: driverTx
    });
  } catch (error) {
    console.error('Fetch History Error:', error);
    return res.status(500).json({ success: false, message: 'Error retrieving payment logs' });
  }
});

module.exports = router;