// seedAdmin.js
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function createAdmin() {
  await mongoose.connect(
    process.env.MONGO_URI || 'mongodb://localhost:27017/taxipay'
  );

  const existingAdmin = await User.findOne({
    phone: '+251900000000',
    role: 'admin'
  });

  if (existingAdmin) {
    console.log('⚠️ Admin user already exists. Skipping.');
    await mongoose.connection.close();
    return;
  }

  /*
   * Pass the plain-text password — the pre('save')
   * hook on the User schema handles bcrypt hashing.
   *
   * Do NOT set isAdmin (field does not exist in schema
   * and strict: 'throw' will reject it).
   */
  const admin = new User({
    name: 'System Admin',
    phone: '+251900000000',
    password: 'AdminSecret123!',
    role: 'admin',
    isVerified: true,
    approvalStatus: 'approved'
  });

  await admin.save();
  console.log('✅ Admin user created successfully!');
  console.log('   Phone: +251900000000');
  console.log('   Password: AdminSecret123!');
  console.log('   ⚠️  Change this password immediately in production.');
  await mongoose.connection.close();
}

createAdmin().catch((err) => {
  console.error('❌ Failed to create admin:', err.message);
  process.exit(1);
});