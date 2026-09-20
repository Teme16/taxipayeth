'use strict';

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const compression = require('compression');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const config = require('./config/env');
const {
  connectDB,
  disconnectDB
} = require('./config/db');

const User = require('./models/User');

const requestId = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const {
  generalLimiter
} = require('./middleware/rateLimiters');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const driverRoutes = require('./routes/drivers');
const paymentRoutesFactory = require('./routes/payments');
const adminRoutes = require('./routes/adminRoutes');
const tariffRoutes = require('./routes/tariffs');
const routeRoutes = require('./routes/routeRoutes');

const {
  getDriverRoomName
} = require('./utils/driverRooms');

require('./config/telegram');

const app = express();

if (config.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const server = http.createServer(app);

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = Array.isArray(
  config.CLIENT_ORIGINS
)
  ? config.CLIENT_ORIGINS
  : [];

const corsOriginCheck = (
  origin,
  callback
) => {
  /*
   * Allows requests without an Origin header.
   *
   * Examples:
   * - mobile applications
   * - Postman
   * - server-to-server requests
   */
  if (!origin) {
    return callback(null, true);
  }

  if (
    allowedOrigins.includes(origin)
  ) {
    return callback(null, true);
  }

  return callback(
    new Error(
      'Origin is not allowed by CORS policy.'
    )
  );
};

const corsOptions = {
  origin: corsOriginCheck,

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'X-Request-ID'
  ],

  maxAge: 86400
};

/* =========================================================
   SOCKET.IO
========================================================= */

const io = new Server(server, {
  cors: {
    origin: corsOriginCheck,

    credentials: true,

    methods: [
      'GET',
      'POST'
    ]
  },

  transports: [
    'websocket',
    'polling'
  ],

  pingTimeout: 60000,

  pingInterval: 25000
});

app.set('io', io);

/* =========================================================
   SOCKET AUTHENTICATION
========================================================= */

/*
 * Every socket connection must provide:

 * io(SOCKET_URL, {
 *   auth: {
 *     token: JWT_TOKEN
 *   }
 * });
 */
io.use(
  async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token;

      if (!token) {
        return next(
          new Error(
            'Socket authentication required.'
          )
        );
      }

      const decoded = jwt.verify(
        token,
        config.JWT_SECRET
      );

      const user =
        await User.findById(
          decoded.id
        ).select(
          '_id role isBlocked approvalStatus'
        );

      if (!user) {
        return next(
          new Error(
            'Socket user not found.'
          )
        );
      }

      if (user.isBlocked) {
        return next(
          new Error(
            'Socket access denied.'
          )
        );
      }

      socket.user = {
        id: String(user._id),

        role: user.role,

        approvalStatus:
          user.approvalStatus
      };

      return next();
    } catch (error) {
      return next(
        new Error(
          'Invalid socket authentication.'
        )
      );
    }
  }
);

/* =========================================================
   SECURITY & CORE MIDDLEWARE
========================================================= */

app.use(requestId);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

app.use(compression());

app.use(hpp());

app.use(
  cors(corsOptions)
);

app.options(
  '{*path}',
  cors(corsOptions)
);

app.use(
  express.json({
    limit:
      config.REQUEST_BODY_LIMIT ||
      '1mb'
  })
);

app.use(
  express.urlencoded({
    extended: false,

    limit:
      config.REQUEST_BODY_LIMIT ||
      '1mb'
  })
);

app.use(generalLimiter);

/* =========================================================
   SESSION STORE
========================================================= */

/*
 * JWT is used for API authentication.

 * Session is retained only for features that
 * explicitly require server-side session state.
 *
 * Never use a fallback secret in production.
 */
if (
  config.NODE_ENV === 'production' &&
  !config.SESSION_SECRET
) {
  throw new Error(
    'SESSION_SECRET is required in production.'
  );
}

const sessionStore =
  MongoStore.create({
    mongoUrl: config.MONGO_URI,

    collectionName:
      'sessions',

    ttl: Math.floor(
      (
        config.SESSION_TTL_MS ||
        86400000
      ) / 1000
    ),

    autoRemove:
      'native'
  });

