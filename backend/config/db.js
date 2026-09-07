'use strict';

const mongoose = require('mongoose');
const config = require('./env');

mongoose.set('strictQuery', true);

const connectDB = async () => {
  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected');
  });

  mongoose.connection.on('error', (error) => {
    console.error(
      '❌ MongoDB connection error:',
      error.message
    );
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
  });

  await mongoose.connect(config.MONGO_URI, {
    maxPoolSize: config.MONGO_MAX_POOL_SIZE,
    minPoolSize: config.MONGO_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    retryWrites: true
  });

  await mongoose.connection.db.admin().ping();

  return mongoose.connection;
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

module.exports = {
  connectDB,
  disconnectDB
};