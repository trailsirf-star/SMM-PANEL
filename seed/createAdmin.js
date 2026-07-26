require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function run() {
  const { MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!MONGO_URI) {
    console.error('MONGO_URI is not set in your .env file.');
    process.exit(1);
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in your .env file.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('[Seed] Connected to MongoDB.');

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });

  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`[Seed] Existing user ${ADMIN_EMAIL} promoted to admin.`);
    } else {
      console.log(`[Seed] Admin account ${ADMIN_EMAIL} already exists. Nothing to do.`);
    }
    await mongoose.disconnect();
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await User.create({
    name: ADMIN_NAME || 'Administrator',
    email: ADMIN_EMAIL.toLowerCase(),
    password: hashedPassword,
    role: 'admin',
    status: 'active',
  });

  console.log(`[Seed] Admin account created: ${ADMIN_EMAIL}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[Seed] Failed:', err.message);
  process.exit(1);
});
