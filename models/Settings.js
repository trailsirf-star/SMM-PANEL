const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    // Singleton pattern: we always use { key: 'main' } to find/create the one settings doc.
    key: { type: String, default: 'main', unique: true },
    siteName: { type: String, default: 'SMM Panel' },
    easypaisaNumber: { type: String, default: '' },
    easypaisaAccountName: { type: String, default: '' },
    currency: { type: String, default: 'PKR' },
    whatsappNumber: { type: String, default: '' },
    minimumDeposit: { type: Number, default: 100 },
  },
  { timestamps: true }
);

settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: 'main' });
  if (!settings) {
    settings = await this.create({ key: 'main' });
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
