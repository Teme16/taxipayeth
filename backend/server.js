require('dotenv').config(); // Load variables from .env if present
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

// 1. Import Routers
const authRoutes = require('./routes/authRoutes');
const driverRoutes = require('./routes/drivers');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/adminRoutes');
const { getDriverRoomName } = require('./utils/driverRooms');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Make Socket.io instance available in Express routes via req.app.get('io')
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach req.io middleware so routes can access socket directly
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Serve Static Uploads Directory (Crucial for Profile Pictures & Docs)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Fallback 404 route to prevent HTML 404 responses
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ⚡ Active Socket User Tracker (socket.id -> { userId, role })
const activeUsers = new Map();

// Broadcast updated list of online user IDs to all clients (including Admin Dashboard)
const broadcastOnlineUsers = () => {
  const onlineUserIds = Array.from(new Set(Array.from(activeUsers.values()).map(u => u.userId)));
  io.emit('online_users_list', onlineUserIds);
};

// Socket.io Real-time Handlers
io.on('connection', (socket) => {
  console.log('⚡ Socket client connected:', socket.id);

  // 🟢 Triggered when user/driver logs in or opens the app
  socket.on('user_online', (userData) => {
    if (userData?.userId) {
      activeUsers.set(socket.id, { userId: userData.userId, role: userData.role });
      console.log(`👤 User Online: ${userData.userId} (${userData.role})`);
      broadcastOnlineUsers();
    }
  });

  socket.on('join_driver_room', (driverId) => {
    const roomName = getDriverRoomName(driverId);
    socket.join(roomName);
    console.log(`Driver joined room: ${roomName}`);
  });

  socket.on('update_seat_status', (data) => {
    const { driverId } = data;
    const roomName = getDriverRoomName(driverId);
    io.to(roomName).emit('seat_status_changed', data);
  });

  // 🔴 Triggered when user closes tab or disconnects
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (activeUsers.has(socket.id)) {
      activeUsers.delete(socket.id);
      broadcastOnlineUsers();
    }
  });
});

// Connect Database and Start Server
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxipay';

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Stop the other process or set a different PORT.`);
    process.exit(1);
  }

  console.error('❌ Server error:', err);
  process.exit(1);
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err);
  });