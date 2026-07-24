const User = require('../models/User');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');
const ApiProvider = require('../models/ApiProvider');
const Settings = require('../models/Settings');
const ProviderAPI = require('../services/providerApi');

exports.getDashboard = async (req, res) => {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const totalOrders = await Order.countDocuments();
    const pendingTxns = await Transaction.countDocuments({ status: 'pending' });
    
    const revenueAgg = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$charge" } } }]);
    const revenue = revenueAgg[0]?.total || 0;

    res.render('admin/dashboard', { totalUsers, activeUsers, totalOrders, pendingTxns, revenue });
};

exports.getOrders = async (req, res) => {
    const orders = await Order.find().populate('user').populate('service').sort({ createdAt: -1 });
    res.render('admin/orders', { orders });
};

exports.getPayments = async (req, res) => {
    const pendingTxns = await Transaction.find({ status: 'pending' }).populate('user').sort({ createdAt: -1 });
    const reviewedTxns = await Transaction.find({ status: { $ne: 'pending' } }).populate('user').sort({ createdAt: -1 }).limit(50);
    res.render('admin/payments', { pendingTxns, reviewedTxns });
};

exports.approvePayment = async (req, res) => {
    const txn = await Transaction.findById(req.params.id);
    if (!txn || txn.status !== 'pending') {
        req.flash('error_msg', 'Invalid transaction');
        return res.redirect('/admin/payments');
    }
    const user = await User.findById(txn.user);
    user.balance += txn.amount;
    await user.save();

    txn.status = 'approved';
    txn.reviewedAt = new Date();
    await txn.save();

    req.flash('success_msg', 'Payment approved & balance added');
    res.redirect('/admin/payments');
};

exports.rejectPayment = async (req, res) => {
    const { reason } = req.body;
    const txn = await Transaction.findById(req.params.id);
    if (!txn) {
        req.flash('error_msg', 'Invalid transaction');
        return res.redirect('/admin/payments');
    }
    txn.status = 'rejected';
    txn.adminNote = reason;
    txn.reviewedAt = new Date();
    await txn.save();

    req.flash('success_msg', 'Payment rejected');
    res.redirect('/admin/payments');
};

exports.getUsers = async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    res.render('admin/users', { users });
};

exports.adjustBalance = async (req, res) => {
    const { amount, action } = req.body;
    const user = await User.findById(req.params.id);
    const amt = parseFloat(amount);
    if (action === 'add') user.balance += amt;
    else user.balance -= amt;
    await user.save();
    req.flash('success_msg', 'Balance updated');
    res.redirect('/admin/users');
};

exports.toggleBanUser = async (req, res) => {
    const user = await User.findById(req.params.id);
    user.status = user.status === 'active' ? 'banned' : 'active';
    await user.save();
    req.flash('success_msg', 'User status updated');
    res.redirect('/admin/users');
};

exports.getServices = async (req, res) => {
    const services = await Service.find().populate('provider').sort({ category: 1 });
    res.render('admin/services', { services });
};

exports.getApiProviders = async (req, res) => {
    const providers = await ApiProvider.find();
    res.render('admin/api-providers', { providers });
};

exports.addProvider = async (req, res) => {
    const { name, apiUrl, apiKey } = req.body;
    await ApiProvider.create({ name, apiUrl, apiKey });
    req.flash('success_msg', 'Provider added');
    res.redirect('/admin/api-providers');
};

exports.testProvider = async (req, res) => {
    const provider = await ApiProvider.findById(req.params.id);
    try {
        const api = new ProviderAPI(provider);
        const bal = await api.getBalance();
        provider.balance = bal.balance;
        provider.lastSyncedAt = new Date();
        await provider.save();
        req.flash('success_msg', `Connection successful! Balance: ${bal.balance}`);
    } catch (e) {
        req.flash('error_msg', 'Connection failed: ' + e.message);
    }
    res.redirect('/admin/api-providers');
};

exports.importServices = async (req, res) => {
    const provider = await ApiProvider.findById(req.params.id);
    try {
        const api = new ProviderAPI(provider);
        const services = await api.getServices();
        let count = 0;
        for (const s of services) {
            const exists = await Service.findOne({ providerServiceId: s.service, provider: provider._id });
            if (!exists) {
                await Service.create({
                    name: s.name,
                    category: s.category || 'General',
                    provider: provider._id,
                    providerServiceId: s.service,
                    providerCostPer1000: parseFloat(s.rate),
                    sellPricePer1000: parseFloat(s.rate) * 1.5, // 50% markup default
                    minOrder: parseInt(s.min),
                    maxOrder: parseInt(s.max)
                });
                count++;
            }
        }
        req.flash('success_msg', `${count} services imported`);
    } catch (e) {
        req.flash('error_msg', 'Import failed: ' + e.message);
    }
    res.redirect('/admin/services');
};

exports.getSettings = async (req, res) => {
    const settings = await Settings.findOne() || await Settings.create({});
    res.render('admin/settings', { settings });
};

exports.updateSettings = async (req, res) => {
    const update = req.body;
    await Settings.findOneAndUpdate({}, update, { upsert: true, new: true });
    req.flash('success_msg', 'Settings updated');
    res.redirect('/admin/settings');
};