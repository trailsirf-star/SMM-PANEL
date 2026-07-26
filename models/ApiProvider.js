const mongoose = require('mongoose');

const apiProviderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    apiUrl: { type: String, required: true, trim: true },
    apiKey: { type: String, required: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    lastSyncedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ApiProvider', apiProviderSchema);
