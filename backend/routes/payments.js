'use strict';

const express = require('express');
const { body } =
  require('express-validator');

const { protect } =
  require('../middleware/auth');

const validateRequest =
  require('../middleware/validateRequest');

const {
  paymentLimiter
} =
  require('../middleware/rateLimiters');

const asyncHandler =
  require('../utils/asyncHandler');

const {
  checkout
} =
  require('../services/paymentService');

const chapaController = require('../controllers/chapaController');

const {
  getDriverRoomName
} =
  require('../utils/driverRooms');

module.exports = function paymentRoutes(
  io
) {
  const router = express.Router();

  const validation = [
    body('driverId')
      .isMongoId()
      .withMessage(
        'A valid driver ID is required.'
      ),
      
    body('amount')
      .isNumeric()
      .withMessage(
        'Payment amount is required.'
      ),

    body('seats')
      .isArray({
        min: 1,
        max: 20
      })
      .withMessage(
        'At least one seat is required.'
      ),

    body('seats.*')
      .isInt({
        min: 1,
        max: 100
      })
      .withMessage(
        'Seat numbers must be valid integers.'
      ),

    body('password')
      .isString()
      .notEmpty()
      .withMessage(
        'Payment password is required.'
      )
  ];

  const handleCheckout =
    asyncHandler(
      async (req, res) => {
        const idempotencyKey =
          req.get(
            'Idempotency-Key'
          );

        if (
          !idempotencyKey ||
          idempotencyKey.length > 200
        ) {
          return res.status(400).json({
            success: false,
            message:
              'A valid Idempotency-Key header is required.'
          });
        }

        const result =
          await checkout({
            userId:
              req.user._id,
            driverId:
              req.body.driverId,
            amount:
              req.body.amount,
            seats:
              req.body.seats,
            password:
              req.body.password,
            idempotencyKey
          });

        const transaction =
          result.transaction;

        if (
          !result.alreadyProcessed
        ) {
          const socketIo =
            io ||
            req.app.get('io');

          if (socketIo) {
            const driverUserIdStr = String(transaction.driver);
            const event = {
              driverId: driverUserIdStr,
              seatNumbers: transaction.seats,
              status: 'paid',
              passengerName: req.body.passengerName || transaction.passengerSnapshot?.name,
              amount: transaction.amount,
              transactionId: transaction.transactionId,
              timestamp: transaction.createdAt
            };

            // Emit to the driver's User._id room (server auto-joins this on connect)
            const driverRoom = getDriverRoomName(driverUserIdStr);
            const userRoom = `user:${driverUserIdStr}`;

            console.log(`📡 Emitting seat_status_changed to rooms: [${driverRoom}], [${userRoom}]`, {
              seatNumbers: event.seatNumbers,
              amount: event.amount,
              status: event.status
            });

            socketIo
              .to(driverRoom)
              .emit(
                'seat_status_changed',
                event
              );

            // Also emit to the user:<id> personal room as a fallback
            socketIo
              .to(`user:${driverUserIdStr}`)
              .emit(
                'seat_status_changed',
                event
              );

            // Also emit to the Driver document _id room in case the frontend joined with it
            const Driver = require('../models/Driver');
            Driver.findOne({ user: driverUserIdStr })
              .select('_id driverId')
              .lean()
              .then((driverDoc) => {
                if (driverDoc) {
                  if (driverDoc._id) {
                    socketIo
                      .to(getDriverRoomName(String(driverDoc._id)))
                      .emit('seat_status_changed', event);
                  }
                  if (driverDoc.driverId) {
                    socketIo
                      .to(getDriverRoomName(driverDoc.driverId))
                      .emit('seat_status_changed', event);
                  }
                }
              })
              .catch((err) => {
                console.error('Driver room lookup error:', err.message);
              });
          }
        }

        return res
          .status(
            result.alreadyProcessed
              ? 200
              : 201
          )
          .json({
            success: true,
            message: "Payment successful",
            receipt: {
              transactionId: transaction.transactionId,
              amountPaid: transaction.amount,
              seatsBooked: transaction.seats,
              driverName: req.body.driverName || "Driver",
              targaNo: req.body.targaNo || "Unknown",
              timestamp: transaction.createdAt
            }
          });
      }
    );

  router.post(
    '/checkout',
    protect,
    paymentLimiter,
    validation,
    validateRequest,
    handleCheckout
  );

  // Chapa Wallet Deposit Routes
  router.post('/chapa/initialize', protect, chapaController.initializePayment);
  router.get('/chapa/verify/:tx_ref', protect, chapaController.verifyPayment);

  // Chapa Wallet Withdraw Routes
  router.post('/chapa/withdraw', protect, chapaController.withdraw);
  router.get('/chapa/banks', protect, chapaController.getBanks);
  const Transaction = require('../models/Transaction');

  router.get(
    '/history',
    protect,
    asyncHandler(
      async (req, res) => {
        const query = req.user.role === 'driver' 
          ? { driver: req.user._id } 
          : { user: req.user._id };

        const transactions = await Transaction.find(query)
          .sort({ createdAt: -1 })
          .limit(50);

        let lastTripResetAt = null;
        if (req.user.role === 'driver') {
          const Driver = require('../models/Driver');
          const driver = await Driver.findOne({ user: req.user._id }).select('lastTripResetAt').lean();
          if (driver) lastTripResetAt = driver.lastTripResetAt;
        }

        return res.json({
          success: true,
          transactions,
          lastTripResetAt
        });
      }
    )
  );

  return router;
};