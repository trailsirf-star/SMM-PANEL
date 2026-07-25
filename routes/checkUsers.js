require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({
    email: 'admin@smm.com'
  });

  if (!user) {
    console.log('Admin user not found.');
    return;
  }

  console.log('Email:', user.email);
  console.log('Role:', user.role);
  console.log('Status:', user.status);

  const match = await bcrypt.compare('123123', user.password);

  console.log('Password Match:', match);

  await mongoose.disconnect();
}

run().catch(console.error);
