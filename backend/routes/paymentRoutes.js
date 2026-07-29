const express = require('express');
const router = express.Router();

// Mock Payment Database / Log
const transactions = [];

module.exports = (io) => {
  // POST /api/payments/checkout
  router.post('/checkout', async (req, res) => {
    try {
      const { driverId, targaNo, passengerName, seats, amount } = req.body;

      if (!driverId || !seats || !amount) {
        return res.status(400).json({ success: false, message: 'Missing payment details.' });
      }

      // 1. Generate unique Telebirr transaction reference
      const txRef = `TX-TLB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const paymentRecord = {
        txRef,
        driverId,
        targaNo,
        passengerName: passengerName || 'Passenger',
        seats: Array.isArray(seats) ? seats : [seats],
        amount,
        status: 'COMPLETED',
        createdAt: new Date()
      };

      // 2. Save transaction record
      transactions.push(paymentRecord);

      // 3. EMIT REAL-TIME SOCKET EVENT TO DRIVER
      // Notifies the specific driver screen to update seat colors from Red to Green immediately
      io.emit(`payment_completed_${driverId}`, {
        seats: paymentRecord.seats,
        amount: paymentRecord.amount,
        passengerName: paymentRecord.passengerName,
        txRef: paymentRecord.txRef
      });

      // Also emit to general room if using socket rooms
      io.to(driverId).emit('seat_paid', {
        seats: paymentRecord.seats,
        txRef: paymentRecord.txRef
      });

      console.log(`[PAYMENT SUCCESS] ${amount} ETB paid by ${passengerName} for Seats: ${paymentRecord.seats.join(', ')}`);

      return res.status(200).json({
        success: true,
        message: 'Telebirr payment processed successfully',
        transaction: paymentRecord
      });
    } catch (error) {
      console.error('Payment Error:', error);
      return res.status(500).json({ success: false, message: 'Payment gateway error' });
    }
  });

  // GET /api/payments/history/:driverId
  router.get('/history/:driverId', (req, res) => {
    const { driverId } = req.params;
    const driverTx = transactions.filter((t) => t.driverId === driverId);
    res.json({ success: true, count: driverTx.length, transactions: driverTx });
  });

  return router;
};