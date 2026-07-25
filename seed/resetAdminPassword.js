require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Force-syncs the admin account to match ADMIN_EMAIL / ADMIN_PASSWORD from
 * the environment — creates the user if missing, or resets the password +
 * role + status on an existing one. Use this when login fails with
 * "Invalid email or password" even though the Railway variables look right;
 * unlike createAdmin.js, this ALWAYS resets the password, even if a user
 * with that email already exists.
 *
 * Run via Railway's Console/shell for the app service (not locally) so it
 * connects to the same MONGO_URI as production:
 *   node seed/resetAdminPassword.js
 */
async function run() {
  const { MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!MONGO_URI) {
    console.error('MONGO_URI is not set.');
    process.exit(1);
  }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('[Reset] Connected to MongoDB.');
  console.log(`[Reset] Using ADMIN_EMAIL="${ADMIN_EMAIL}" (length of password: ${ADMIN_PASSWORD.length} chars).`);

  const email = ADMIN_EMAIL.toLowerCase().trim();
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const existing = await User.findOne({ email });

  if (existing) {
    existing.password = hashedPassword;
    existing.role = 'admin';
    existing.status = 'active';
    await existing.save();
    console.log(`[Reset] Existing user "${email}" updated: password reset, role=admin, status=active.`);
  } else {
    await User.create({
      name: ADMIN_NAME || 'Administrator',
      email,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
    });
    console.log(`[Reset] New admin user "${email}" created.`);
  }

  await mongoose.disconnect();
  console.log('[Reset] Done. You should now be able to log in with ADMIN_EMAIL / ADMIN_PASSWORD.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[Reset] Failed:', err.message);
  process.exit(1);
});
