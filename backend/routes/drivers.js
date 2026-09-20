'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Driver = require('../models/Driver');
const User = require('../models/User');

const {
  protect,
  requireApprovedDriver
} = require('../middleware/auth');

const asyncHandler =
  require('../utils/asyncHandler');

const router = express.Router();

const storage = multer.memoryStorage();

const fileFilter = (
  req,
  file,
  callback
) => {
  const allowed = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);

  if (!allowed.has(file.mimetype)) {
    return callback(
      new Error(
        'Only JPEG, PNG and WebP files are allowed.'
      )
    );
  }

  callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

router.post(
  '/complete-profile',
  protect,
  upload.fields([
    {
      name: 'profilePic',
      maxCount: 1
    },
    {
      name: 'digitalId',
      maxCount: 1
    }
  ]),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message:
          'Only driver accounts can create driver profiles.'
      });
    }

    const {
      birthDate,
      licenseNumber,
      emergencyContact,
      mobileNumber,
      address,
      targaNo
    } = req.body;

    if (!targaNo) {
      return res.status(422).json({
        success: false,
        message:
          'Vehicle plate number is required.'
      });
    }

    const profilePic =
      req.files?.profilePic?.[0]
        ? `data:${req.files.profilePic[0].mimetype};base64,${req.files.profilePic[0].buffer.toString('base64')}`
        : '';

    const digitalId =
      req.files?.digitalId?.[0]
        ? `data:${req.files.digitalId[0].mimetype};base64,${req.files.digitalId[0].buffer.toString('base64')}`
        : '';

    const driver =
      await Driver.findOneAndUpdate(
        {
          user: req.user._id
        },
        {
          $set: {
            targaNo,
            birthDate:
              birthDate || null,
            licenseNumber:
              licenseNumber || '',
            emergencyContact:
              emergencyContact || '',
            mobileNumber:
              mobileNumber ||
              req.user.phone,
            address:
              address || '',
            ...(profilePic && {
              profilePic
            }),
            ...(digitalId && {
              digitalIdDocument: {
                url: digitalId,
                uploadedAt: new Date()
              }
            }),
            isProfileCompleted: true
          }
        },
        {
          returnDocument: 'after',
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );

    await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          approvalStatus: 'pending'
        }
      }
    );

    return res.status(200).json({
      success: true,
      message:
        'Driver profile saved successfully.',
      driver
    });
  })
);

router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const driver =
      await Driver.findOne({
        user: req.user._id
      })
      .populate(
        'user',
        'name phone email role avatar approvalStatus'
      )
      .populate('currentRoute');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message:
          'Driver profile not found.'
      });
    }

    return res.json({
      success: true,
      driver
    });
  })
);

router.get(
  '/:id',
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const query = { $or: [] };

    if (mongoose.isValidObjectId(id)) {
      query.$or.push({ user: id }, { _id: id });
    } else {
      query.$or.push({ driverId: id.toUpperCase() }, { targaNo: id.toUpperCase() });
    }

    const driver =
      await Driver.findOne(query)
      .populate(
        'user',
        'name phone avatar'
      )
      .populate('currentRoute');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message:
          'Driver not found.'
      });
    }

    return res.json({
      success: true,
      driver
    });
  })
);

router.put(
  '/current-route',
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ success: false, message: 'Only drivers can update routes.' });
    }

    const { routeId } = req.body;
    if (!routeId) {
      return res.status(400).json({ success: false, message: 'Route ID is required.' });
    }

    const driver = await Driver.findOneAndUpdate(
      { user: req.user._id },
      { $set: { currentRoute: routeId } },
      { new: true }
    ).populate('currentRoute');

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    return res.json({ success: true, message: 'Route updated successfully.', currentRoute: driver.currentRoute });
  })
);

router.post(
  '/reset-trip',
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ success: false, message: 'Only drivers can reset trips.' });
    }

    const driver = await Driver.findOneAndUpdate(
      { user: req.user._id },
      { $set: { lastTripResetAt: new Date() } },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    // Broadcast an event so clients (like passenger scanners) can react if needed
    const io = req.app.get('io');
    if (io) {
      const { getDriverRoomName } = require('../utils/driverRooms');
      io.to(getDriverRoomName(req.user._id)).emit('seat_status_changed', {
        seatNumbers: Array.from({ length: 15 }, (_, i) => i + 1),
        status: 'unpaid'
      });
    }

    return res.json({ success: true, message: 'Trip reset successfully.', lastTripResetAt: driver.lastTripResetAt });
  })
);

router.get(
  '/:id/seats',
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const query = { $or: [] };

    if (mongoose.isValidObjectId(id)) {
      query.$or.push({ user: id }, { _id: id });
    } else {
      query.$or.push({ driverId: id.toUpperCase() }, { targaNo: id.toUpperCase() });
    }

    const driver = await Driver.findOne(query).select('user lastTripResetAt');
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    const Transaction = require('../models/Transaction');
    const txQuery = {
      driver: driver.user,
      status: 'completed',
      type: { $ne: 'withdraw' }
    };
    
    if (driver.lastTripResetAt) {
      txQuery.createdAt = { $gte: driver.lastTripResetAt };
    } else {
      // Fallback to today if no reset timestamp exists
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      txQuery.createdAt = { $gte: startOfDay };
    }

    const transactions = await Transaction.find(txQuery).select('seats status');
    
    const occupiedSeats = {};
    transactions.forEach(t => {
      if (Array.isArray(t.seats)) {
        t.seats.forEach(s => {
          occupiedSeats[s] = 'paid';
        });
      }
    });

    return res.json({ success: true, occupiedSeats });
  })
);

module.exports = router;