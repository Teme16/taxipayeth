const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Driver = require('../models/Driver');
const User = require('../models/User'); // Imported User for fallbacks

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
  
  // Only search by _id if id is a valid 24-character MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(id)) {
    conditions.push({ _id: id });
  }

  return { $or: conditions };
};

// POST /api/drivers/complete-profile
router.post(
  '/complete-profile',
  upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'digitalId', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { driverId, fullName, birthDate, licenseNumber, emergencyContact, mobileNumber, address, targaNo } = req.body;

      if (!driverId) {
        return res.status(400).json({ success: false, message: 'Driver ID is required.' });
      }

      // Build fields to update
      const updateData = { 
        driverId, 
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
      if (req.files && req.files['profilePic'] && req.files['profilePic'][0]) {
        updateData.profilePic = req.files['profilePic'][0].filename;
      }

      if (req.files && req.files['digitalId'] && req.files['digitalId'][0]) {
        updateData.digitalIdDoc = req.files['digitalId'][0].filename;
      }

      // Safe update with upsert: true (Creates profile if it doesn't exist yet)
      let updatedDriver = await Driver.findOneAndUpdate(
        buildDriverQuery(driverId),
        { $set: updateData },
        { new: true, upsert: true, runValidators: false }
      );

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully!',
        driver: updatedDriver
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