const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Driver = require('../models/Driver');
const { getFallbackStore } = require('../utils/fallbackStore');

const fallbackStore = getFallbackStore();

const isMongoUnavailableError = (error) => {
    return !error || error.name === 'ValidationError' || error.name === 'MongooseServerSelectionError' || error.name === 'MongoServerSelectionError' || error.message?.includes('ECONNREFUSED') || error.message?.includes('Topology') || error.message?.includes('connect ECONNREFUSED') || error.message?.includes('Cast to ObjectId');
};

// INITIATE & FINALIZE FARE TRANSACTION
router.post('/process-fare', async (req, res) => {
    let calculatedAmount = 0;
    let generatedTxnId = null;
    let driverId = null;
    let passengerPhone = '';
    let seatCount = 1;
    let baseFare = 0;

    try {
        ({ driverId, passengerPhone, seatCount, baseFare } = req.body);

        calculatedAmount = seatCount * baseFare;
        generatedTxnId = "TXN" + Math.floor(100000000 + Math.random() * 900000000);

        // 1. Save record into MongoDB
        const transaction = new Transaction({
            transactionId: generatedTxnId,
            driverId,
            passengerPhone,
            amountPaid: calculatedAmount,
            seatsBooked: seatCount,
            paymentStatus: 'SUCCESS' // Assume success from external webhook gateway mock
        });

        await transaction.save();

        // 2. Fetch driver metadata to get current profile details
        const driverDetails = await Driver.findById(driverId);

        // 3. Trigger Real-Time Socket.io Alert straight to the driver dashboard
        // Emits exclusively to the room matched to that specific driverId
        req.io.to(driverId).emit('payment_received', {
            message: "Instant payment collection alert",
            amount: calculatedAmount,
            seats: seatCount,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            transactionId: generatedTxnId
        });

        // 4. Return receipt verification payload to passenger client
        return res.status(200).json({
            success: true,
            receipt: {
                transactionId: generatedTxnId,
                targaNo: driverDetails ? driverDetails.targaNo : "N/A",
                amountPaid: calculatedAmount,
                seatsBooked: seatCount,
                timestamp: transaction.createdAt
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
            req.io.to(driverId).emit('payment_received', {
                message: 'Instant payment collection alert',
                amount: calculatedAmount,
                seats: seatCount,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                transactionId: transaction.transactionId
            });

            return res.status(200).json({
                success: true,
                receipt: {
                    transactionId: transaction.transactionId,
                    targaNo: driverDetails ? driverDetails.targaNo || driverDetails.vehiclePlate : 'N/A',
                    amountPaid: calculatedAmount,
                    seatsBooked: seatCount,
                    timestamp: transaction.createdAt
                }
            });
        }

        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;