const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');

exports.getAddFundsPage = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const recent = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10);

    res.render('add-funds', {
      title: 'Add Funds',
      settings,
      recent,
      message: null,
      error: null,
    });
  } catch (err) {
    console.error('[Funds] Add funds page error:', err.message);
    res.status(500).send('Failed to load add funds page.');
  }
};

exports.postAddFunds = async (req, res) => {
  const settings = await Settings.getSettings();
  const recent = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10);

  try {
    const { amount, transactionId } = req.body;
    const amt = parseFloat(amount);

    if (!req.file) {
      return res.status(400).render('add-funds', {
        title: 'Add Funds',
        settings,
        recent,
        message: null,
        error: 'Please upload a screenshot of your payment.',
      });
    }

    if (!amt || amt < settings.minimumDeposit) {
      return res.status(400).render('add-funds', {
        title: 'Add Funds',
        settings,
        recent,
        message: null,
        error: `Minimum deposit is ${settings.minimumDeposit} ${settings.currency}.`,
      });
    }

    if (!transactionId || !transactionId.trim()) {
      return res.status(400).render('add-funds', {
        title: 'Add Funds',
        settings,
        recent,
        message: null,
        error: 'Please enter your Easypaisa transaction ID (TRX ID).',
      });
    }

    await Transaction.create({
      user: req.user._id,
      amount: amt,
      transactionId: transactionId.trim(),
      screenshotPath: `/uploads/${req.file.filename}`,
      status: 'pending',
    });

    const updatedRecent = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10);

    res.render('add-funds', {
      title: 'Add Funds',
      settings,
      recent: updatedRecent,
      message: 'Your payment is under review, balance will be added after admin approval.',
      error: null,
    });
  } catch (err) {
    console.error('[Funds] Add funds submit error:', err.message);
    res.status(500).render('add-funds', {
      title: 'Add Funds',
      settings,
      recent,
      message: null,
      error: err.message || 'Something went wrong. Please try again.',
    });
  }
};
