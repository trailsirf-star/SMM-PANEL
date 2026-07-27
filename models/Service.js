const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true }, // Instagram, TikTok, YouTube, Facebook, etc.
    providerServiceId: { type: String, required: true }, // id of this service on the external provider
    providerCostPer1000: { type: Number, required: true, min: 0 }, // what WE pay
    sellPricePer1000: { type: Number, required: true, min: 0 }, // what USER pays
    minOrder: { type: Number, required: true, min: 1, default: 100 },
    maxOrder: { type: Number, required: true, min: 1, default: 10000 },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiProvider' },
  },
  { timestamps: true }
);

serviceSchema.virtual('profitMarginPer1000').get(function () {
  return this.sellPricePer1000 - this.providerCostPer1000;
});

serviceSchema.set('toJSON', { virtuals: true });
serviceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Service', serviceSchema);
