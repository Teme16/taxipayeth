const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Driver = require('../models/Driver');
const { getFallbackStore } = require('../utils/fallbackStore');
const { getDriverRoomName } = require('../utils/driverRooms');

const fallbackStore = getFallbackStore();

// Utility to check if MongoDB server connection or network is lost
const isMongoUnavailableError = (error) => {
  if (!error) return true;
  const unavailableErrorNames = [
    'MongooseServerSelectionError',
    'MongoServerSelectionError',
    'MongoNetworkError',
    'MongoTimeoutError'
  ];
  return (
    unavailableErrorNames.includes(error.name) ||
    error.message?.includes('ECONNREFUSED') ||
    error.message?.includes('Topology') ||
    error.message?.includes('connect ECONNREFUSED')
  );
};

// Helper to safely find a driver by ObjectId OR custom string driverId
const findDriverSafely = async (id) => {
  if (!id) return null;
  const conditions = [{ driverId: id }];
  if (mongoose.Types.ObjectId.isValid(id)) {
    conditions.push({ _id: id });
  }
  return await Driver.findOne({ $or: conditions }).catch(() => null);
};

// Helper to generate transaction IDs
const generateTransactionId = () => "TXN" + Math.floor(100000000 + Math.random() * 900000000);

// Helper to safely emit socket events regardless of middleware attachment method
const getSocketIO = (req) => req.io || req.app.get('io');

