const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiProvider' },
    link: { type: String, required: true },
    quantity: { type: Number, required: true },
    charge: { type: Number, required: true },
    providerOrderId: { type: String },
    status: { 
        type: String, 
        enum: ['pending', 'processing', 'in progress', 'completed', 'partial', 'cancelled', 'refunded'],
        default: 'pending'
    },
    startCount: { type: Number, default: 0 },
    remains: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    lastCheckedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);