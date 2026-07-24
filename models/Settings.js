const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    siteName: { type: String, default: 'SMM Panel Pro' },
    easypaisaNumber: { type: String, default: '03001234567' },
    easypaisaAccountName: { type: String, default: 'John Doe' },
    currency: { type: String, default: 'PKR' },
    whatsappNumber: { type: String, default: '03001234567' },
    minimumDeposit: { type: Number, default: 100 }
});

module.exports = mongoose.model('Settings', SettingsSchema);