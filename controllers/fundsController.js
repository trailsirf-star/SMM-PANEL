const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');

exports.getAddFundsPage = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const recent = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10);

    // Messages are passed via query params (redirect-after-POST) instead of being
    // rendered directly from the POST handler, so refreshing this page only ever
    // re-runs this safe GET request and can never re-submit a payment.
    const successMsg = req.query.success
      ? 'Your payment is under review, balance will be added after admin approval.'
      : null;
    const errorMsg = req.query.error || null;

    res.render('add-funds', {
      title: 'Add Funds',
      settings,
      recent,
      message: successMsg,
      error: errorMsg,
    });
  } catch (err) {
    console.error('[Funds] Add funds page error:', err.message);
    res.status(500).send('Failed to load add funds page.');
  }
};

exports.postAddFunds = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const { amount } = req.body;
    const amt = parseFloat(amount);

    if (!req.file) {
      return res.redirect('/add-funds?error=' + encodeURIComponent('Please upload a screenshot of your payment.'));
    }

    if (!amt || amt < settings.minimumDeposit) {
      return res.redirect(
        '/add-funds?error=' +
          encodeURIComponent(`Minimum deposit is ${settings.minimumDeposit} ${settings.currency}.`)
      );
    }

    // A Transaction (and therefore a Pending payment) is created ONLY here,
    // in direct response to a genuine form submission — never on page load/refresh.
    await Transaction.create({
      user: req.user._id,
      amount: amt,
      screenshotPath: `/uploads/${req.file.filename}`,
      status: 'pending',
    });

    // Redirect (PRG pattern) instead of re-rendering: this is what prevents a
    // browser refresh of the result page from resubmitting the form and
    // creating a duplicate Pending payment.
    res.redirect('/add-funds?success=1');
  } catch (err) {
    console.error('[Funds] Add funds submit error:', err.message);
    res.redirect('/add-funds?error=' + encodeURIComponent(err.message || 'Something went wrong. Please try again.'));
  }
};
