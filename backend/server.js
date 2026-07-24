const express = require('express');
const http = require('http'); // Native Node module
const { Server } = require('socket.io'); // Socket.io integration
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app); // Wrap express app
const io = new Server(server, {
    cors: {
        origin: "*", // In production, target your specific React domain
        methods: ["GET", "POST"]
    }
});

// FIXED: Changed fallback port to 5001 to match frontend requests
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(bodyParser.json());

// Attach Socket.io instance to the request lifecycle object
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxipay')
    .then(() => console.log("🔒 MongoDB connection established successfully."))
    .catch(err => console.error("❌ Database connection structural fault:", err));

// WebSocket Connection Hub
io.on('connection', (socket) => {
    console.log(`🔌 New client handshaking: ${socket.id}`);

    // Allow drivers to join an isolated "room" identified by their Driver/Vehicle ID
    socket.on('join_driver_room', (driverId) => {
        socket.join(driverId);
        console.log(`📡 Driver joined dedicated operational channel: ${driverId}`);
    });

    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// Connect Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tariffs', require('./routes/tariffs'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/payments', require('./routes/payments'));

server.listen(PORT, () => {
    console.log(`🚀 Taxi Pay MERN Cluster spinning on port ${PORT}`);
});