const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const adminAuth = require('../middleware/adminAuth');

// Get all users with search/role filters
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { role, status, search } = req.query;
    let query = {};

    if (role && role !== 'all') query.role = role;
    if (status && status !== 'all') query.approvalStatus = status;
    
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { 'driverData.targaNo': searchRegex }
      ];
    }

    const users = await User.find(query).sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📊 GET /api/admin/analytics - 7-Day Registration Analytics for Charts
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const days = 7;
    const analytics = [];

    for (let i = days - 1; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);

      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const dayLabel = start.toLocaleDateString('en-US', { weekday: 'short' });

      // Count registrations for drivers and passengers within this day's timeframe
      const newDrivers = await User.countDocuments({
        role: 'driver',
        createdAt: { $gte: start, $lte: end }
      });

      const newPassengers = await User.countDocuments({
        role: 'passenger',
        createdAt: { $gte: start, $lte: end }
      });

      analytics.push({
        day: dayLabel,
        Drivers: newDrivers,
        Passengers: newPassengers
      });
    }

    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 🔑 Admin Reset Password Endpoint
router.patch('/users/:id/reset-password', adminAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 4 characters long.' 
      });
    }

    // Hash the new plain-text password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword.trim(), salt);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: `Password updated successfully for ${user.name}` 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update approval status (Approve / Reject driver or user)
router.patch('/users/:id/approve', adminAuth, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: status },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    // ⚡ Emit status change to socket clients
    const io = req.app.get('io');
    if (io) {
      io.emit('user_status_changed', { userId: user._id, status });
    }

    res.json({ success: true, message: `User status updated to ${status}`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a user account permanently
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ⚡ Emit deletion event to socket clients
    const io = req.app.get('io');
    if (io) {
      io.emit('user_deleted', { userId: req.params.id });
    }

    res.json({ success: true, message: `User ${user.name} (${user.phone}) deleted successfully.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// System Overview Stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const drivers = await User.countDocuments({ role: 'driver' });
    const passengers = await User.countDocuments({ role: 'passenger' });
    const pendingApprovals = await User.countDocuments({ approvalStatus: 'pending' });

    res.json({
      success: true,
      stats: { totalUsers, drivers, passengers, pendingApprovals }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;