app.use(
  session({
    name:
      config.SESSION_COOKIE_NAME ||
      'taxipay_sid',

    secret:
      config.SESSION_SECRET ||
      config.JWT_SECRET,

    resave: false,

    saveUninitialized: false,

    rolling: true,

    store: sessionStore,

    cookie: {
      httpOnly: true,

      secure:
        config.NODE_ENV ===
        'production',

      sameSite:
        config.NODE_ENV ===
          'production'
          ? 'none'
          : 'lax',

      maxAge:
        config.SESSION_TTL_MS ||
        86400000
    }
  })
);

/* =========================================================
   REQUEST SOCKET ACCESS
========================================================= */

app.use(
  (req, res, next) => {
    req.io = io;
    next();
  }
);

/* =========================================================
   UPLOADS
========================================================= */

const uploadsDir = path.join(
  __dirname,
  'uploads'
);

if (
  !fs.existsSync(uploadsDir)
) {
  fs.mkdirSync(
    uploadsDir,
    {
      recursive: true
    }
  );
}

/*
 * IMPORTANT:
 *
 * Public uploads should contain only files
 * intended to be public.
 *
 * Sensitive documents such as:
 * - driver IDs
 * - licenses
 * - identity documents
 *
 * should NOT be stored in this public folder.
 */
app.use(
  '/uploads',
  express.static(
    uploadsDir,
    {
      fallthrough: false,

      index: false,

      dotfiles: 'deny',

      maxAge:
        config.NODE_ENV ===
          'production'
          ? '1d'
          : 0
    }
  )
);

/* =========================================================
   HEALTH CHECKS
========================================================= */

app.get(
  '/health',
  (req, res) => {
    return res.status(200).json({
      success: true,

      status: 'UP',

      environment:
        config.NODE_ENV,

      timestamp:
        new Date().toISOString(),

      requestId:
        req.id
    });
  }
);

app.get(
  '/ready',
  (req, res) => {
    const isReady =
      mongoose.connection.readyState ===
      1;

    if (!isReady) {
      return res.status(503).json({
        success: false,

        status:
          'NOT_READY',

        databaseState:
          mongoose.connection.readyState
      });
    }

    return res.status(200).json({
      success: true,

      status: 'READY'
    });
  }
);

/* =========================================================
   API ROUTES
========================================================= */

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/users',
  userRoutes
);

app.use(
  '/api/drivers',
  driverRoutes
);

app.use(
  '/api/routes',
  routeRoutes
);

app.use(
  '/api/payments',
  paymentRoutesFactory(io)
);

app.use(
  '/api/admin',
  adminRoutes
);
app.use(
  '/api/tariffs',
  tariffRoutes
);
/* =========================================================
   ERROR HANDLING
========================================================= */

app.use(notFound);

app.use(errorHandler);

/* =========================================================
   SOCKET CONNECTION HANDLERS
========================================================= */

/*
 * Map:
 *
 * socket.id -> {
 *   userId,
 *   role
 * }
 */
const activeUsers = new Map();

const broadcastOnlineUsers = () => {
  const onlineUserIds = [
    ...new Set(
      [
        ...activeUsers.values()
      ].map(
        ({ userId }) =>
          String(userId)
      )
    )
  ];

  io.emit(
    'online_users_list',
    onlineUserIds
  );
};

