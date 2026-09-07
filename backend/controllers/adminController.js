const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Trip = require('../models/Trip');
const Route = require('../models/Route');
const SystemLog = require('../models/SystemLog');

const logAction = async ({ action, performedBy, targetUser, details }) => {
  try {
    await SystemLog.create({ action, performedBy, targetUser, details });
  } catch (err) {
    console.error('System log error:', err.message);
  }
};

exports.listUsers = async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (role && role !== 'all') query.role = role;
    if (status && status !== 'all') {
      if (['approved', 'pending', 'rejected'].includes(status)) {
        query.approvalStatus = status;
      } else if (status === 'blocked') {
        query.isBlocked = true;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-password -verificationCode -verificationExpires');

    res.json({ success: true, total, page: Number(page), limit: Number(limit), users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -verificationCode -verificationExpires');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const allowed = ['name', 'email', 'phone', 'avatar', 'preferences', 'role', 'isBlocked'];
    const updates = {};
    allowed.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    });

    if (updates.email) updates.email = String(updates.email).trim().toLowerCase();
    if (updates.phone) updates.phone = String(updates.phone).trim();

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password -verificationCode -verificationExpires');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logAction({ action: 'Update User', performedBy: req.user._id, targetUser: user._id, details: `Admin updated profile for ${user.name}` });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters long.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
    const user = await User.findByIdAndUpdate(req.params.id, { password: hashedPassword }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logAction({ action: 'Reset Password', performedBy: req.user._id, targetUser: user._id, details: `Admin reset password for ${user.name}` });
    res.json({ success: true, message: `Password updated successfully for ${user.name}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { isBlocked } = req.body;
    if (typeof isBlocked !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isBlocked must be true or false' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked }, { new: true }).select('-password -verificationCode -verificationExpires');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logAction({
      action: isBlocked ? 'Block User' : 'Unblock User',
      performedBy: req.user._id,
      targetUser: user._id,
      details: `Admin ${isBlocked ? 'blocked' : 'activated'} ${user.name}`
    });

    res.json({ success: true, user, message: `User has been ${isBlocked ? 'blocked' : 'activated'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveUser = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid approval status provided.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { approvalStatus: status }, { new: true }).select('-password -verificationCode -verificationExpires');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logAction({
      action: 'Update Approval Status',
      performedBy: req.user._id,
      targetUser: user._id,
      details: `Admin set approval status to ${status} for ${user.name}`
    });

    res.json({ success: true, user, message: `User approval status set to ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const pipeline = [
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, role: '$role' }, count: { $sum: 1 } } },
      { $sort: { '_id.day': 1 } }
    ];

    const raw = await User.aggregate(pipeline);
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const nextDay = new Date(start);
      nextDay.setDate(start.getDate() + i);
      days.push(nextDay.toISOString().slice(0, 10));
    }

    const analytics = days.map((day) => {
      const driverCount = raw.filter((item) => item._id.day === day && item._id.role === 'driver').reduce((sum, item) => sum + item.count, 0);
      const passengerCount = raw.filter((item) => item._id.day === day && item._id.role === 'passenger').reduce((sum, item) => sum + item.count, 0);
      return {
        day: day.slice(5),
        Drivers: driverCount,
        Passengers: passengerCount
      };
    });

    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await SystemLog.create({ action: 'Delete User', performedBy: req.user._id, targetUser: user._id, details: `Admin deleted account ${user.name}` });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listTransactions = async (req, res) => {
  try {
    const { status, type, from, to, page = 1, limit = 25 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('user', 'name email phone')
      .populate({
        path: 'trip',
        select: 'status fare route',
        populate: { path: 'route', select: 'name origin destination' }
      });

    res.json({ success: true, total, page: Number(page), limit: Number(limit), transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listTrips = async (req, res) => {
  try {
    const { status, from, to, page = 1, limit = 25 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (from || to) {
      query.startTime = {};
      if (from) query.startTime.$gte = new Date(from);
      if (to) query.startTime.$lte = new Date(to);
    }

    const total = await Trip.countDocuments(query);
    const trips = await Trip.find(query)
      .sort({ startTime: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('passenger', 'name phone')
      .populate('driver', 'name phone')
      .populate('route', 'name origin destination');

    res.json({ success: true, total, page: Number(page), limit: Number(limit), trips });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listRoutes = async (req, res) => {
  try {
    const routes = await Route.find().sort({ name: 1 });
    res.json({ success: true, routes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRoute = async (req, res) => {
  try {
    const { name, origin, destination, baseFare, distance, isActive = true } = req.body;

    if (!name || !origin || !destination || baseFare === undefined || distance === undefined) {
      return res.status(400).json({ success: false, message: 'Route name, origin, destination, base fare, and distance are required' });
    }

    const route = await Route.create({ name, origin, destination, baseFare, distance, isActive });
    await logAction({ action: 'Create Route', performedBy: req.user._id, details: `Created route ${route.name}` });
    res.status(201).json({ success: true, route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRoute = async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

    await logAction({ action: 'Update Route', performedBy: req.user._id, details: `Updated route ${route.name}` });
    res.json({ success: true, route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteRoute = async (req, res) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

    await logAction({ action: 'Delete Route', performedBy: req.user._id, details: `Deleted route ${route.name}` });
    res.json({ success: true, message: 'Route deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.stats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDrivers = await User.countDocuments({ role: 'driver' });
    const totalPassengers = await User.countDocuments({ role: 'passenger' });
    const activeTrips = await Trip.countDocuments({ status: 'ongoing' });
    const totalRevenueResult = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;
    const routeCount = await Route.countDocuments();
    const blockedCount = await User.countDocuments({ isBlocked: true });
    const pendingApprovals = await User.countDocuments({ approvalStatus: 'pending' });

    res.json({
      success: true,
      stats: {
        totalUsers,
        drivers: totalDrivers,
        passengers: totalPassengers,
        activeTrips,
        totalRevenue,
        routeCount,
        blockedCount,
        pendingApprovals
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listLogs = async (req, res) => {
  try {
    const { page = 1, limit = 25, action, userId } = req.query;
    const query = {};

    if (action) query.action = action;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) query.$or = [{ performedBy: userId }, { targetUser: userId }];

    const total = await SystemLog.countDocuments(query);
    const logs = await SystemLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('performedBy', 'name phone role')
      .populate('targetUser', 'name phone role');

    res.json({ success: true, total, page: Number(page), limit: Number(limit), logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
