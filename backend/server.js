require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

// Safely resolve connect-mongo across different module exports
const MongoStorePackage = require('connect-mongo');
const MongoStore = MongoStorePackage.default || MongoStorePackage;

// 1. Import Database Connection & Telegram Config
const connectDB = require('./config/db');
require('./config/telegram'); // Pre-loads Telegram Bot listeners/webhooks

// 2. Import Routers & Utilities
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const driverRoutes = require('./routes/drivers');
const paymentRoutesFactory = require('./routes/payments');
const adminRoutes = require('./routes/adminRoutes');
const { getDriverRoomName } = require('./utils/driverRooms');

const app = express();
const server = http.createServer(app);

// Dynamic CORS Origin Validator Function
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

const corsOriginCheck = (origin, callback) => {
  // Allow requests with no origin (like mobile apps, curl, Postman)
  if (!origin) return callback(null, true);
  
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    return callback(null, origin); // Reflect back specific origin
  }
  
  return callback(new Error(`CORS policy error: Origin ${origin} is not allowed.`));
};

// Initialize Socket.io with credentials & dynamic origin check
const io = new Server(server, {
  cors: {
    origin: corsOriginCheck,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Make Socket.io instance available globally in Express app context
app.set('io', io);

// Basic Middleware Stack
app.use(
  cors({
    origin: corsOriginCheck,
    credentials: true, // Required for session cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Configure Express Sessions with MongoDB Storage
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxipay';

// Handle MongoStore initialization for both modern (v4+) and legacy versions
const sessionStore = typeof MongoStore.create === 'function'
  ? MongoStore.create({
      mongoUrl: MONGO_URI,
      collectionName: 'sessions',
      ttl: 7 * 24 * 60 * 60 // 7 days expiration
    })
  : new MongoStore({
      url: MONGO_URI,
      collection: 'sessions',
      ttl: 7 * 24 * 60 * 60
    });

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'taxipay-super-secret-key',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true, // Safeguard against XSS
      secure: process.env.NODE_ENV === 'production', // true for HTTPS in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    }
  })
);

// Session Protection Middleware helper
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Session missing or expired'
  });
};

// Make requireAuth accessible throughout the app router scope if needed
app.set('requireAuth', requireAuth);

// Attach Socket.io directly to incoming requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Ensure uploads directory exists before static serving
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, status: 'UP', timestamp: new Date() });
});

// 4. Mount API Routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/payments', paymentRoutesFactory(io));
app.use('/api/admin', adminRoutes);

// Fallback 404 Handler for Unmatched API Routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('🔥 Global Server Error:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// 5. Socket.io State Management
const activeUsers = new Map();

const broadcastOnlineUsers = () => {
  const onlineUserIds = Array.from(
    new Set(Array.from(activeUsers.values()).map((u) => String(u.userId)))
  );
  io.emit('online_users_list', onlineUserIds);
};

// Real-time Event Handlers
io.on('connection', (socket) => {
  console.log('⚡ Socket connected:', socket.id);

  const handleUserOnline = (data) => {
    const userId = typeof data === 'string' || typeof data === 'number' ? data : data?.userId;
    const role = data?.role || 'passenger';

    if (userId) {
      activeUsers.set(socket.id, { userId: String(userId), role });
      console.log(`👤 User Online: ${userId} (${role})`);
      broadcastOnlineUsers();
    }
  };

  socket.on('user_online', handleUserOnline);
  socket.on('register_online_user', handleUserOnline);

  // Driver Room Subscriptions for Real-Time Seat Updates
  socket.on('join_driver_room', (driverId) => {
    if (!driverId) return;
    const roomName = getDriverRoomName(driverId);
    socket.join(roomName);
    console.log(`👥 Client ${socket.id} joined room: ${roomName}`);
  });

  socket.on('leave_driver_room', (driverId) => {
    if (!driverId) return;
    const roomName = getDriverRoomName(driverId);
    socket.leave(roomName);
    console.log(`🚪 Client ${socket.id} left room: ${roomName}`);
  });

  socket.on('update_seat_status', (data) => {
    const { driverId } = data || {};
    if (!driverId) return;
    const roomName = getDriverRoomName(driverId);
    io.to(roomName).emit('seat_status_changed', data);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
    if (activeUsers.has(socket.id)) {
      activeUsers.delete(socket.id);
      broadcastOnlineUsers();
    }
  });
});

// 6. Server Startup & Database Connection
const PORT = process.env.PORT || 5001;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Stop the existing process or set another PORT in .env.`);
    process.exit(1);
  }
  console.error('❌ Server Listen Error:', err);
  process.exit(1);
});

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 TaxiPay Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  });

// 7. Graceful Shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down HTTP server & Socket connections...`);

  io.close(() => {
    console.log('🔌 All socket connections closed.');
  });

  server.close(() => {
    console.log('✅ HTTP server closed successfully.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ Forced shutdown due to lingering connections.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));