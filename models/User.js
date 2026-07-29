const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true, default: '' },
    password: {
      type: String,
      required: function () {
        // Password is only required for normal email/password accounts.
        // Google-authenticated users (googleId set) never set a password.
        return !this.googleId;
      },
    },
    googleId: { type: String, default: null, index: true },
    balance: { type: Number, default: 0, min: 0 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    apiKey: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(20).toString('hex'),
    },
    status: { type: String, enum: ['active', 'banned'], default: 'active' },
  },
  { timestamps: true }
);

userSchema.methods.regenerateApiKey = function () {
  this.apiKey = crypto.randomBytes(20).toString('hex');
  return this.apiKey;
};

module.exports = mongoose.model('User', userSchema);