io.on(
  'connection',
  (socket) => {
    const {
      id: userId,
      role
    } = socket.user;

    /*
     * User-specific room.
     *
     * Example:
     * user:64abc...
     */
    socket.join(
      `user:${userId}`
    );

    /*
     * Never trust a driver ID from the client.
     *
     * The authenticated socket user
     * determines the room.
     */
    if (
      role === 'driver'
    ) {
      const driverRoom = getDriverRoomName(userId);
      socket.join(driverRoom);
      console.log(`🚗 Driver connected: userId=${userId}, auto-joined room: [${driverRoom}], also in: [user:${userId}]`);
    }

    activeUsers.set(
      socket.id,
      {
        userId,
        role
      }
    );

    broadcastOnlineUsers();

    /*
     * Client can join a trip room.
     *
     * For stronger authorization,
     * verify trip ownership before joining.
     */
    socket.on(
      'join_trip',
      (tripId) => {
        if (
          typeof tripId !==
          'string'
        ) {
          return;
        }

        if (
          !mongoose.isValidObjectId(
            tripId
          )
        ) {
          return;
        }

        socket.join(
          `trip:${tripId}`
        );
      }
    );

    socket.on(
      'leave_trip',
      (tripId) => {
        if (
          typeof tripId !==
          'string'
        ) {
          return;
        }

        socket.leave(
          `trip:${tripId}`
        );
      }
    );

    /* Allow clients to subscribe to driver updates */
    socket.on('join_driver_room', (driverId) => {
      if (typeof driverId === 'string' && driverId.trim()) {
        const roomName = getDriverRoomName(driverId);
        socket.join(roomName);
        console.log(`📢 Socket ${socket.id} (user:${userId}) joined room: [${roomName}]`);
      } else {
        console.warn(`⚠️ Socket ${socket.id} tried to join driver room with non-string value:`, typeof driverId, driverId);
      }
    });

    socket.on('leave_driver_room', (driverId) => {
      if (typeof driverId === 'string' && driverId.trim()) {
        socket.leave(getDriverRoomName(driverId));
      }
    });

    /*
     * DO NOT allow:
     *
     * user_online
     * register_online_user
     * join_driver_room
     * leave_driver_room
     * update_seat_status
     *
     * The client cannot broadcast
     * authoritative payment or seat
     * state changes.
     *
     * Backend services/controllers
     * emit those events after a
     * successful database commit.
     */
     /* Driver location updates for admin fleet monitoring */
    if (role === 'driver') {
      socket.on('driver_location_update', (location) => {
        // location = { lat, lng, bearing, etc }
        io.emit('driver_location_changed', { driverId: userId, location, timestamp: Date.now() });
      });
    }

    socket.on(
      'disconnect',
      () => {
        activeUsers.delete(
          socket.id
        );

        broadcastOnlineUsers();
      }
    );
  }
);

/* =========================================================
   SERVER STARTUP
========================================================= */

const startServer = async () => {
  try {
    /*
     * Validate critical production
     * configuration before startup.
     */
    if (
      !config.MONGO_URI
    ) {
      throw new Error(
        'MONGO_URI is required.'
      );
    }

    if (
      !config.JWT_SECRET
    ) {
      throw new Error(
        'JWT_SECRET is required.'
      );
    }

    await connectDB();

    server.listen(
      config.PORT,
      () => {
        console.log(
          `🚀 TaxiPay server listening on port ${config.PORT}`
        );

        console.log(
          `🌍 Environment: ${config.NODE_ENV}`
        );
      }
    );
  } catch (error) {
    console.error(
      '❌ Server startup failed:',
      error
    );

    process.exit(1);
  }
};

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

let isShuttingDown = false;

const gracefulShutdown =
  async (signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    console.log(
      `🛑 ${signal} received. Starting graceful shutdown.`
    );

    const forceExitTimer =
      setTimeout(() => {
        console.error(
          '⚠️ Forced shutdown.'
        );

        process.exit(1);
      }, 15000);

    forceExitTimer.unref();

    try {
      /*
       * Stop accepting new HTTP requests.
       */
      await new Promise(
        (resolve, reject) => {
          server.close(
            (error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            }
          );
        }
      );

      /*
       * Close WebSocket connections.
       */
      io.close();

      /*
       * Close MongoDB.
       */
      await disconnectDB();

      clearTimeout(
        forceExitTimer
      );

      console.log(
        '✅ Graceful shutdown complete.'
      );

      process.exit(0);
    } catch (error) {
      console.error(
        '❌ Shutdown failed:',
        error
      );

      process.exit(1);
    }
  };

server.on(
  'error',
  (error) => {
    console.error(
      '❌ HTTP server error:',
      error
    );
  }
);

process.on(
  'SIGINT',
  () =>
    gracefulShutdown('SIGINT')
);

process.on(
  'SIGTERM',
  () =>
    gracefulShutdown('SIGTERM')
);

/*
 * Prevent unexpected promise failures
 * from silently leaving the process
 * in an inconsistent state.
 */
process.on(
  'unhandledRejection',
  (reason) => {
    console.error(
      '❌ Unhandled promise rejection:',
      reason
    );

    gracefulShutdown(
      'unhandledRejection'
    );
  }
);

process.on(
  'uncaughtException',
  (error) => {
    console.error(
      '❌ Uncaught exception:',
      error
    );

    process.exit(1);
  }
);

startServer();
