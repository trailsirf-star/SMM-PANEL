const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    link: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    charge: { type: Number, required: true, min: 0 }, // amount deducted from user
    providerCost: { type: Number, default: 0 }, // what it cost us (for profit reporting)
    providerOrderId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'in progress', 'completed', 'partial', 'cancelled', 'refunded'],
      default: 'pending',
      index: true,
    },
    startCount: { type: Number, default: 0 },
    remains: { type: Number, default: 0 },
    lastCheckedAt: { type: Date, default: null },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
