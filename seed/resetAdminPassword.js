require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Hardcoded on purpose — this bypasses ADMIN_EMAIL / ADMIN_PASSWORD entirely
// so there's no ambiguity about whether Railway's env vars are being read.
const FIXED_EMAIL = 'admin@smm.com';
const FIXED_PASSWORD = '123123';

/**
 * Force-syncs the admin account to FIXED_EMAIL / FIXED_PASSWORD above —
 * creates the user if missing, or resets password + role + status if it
 * already exists.
 *
 * Run via Railway's Console/shell for the app service (not locally) so it
 * connects to the same MONGO_URI as production:
 *   node seed/resetAdminPassword.js
 */
async function run() {
  const { MONGO_URI } = process.env;

  if (!MONGO_URI) {
    console.error('MONGO_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('[Reset] Connected to MongoDB.');
  console.log(`[Reset] Using hardcoded email="${FIXED_EMAIL}" password="${FIXED_PASSWORD}".`);

  const email = FIXED_EMAIL.toLowerCase().trim();
  const hashedPassword = await bcrypt.hash(FIXED_PASSWORD, 12);

  const existing = await User.findOne({ email });

  if (existing) {
    existing.password = hashedPassword;
    existing.role = 'admin';
    existing.status = 'active';
    await existing.save();
    console.log(`[Reset] Existing user "${email}" updated: password reset, role=admin, status=active.`);
  } else {
    await User.create({
      name: 'Administrator',
      email,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
    });
    console.log(`[Reset] New admin user "${email}" created.`);
  }

  // Sanity check — immediately re-fetch and verify the new password actually matches.
  const check = await User.findOne({ email });
  const matches = await bcrypt.compare(FIXED_PASSWORD, check.password);
  console.log(`[Reset] Verification: bcrypt.compare(FIXED_PASSWORD, savedHash) = ${matches}`);
  console.log(`[Reset] Saved user role="${check.role}" status="${check.status}"`);

  await mongoose.disconnect();
  console.log('[Reset] Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[Reset] Failed:', err.message);
  process.exit(1);
});
