const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    // Singleton pattern: we always use { key: 'main' } to find/create the one settings doc.
    key: { type: String, default: 'main', unique: true },
    siteName: { type: String, default: 'SMM Panel' },
    easypaisaNumber: { type: String, default: '03439898333' },
    easypaisaAccountName: { type: String, default: 'Nihayat' },
    currency: { type: String, default: 'PKR' },
    whatsappNumber: { type: String, default: '' },
    minimumDeposit: { type: Number, default: 100 },
    exchangeRate: { type: Number, default: 280 },
    commissionPercent: { type: Number, default: 30 }, // your profit margin % applied over provider cost
  },
  { timestamps: true }
);

settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: 'main' });
  if (!settings) {
    settings = await this.create({ key: 'main' });
  }
  if (!Number.isFinite(settings.exchangeRate) || settings.exchangeRate <= 0) {
    settings.exchangeRate = 280;
    await settings.save();
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
