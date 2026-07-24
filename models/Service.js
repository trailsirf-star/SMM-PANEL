const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiProvider' },
    providerServiceId: { type: String, required: true },
    providerCostPer1000: { type: Number, default: 0 },
    sellPricePer1000: { type: Number, required: true },
    minOrder: { type: Number, default: 10 },
    maxOrder: { type: Number, default: 10000 },
    description: { type: String },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' }
});

module.exports = mongoose.model('Service', ServiceSchema);