// 1. PRIMARY CHECKOUT ENDPOINT (Used by PassengerPage.jsx)
router.post('/checkout', async (req, res) => {
  let calculatedAmount = 0;
  let generatedTxnId = null;
  let driverId = null;
  let seats = [];
  let passengerName = 'Passenger';
  let targaNo = 'N/A';

  try {
    const { driverId: dId, targaNo: plate, passengerName: pName, seats: seatList, amount } = req.body;
    
    driverId = dId;
    passengerName = pName || 'Passenger';
    targaNo = plate || 'N/A';
    seats = Array.isArray(seatList) ? seatList.map(Number) : [Number(seatList)];
    calculatedAmount = Number(amount) || 0;
    generatedTxnId = generateTransactionId();

    // Save record into MongoDB
    const transaction = new Transaction({
      transactionId: generatedTxnId,
      driverId,
      passengerPhone: passengerName,
      amountPaid: calculatedAmount,
      seatsBooked: seats.length,
      seats: seats,
      paymentStatus: 'SUCCESS'
    });

    await transaction.save();

    // Broadcast real-time Socket updates safely
    const io = getSocketIO(req);
    if (io) {
      const roomName = getDriverRoomName(driverId);
      io.to(roomName).emit('seat_status_changed', {
        seatNumbers: seats,
        status: 'paid',
        passengerName,
        amount: calculatedAmount,
        transactionId: generatedTxnId
      });

      io.to(roomName).emit('payment_received', {
        message: 'Instant payment collection alert',
        amount: calculatedAmount,
        seats: seats.length,
        seatNumbers: seats,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        transactionId: generatedTxnId
      });
    }

    return res.status(200).json({
      success: true,
      receipt: {
        transactionId: generatedTxnId,
        targaNo,
        amountPaid: calculatedAmount,
        seatsBooked: seats,
        timestamp: transaction.createdAt || new Date()
      }
    });

  } catch (error) {
    if (isMongoUnavailableError(error)) {
      const transaction = await fallbackStore.createTransaction({
        driverId,
        passengerPhone: passengerName,
        amountPaid: calculatedAmount,
        seatsBooked: seats.length,
        seats: seats,
        paymentStatus: 'SUCCESS'
      });

      const driverDetails = fallbackStore.getDriverById(driverId);
      const activeTxnId = transaction.transactionId || generatedTxnId;

      // Broadcast real-time Socket updates from Fallback
      const io = getSocketIO(req);
      if (io) {
        const roomName = getDriverRoomName(driverId);
        io.to(roomName).emit('seat_status_changed', {
          seatNumbers: seats,
          status: 'paid',
          passengerName,
          amount: calculatedAmount,
          transactionId: activeTxnId
        });

        io.to(roomName).emit('payment_received', {
          message: 'Instant payment collection alert',
          amount: calculatedAmount,
          seats: seats.length,
          seatNumbers: seats,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          transactionId: activeTxnId
        });
      }

      return res.status(200).json({
        success: true,
        receipt: {
          transactionId: activeTxnId,
          targaNo: driverDetails ? driverDetails.targaNo || driverDetails.vehiclePlate : targaNo,
          amountPaid: calculatedAmount,
          seatsBooked: seats,
          timestamp: transaction.createdAt || new Date()
        }
      });
    }

    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. LEGACY PROCESS-FARE ENDPOINT
router.post('/process-fare', async (req, res) => {
  let calculatedAmount = 0;
  let generatedTxnId = null;
  let driverId = null;
  let passengerPhone = '';
  let seatCount = 1;
  let baseFare = 0;

  try {
    ({ driverId, passengerPhone, seatCount = 1, baseFare = 0 } = req.body);

    calculatedAmount = Number(seatCount) * Number(baseFare);
    generatedTxnId = generateTransactionId();

    const transaction = new Transaction({
      transactionId: generatedTxnId,
      driverId,
      passengerPhone,
      amountPaid: calculatedAmount,
      seatsBooked: seatCount,
      paymentStatus: 'SUCCESS'
    });

    await transaction.save();

    // Safely query driver by ObjectId or custom driverId string
    const driverDetails = await findDriverSafely(driverId);

    const io = getSocketIO(req);
    if (io) {
      const roomName = getDriverRoomName(driverId);
      io.to(roomName).emit('payment_received', {
        message: 'Instant payment collection alert',
        amount: calculatedAmount,
        seats: seatCount,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        transactionId: generatedTxnId
      });
    }

    return res.status(200).json({
      success: true,
      receipt: {
        transactionId: generatedTxnId,
        targaNo: driverDetails ? driverDetails.targaNo : 'N/A',
        amountPaid: calculatedAmount,
        seatsBooked: seatCount,
        timestamp: transaction.createdAt || new Date()
      }
    });

  } catch (error) {
    if (isMongoUnavailableError(error)) {
      const transaction = await fallbackStore.createTransaction({
        driverId,
        passengerPhone,
        amountPaid: calculatedAmount,
        seatsBooked: seatCount,
        paymentStatus: 'SUCCESS'
      });

      const driverDetails = fallbackStore.getDriverById(driverId);

      const io = getSocketIO(req);
      if (io) {
        const roomName = getDriverRoomName(driverId);
        io.to(roomName).emit('payment_received', {
          message: 'Instant payment collection alert',
          amount: calculatedAmount,
          seats: seatCount,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          transactionId: transaction.transactionId
        });
      }

      return res.status(200).json({
        success: true,
        receipt: {
          transactionId: transaction.transactionId,
          targaNo: driverDetails ? driverDetails.targaNo || driverDetails.vehiclePlate : 'N/A',
          amountPaid: calculatedAmount,
          seatsBooked: seatCount,
          timestamp: transaction.createdAt || new Date()
        }
      });
    }

    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. GET CURRENT SEAT STATES AND EARNINGS FOR A DRIVER
router.get('/seats/:driverId', async (req, res) => {
  const { driverId } = req.params;

  const calculateSeatsAndEarnings = (transactionsList) => {
    const seatStates = {};
    for (let i = 1; i <= 15; i++) seatStates[i] = 'unpaid';

    let totalEarnings = 0;

    transactionsList.forEach((txn) => {
      totalEarnings += Number(txn.amountPaid || 0);

      const seatList = txn.seats || (Array.isArray(txn.seatsBooked) ? txn.seatsBooked : []);
      if (Array.isArray(seatList)) {
        seatList.forEach((seatNum) => {
          if (seatStates[seatNum] !== undefined) {
            seatStates[seatNum] = 'paid';
          }
        });
      }
    });

    return { seatStates, totalEarnings };
  };

  try {
    const transactions = await Transaction.find({
      driverId,
      paymentStatus: 'SUCCESS'
    });

    const { seatStates, totalEarnings } = calculateSeatsAndEarnings(transactions);
    return res.status(200).json({ success: true, seatStates, totalEarnings });

  } catch (error) {
    if (isMongoUnavailableError(error)) {
      const fallbackTxns = fallbackStore.getTransactionsByDriver(driverId);
      const { seatStates, totalEarnings } = calculateSeatsAndEarnings(fallbackTxns);
      return res.status(200).json({ success: true, seatStates, totalEarnings });
    }

    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. GET DRIVER TRANSACTION HISTORY
router.get('/driver-history/:driverId', async (req, res) => {
  const { driverId } = req.params;

  try {
    const transactions = await Transaction.find({
      driverId,
      paymentStatus: 'SUCCESS'
    }).sort({ createdAt: -1 });

    const totalEarnings = transactions.reduce((sum, txn) => sum + Number(txn.amountPaid || 0), 0);

    return res.status(200).json({ success: true, transactions, totalEarnings });

  } catch (error) {
    if (isMongoUnavailableError(error)) {
      const fallbackTxns = fallbackStore.getTransactionsByDriver(driverId);
      const totalEarnings = fallbackTxns.reduce((sum, txn) => sum + Number(txn.amountPaid || 0), 0);

      return res.status(200).json({ success: true, transactions: fallbackTxns, totalEarnings });
    }

    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. MANUAL SEAT STATUS UPDATE (Driver toggle/reset)
router.post('/seats/update', (req, res) => {
  const { driverId, seatNumbers, status } = req.body;

  if (!driverId || !seatNumbers || !status) {
    return res.status(400).json({ success: false, message: 'Missing required parameters' });
  }

  const seats = Array.isArray(seatNumbers) ? seatNumbers.map(Number) : [Number(seatNumbers)];

  const io = getSocketIO(req);
  if (io) {
    const roomName = getDriverRoomName(driverId);
    io.to(roomName).emit('seat_status_changed', {
      seatNumbers: seats,
      status
    });
  }

  return res.status(200).json({ success: true, seatNumbers: seats, status });
});

module.exports = router;