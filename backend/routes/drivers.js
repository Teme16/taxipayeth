const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Driver = require('../models/Driver');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Helper to construct safe query without triggering CastError
const buildDriverQuery = (id) => {
  const conditions = [{ driverId: id }];
  
  if (mongoose.Types.ObjectId.isValid(id)) {
    conditions.push({ _id: id });
  }

  return { $or: conditions };
};

// POST /api/drivers/complete-profile
router.post(
  '/complete-profile',
  protect,
  upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'digitalId', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { driverId, fullName, birthDate, licenseNumber, emergencyContact, mobileNumber, address, targaNo } = req.body;

      // Use JWT authenticated user ID to ensure accurate association, fallback to provided driverId
      const actualDriverId = (req.user && req.user._id) ? req.user._id : driverId;

      if (!actualDriverId) {
        return res.status(400).json({ success: false, message: 'Driver ID is required.' });
      }

      // Build fields to update for Driver model
      const updateData = { 
        driverId: actualDriverId, 
        isProfileCompleted: true 
      };

      if (fullName) updateData.fullName = fullName;
      if (birthDate) updateData.birthDate = birthDate;
      if (licenseNumber) updateData.licenseNumber = licenseNumber;
      if (emergencyContact) updateData.emergencyContact = emergencyContact;
      if (mobileNumber) updateData.mobileNumber = mobileNumber;
      if (address) updateData.address = address;
      if (targaNo) updateData.targaNo = targaNo;

      // Extract uploaded filenames safely
      let profilePicUrl = '';
      let digitalIdUrl = '';

      if (req.files && req.files['profilePic'] && req.files['profilePic'][0]) {
        profilePicUrl = `/uploads/${req.files['profilePic'][0].filename}`;
        updateData.profilePic = req.files['profilePic'][0].filename;
      }

      if (req.files && req.files['digitalId'] && req.files['digitalId'][0]) {
        digitalIdUrl = `/uploads/${req.files['digitalId'][0].filename}`;
        updateData.digitalIdDoc = req.files['digitalId'][0].filename;
      }

      // 1. Safe update with upsert on Driver model
      let updatedDriver = await Driver.findOneAndUpdate(
        buildDriverQuery(actualDriverId),
        { $set: updateData },
        { new: true, upsert: true, runValidators: false }
      );

      // 2. ⚡ SYNC WITH USER MODEL (Fixes Top Bar & Admin Panel Display)
      const userConditions = [{ 'driverData.driverId': actualDriverId }];
      if (mongoose.Types.ObjectId.isValid(actualDriverId)) {
        userConditions.push({ _id: actualDriverId });
      }

      const userUpdateFields = {};
      if (fullName) userUpdateFields.name = fullName.trim();
      if (mobileNumber) userUpdateFields.phone = mobileNumber.trim();
      if (birthDate) userUpdateFields['driverData.birthDate'] = birthDate;
      if (licenseNumber) userUpdateFields['driverData.licenseNo'] = licenseNumber;
      if (emergencyContact) userUpdateFields['driverData.emergencyContact'] = emergencyContact;
      if (address) userUpdateFields['driverData.address'] = address;
      if (targaNo) userUpdateFields['driverData.targaNo'] = targaNo.trim();
      if (profilePicUrl) userUpdateFields['driverData.profileImage'] = profilePicUrl;
      if (digitalIdUrl) userUpdateFields['driverData.documentUrl'] = digitalIdUrl;

      const updatedUser = await User.findOneAndUpdate(
        { $or: userConditions },
        { $set: userUpdateFields },
        { new: true }
      );

      // 3. ⚡ BROADCAST SOCKET EVENT TO ADMIN DASHBOARD
      const io = req.app.get('io');
      if (io && updatedUser) {
        io.emit('user_updated', {
          userId: updatedUser._id,
          name: updatedUser.name,
          phone: updatedUser.phone,
          driverData: updatedUser.driverData
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully!',
        driver: updatedDriver,
        user: updatedUser ? {
          id: updatedUser._id,
          name: updatedUser.name,
          phone: updatedUser.phone,
          role: updatedUser.role,
          approvalStatus: updatedUser.approvalStatus,
          driverData: updatedUser.driverData
        } : null
      });
    } catch (error) {
      console.error('Profile update failed:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

// GET /api/drivers/:id - Fetch single driver profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let driver = await Driver.findOne(buildDriverQuery(id));

    // Fallback: If driver is missing in 'drivers', check 'users' and auto-create entry
    if (!driver) {
      const userConditions = [{ 'driverData.driverId': id }];
      if (mongoose.Types.ObjectId.isValid(id)) {
        userConditions.push({ _id: id });
      }

      const user = await User.findOne({ $or: userConditions });

      if (user && user.role === 'driver') {
        const assignedDriverId = user.driverData?.driverId || id;

        driver = new Driver({
          driverId: assignedDriverId,
          fullName: user.name,
          mobileNumber: user.phone,
          targaNo: user.driverData?.targaNo || 'PENDING'
        });

        await driver.save();
      }
    }

    if (!driver) {
      return res.status(404).json({ success: false, message: `Driver not found for ID: ${id}` });
    }

    return res.status(200).json({ success: true, driver });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;