require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

const createAdmin = async () => {
    try {
        await connectDB();
        const email = process.env.ADMIN_EMAIL || 'admin@smm.com';
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        
        const exists = await User.findOne({ email });
        if (exists) {
            console.log('Admin already exists');
            process.exit(0);
        }
        
        await User.create({
            name: 'Super Admin',
            email,
            password,
            role: 'admin',
            status: 'active'
        });
        
        console.log('Admin created successfully!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createAdmin();