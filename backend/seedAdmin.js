// seedAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust path if needed
require('dotenv').config();

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/taxipay');

  const hashedPassword = await bcrypt.hash('AdminSecret123!', 10);

  const admin = new User({
    name: 'System Admin',
    phone: '0900000000',
    password: hashedPassword,
    role: 'admin',
    isAdmin: true,
    approvalStatus: 'approved'
  });

  await admin.save();
  console.log('✅ Admin user created successfully!');
  mongoose.connection.close();
}

createAdmin().catch(console.error);