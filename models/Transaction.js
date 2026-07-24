const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    method: { type: String, default: 'Easypaisa' },
    transactionId: { type: String, required: true },
    screenshotPath: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNote: { type: String },
    createdAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date }
});

module.exports = mongoose.model('Transaction', TransactionSchema);