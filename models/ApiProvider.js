const mongoose = require('mongoose');

const ApiProviderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    apiUrl: { type: String, required: true },
    apiKey: { type: String, required: true },
    balance: { type: Number, default: 0 },
    lastSyncedAt: { type: Date },
    isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('ApiProvider', ApiProviderSchema);