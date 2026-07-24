const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');

exports.getAddFunds = async (req, res) => {
    const settings = await Settings.findOne() || await Settings.create({});
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5);
    res.render('add-funds', { settings, transactions });
};

exports.postAddFunds = async (req, res) => {
    const { amount, transactionId } = req.body;
    const settings = await Settings.findOne() || await Settings.create({});
    
    if (parseFloat(amount) < settings.minimumDeposit) {
        req.flash('error_msg', `Minimum deposit is ${settings.minimumDeposit} ${settings.currency}`);
        return res.redirect('/funds/add');
    }

    if (!req.file) {
        req.flash('error_msg', 'Please upload payment screenshot');
        return res.redirect('/funds/add');
    }

    await Transaction.create({
        user: req.user._id,
        amount,
        transactionId,
        screenshotPath: `/uploads/${req.file.filename}`,
        status: 'pending'
    });

    req.flash('success_msg', 'Your payment is under review, balance will be added after admin approval');
    res.redirect('/funds/add');
};