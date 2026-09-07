const mongoose = require('mongoose');

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxipay';

  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  await mongoose.connect(MONGO_URI);

  console.log('✅ MongoDB connected');
};

module.exports = connectDB;
