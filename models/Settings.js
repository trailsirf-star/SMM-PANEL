const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    // Singleton pattern: we always use { key: 'main' } to find/create the one settings doc.
    key: { type: String, default: 'main', unique: true },

    siteName: { type: String, default: 'MRFSMM' },

    paymentMethod: { type: String, default: 'EasyPaisa' },
    paymentMethodLabel: { type: String, default: 'EasyPaisa' },
    paymentMethodIcon: { type: String, default: 'easypaisa' },

    easypaisaNumber: { type: String, default: '03439898333' },
    easypaisaAccountName: { type: String, default: 'Nihayat Begum' },

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

  if (!settings.siteName) settings.siteName = 'MRFSMM';
  if (!settings.paymentMethod) settings.paymentMethod = 'EasyPaisa';
  if (!settings.paymentMethodLabel) settings.paymentMethodLabel = 'EasyPaisa';
  if (!settings.paymentMethodIcon) settings.paymentMethodIcon = 'easypaisa';
  if (!settings.easypaisaNumber) settings.easypaisaNumber = '03439898333';
  if (!settings.easypaisaAccountName) settings.easypaisaAccountName = 'Nihayat Begum';
  if (!settings.currency) settings.currency = 'PKR';
  if (!Number.isFinite(settings.minimumDeposit) || settings.minimumDeposit <= 0) {
    settings.minimumDeposit = 100;
  }
  if (!Number.isFinite(settings.exchangeRate) || settings.exchangeRate <= 0) {
    settings.exchangeRate = 280;
  }
  if (!Number.isFinite(settings.commissionPercent) || settings.commissionPercent < 0) {
    settings.commissionPercent = 30;
  }

  await settings.save();
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
