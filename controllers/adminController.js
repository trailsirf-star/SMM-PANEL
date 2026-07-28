const User = require('../models/User');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');
const ApiProvider = require('../models/ApiProvider');
const Settings = require('../models/Settings');
const providerApi = require('../services/providerApi');
const pricingService = require('../services/pricingService');
const fs = require('fs');
const path = require('path');

// Deletes an uploaded payment screenshot from disk after a final approve/reject
// decision has been saved, to save server storage. Failures are logged only —
// they must never block the approve/reject response.
function deleteScreenshotFile(screenshotPath) {
  if (!screenshotPath) return;
  const filePath = path.join(__dirname, '..', 'public', screenshotPath);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('[Admin] Failed to delete screenshot file:', err.message);
    }
  });
}

function parseNumeric(value, fallback = 0) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeServiceStatus(value) {
  if (value === undefined || value === null || value === '') return null;
  const status = String(value).toLowerCase().trim();
  if (['active', 'enabled', 'enable', 'true', '1'].includes(status)) return 'active';
  if (['disabled', 'disable', 'inactive', 'false', '0'].includes(status)) return 'disabled';
  return null;
}

// ---------- DASHBOARD ----------

exports.getDashboard = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // FIX: Only calculate revenue and profit for completed or partial orders
    const completedStatuses = ['completed', 'partial'];

    const [ordersToday, ordersThisMonth, ordersAllTime, revenueAgg, profitAgg, pendingPayments, newUsersToday, activeUsers, providers] =
      await Promise.all([
        Order.countDocuments({ createdAt: { $gte: startOfToday } }),
        Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
        Order.countDocuments({}),
        Order.aggregate([
          { $match: { status: { $in: completedStatuses } } },
          { $group: { _id: null, total: { $sum: '$charge' } } }
        ]),
        Order.aggregate([
          { $match: { status: { $in: completedStatuses } } },
          { $group: { _id: null, total: { $sum: { $subtract: ['$charge', '$providerCost'] } } } },
        ]),
        Transaction.countDocuments({ status: 'pending' }),
        User.countDocuments({ createdAt: { $gte: startOfToday } }),
        User.countDocuments({ status: 'active' }),
        ApiProvider.find({}),
      ]);

    const totalRevenue = revenueAgg[0]?.total || 0;
    const totalProfit = profitAgg[0]?.total || 0;

    const costAgg = await Order.aggregate([
      { $match: { status: { $in: completedStatuses } } },
      { $group: { _id: null, total: { $sum: '$providerCost' } } },
    ]);
    const totalProviderCost = costAgg[0]?.total || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyOrdersRaw = await Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const chartLabels = [];
    const chartData = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      chartLabels.push(key);
      const found = dailyOrdersRaw.find((r) => r._id === key);
      chartData.push(found ? found.count : 0);
    }

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        ordersToday,
        ordersThisMonth,
        ordersAllTime,
        totalRevenue,
        totalProfit,
        totalProviderCost,
        pendingPayments,
        newUsersToday,
        activeUsers,
      },
      providers,
      chartLabels: JSON.stringify(chartLabels),
      chartData: JSON.stringify(chartData),
    });
  } catch (err) {
    console.error('[Admin] Dashboard error:', err.message);
    res.status(500).send('Failed to load admin dashboard.');
  }
};

// ---------- ORDERS ----------

exports.getOrders = async (req, res) => {
  try {
    const { status, userQuery, serviceId, date } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (serviceId) filter.service = serviceId;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    let orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(300)
      .populate('user', 'name email')
      .populate('service', 'name category');

    if (userQuery) {
      const q = userQuery.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.user?.name?.toLowerCase().includes(q) || o.user?.email?.toLowerCase().includes(q)
      );
    }

    const services = await Service.find({}).select('name category');

    res.render('admin/orders', {
      title: 'Manage Orders',
      orders,
      services,
      filters: { status: status || '', userQuery: userQuery || '', serviceId: serviceId || '', date: date || '' },
    });
  } catch (err) {
    console.error('[Admin] Orders page error:', err.message);
    res.status(500).send('Failed to load orders.');
  }
};

exports.refreshOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate({
      path: 'service',
      populate: { path: 'provider' },
    });

    if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });
    if (!order.providerOrderId || !order.service?.provider) return res.status(400).json({ success: false, error: 'No linked provider.' });

    const result = await providerApi.getOrderStatus(
      { apiUrl: order.service.provider.apiUrl, apiKey: order.service.provider.apiKey },
      order.providerOrderId
    );

    const { normalizeStatus } = require('../services/orderSync');
    const normalized = normalizeStatus(result.status);

    if (normalized) order.status = normalized;
    order.remains = result.remains;
    order.startCount = result.start_count;
    order.lastCheckedAt = new Date();
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    console.error('[Admin] Refresh order status error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ---------- PAYMENTS ----------

exports.getPayments = async (req, res) => {
  try {
    const pending = await Transaction.find({ status: 'pending' }).sort({ createdAt: -1 }).populate('user', 'name email');
    const history = await Transaction.find({ status: { $ne: 'pending' } })
      .sort({ reviewedAt: -1 })
      .limit(100)
      .populate('user', 'name email');

    res.render('admin/payments', { title: 'Fund Requests', pending, history });
  } catch (err) {
    console.error('[Admin] Payments page error:', err.message);
    res.status(500).send('Failed to load payments.');
  }
};

exports.approvePayment = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx || tx.status !== 'pending') return res.status(400).json({ success: false, error: 'Invalid transaction.' });

    const user = await User.findById(tx.user);
    if (!user) return res.status(400).json({ success: false, error: 'Transaction user no longer exists.' });

    user.balance += tx.amount;
    await user.save();

    tx.status = 'approved';
    tx.reviewedAt = new Date();
    tx.reviewedBy = req.user._id;
    await tx.save();

    // Final decision recorded — the screenshot is no longer needed, so free the storage.
    deleteScreenshotFile(tx.screenshotPath);

    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Approve payment error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to approve payment.' });
  }
};

exports.rejectPayment = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const tx = await Transaction.findById(req.params.id);
    if (!tx || tx.status !== 'pending') return res.status(400).json({ success: false, error: 'Invalid transaction.' });

    tx.status = 'rejected';
    tx.adminNote = reason || 'No reason provided.';
    tx.reviewedAt = new Date();
    tx.reviewedBy = req.user._id;
    await tx.save();

    // Final decision recorded — the screenshot is no longer needed, so free the storage.
    deleteScreenshotFile(tx.screenshotPath);

    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Reject payment error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to reject payment.' });
  }
};

// ---------- USERS ----------

exports.getUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).select('-password');
    res.render('admin/users', { title: 'Manage Users', users, q: q || '' });
  } catch (err) {
    console.error('[Admin] Users page error:', err.message);
    res.status(500).send('Failed to load users.');
  }
};

exports.getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 }).populate('service', 'name');
    const transactions = await Transaction.find({ user: user._id }).sort({ createdAt: -1 });

    res.json({ success: true, user, orders, transactions });
  } catch (err) {
    console.error('[Admin] User detail error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load user detail.' });
  }
};

exports.adjustBalance = async (req, res) => {
  try {
    const { amount, reason } = req.body || {};
    const delta = parseFloat(amount);
    if (!delta) return res.status(400).json({ success: false, error: 'Amount is required.' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    user.balance = Math.max(0, user.balance + delta);
    await user.save();

    res.json({ success: true, balance: user.balance });
  } catch (err) {
    console.error('[Admin] Adjust balance error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to adjust balance.' });
  }
};

exports.toggleBan = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    user.status = user.status === 'banned' ? 'active' : 'banned';
    await user.save();

    res.json({ success: true, status: user.status });
  } catch (err) {
    console.error('[Admin] Toggle ban error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update user status.' });
  }
};

// ---------- SERVICES ----------

exports.getServices = async (req, res) => {
  try {
    const services = await Service.find({}).sort({ category: 1, name: 1 }).populate('provider', 'name');
    const providers = await ApiProvider.find({});
    const settings = await Settings.getSettings();

    res.render('admin/services', { title: 'Manage Services', services, providers, settings });
  } catch (err) {
    console.error('[Admin] Services page error:', err.message);
    res.status(500).send('Failed to load services.');
  }
};

exports.createService = async (req, res) => {
  try {
    const { name, category, providerServiceId, providerCostPer1000, sellPricePer1000, minOrder, maxOrder, description, providerId } = req.body || {};
    await Service.create({
      name,
      category,
      providerServiceId,
      providerCostPer1000: parseNumeric(providerCostPer1000, 0),
      sellPricePer1000: parseNumeric(sellPricePer1000, 0),
      minOrder: parseInt(minOrder, 10),
      maxOrder: parseInt(maxOrder, 10),
      description: description || '',
      provider: providerId || null,
    });
    res.redirect('/admin/services');
  } catch (err) {
    console.error('[Admin] Create service error:', err.message);
    res.status(500).send('Failed to create service.');
  }
};

exports.importServicesFromProvider = async (req, res) => {
  console.log("NEW IMPORT FUNCTION EXECUTED"); // TEMPORARY — remove after confirming
  try {
    const provider = await ApiProvider.findById(req.params.providerId);
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found.' });

    const settings = await Settings.getSettings();
    const providerServices = await providerApi.getServices({ apiUrl: provider.apiUrl, apiKey: provider.apiKey });

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const debugSamples = [];

    for (const ps of providerServices) {
      if (!ps || ps.service == null || !ps.name) {
        skipped += 1;
        continue;
      }

      const providerServiceId = String(ps.service).trim();
      const providerUsdRate = parseNumeric(ps.rate, NaN);
      if (!providerServiceId || !Number.isFinite(providerUsdRate) || providerUsdRate < 0) {
        skipped += 1;
        continue;
      }

      const importedStatus = normalizeServiceStatus(ps.status);
      const cost = pricingService.calculateProviderCost(providerUsdRate, settings.exchangeRate);
      console.log({ providerUsdRate, exchangeRate: settings.exchangeRate, calculatedCost: cost }); // TEMPORARY — remove after confirming
      const sellPrice = pricingService.calculateSellingPrice(cost, settings.commissionPercent);
      const existingServices = await Service.find({
        providerServiceId,
        $or: [{ provider: provider._id }, { provider: null }],
      });

      const updateData = {
        name: String(ps.name).trim(),
        category: String(ps.category || 'Other').trim(),
        providerCostPer1000: cost,
        sellPricePer1000: sellPrice,
        minOrder: parseInt(ps.min, 10) || 100,
        maxOrder: parseInt(ps.max, 10) || 10000,
        description: String(ps.type || '').trim(),
        provider: provider._id,
      };

      let savedService;
      if (existingServices.length > 0) {
        for (const existing of existingServices) {
          Object.assign(existing, updateData);
          if (importedStatus) existing.status = importedStatus;
          savedService = await existing.save();
          updated += 1;
        }
      } else {
        savedService = await Service.create({
          ...updateData,
          providerServiceId,
          status: importedStatus || 'disabled',
        });
        imported += 1;
      }

      if (debugSamples.length < 3) {
        debugSamples.push({
          provider: {
            service: providerServiceId,
            name: ps.name,
            usdRate: providerUsdRate,
            exchangeRate: settings.exchangeRate,
            rawPrice: ps.rawPrice,
            rawRate: ps.rawRate,
            rawCost: ps.rawCost,
            priceSource: ps.priceSource,
            min: ps.min,
            max: ps.max,
            status: ps.status,
          },
          database: {
            id: String(savedService._id),
            providerCostPer1000: savedService.providerCostPer1000,
            sellPricePer1000: savedService.sellPricePer1000,
            minOrder: savedService.minOrder,
            maxOrder: savedService.maxOrder,
            status: savedService.status,
          },
        });
      }
    }

    if (process.env.DEBUG_PROVIDER_SERVICES === 'true') {
      console.log('[Admin] import price verification samples:', JSON.stringify(debugSamples, null, 2));
    }

    res.json({ success: true, imported, updated, skipped, commissionPercent: settings.commissionPercent, samples: debugSamples });
  } catch (err) {
    console.error('[Admin] Import services error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.applyCommissionToServices = async (req, res) => {
  try {
    const { serviceIds } = req.body || {}; 
    const settings = await Settings.getSettings();

    const filter = Array.isArray(serviceIds) && serviceIds.length > 0 ? { _id: { $in: serviceIds } } : {};
    const services = await Service.find(filter);

    let updated = 0;
    for (const service of services) {
      // Apply commission to the exact provider cost stored in DB
      service.sellPricePer1000 = pricingService.calculateSellingPrice(service.providerCostPer1000, settings.commissionPercent);
      await service.save();
      updated += 1;
    }

    res.json({ success: true, updated, commissionPercent: settings.commissionPercent });
  } catch (err) {
    console.error('[Admin] Apply commission error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to apply commission.' });
  }
};

// RESTORED MISSING FUNCTIONS
exports.updateService = async (req, res) => {
  try {
    const { sellPricePer1000, minOrder, maxOrder, status } = req.body || {};
    const update = {};
    if (sellPricePer1000 !== undefined) update.sellPricePer1000 = parseNumeric(sellPricePer1000, 0);
    if (minOrder !== undefined) update.minOrder = parseInt(minOrder, 10);
    if (maxOrder !== undefined) update.maxOrder = parseInt(maxOrder, 10);
    if (status !== undefined && ['active', 'disabled'].includes(status)) update.status = status;

    await Service.findByIdAndUpdate(req.params.id, update);
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Update service error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update service.' });
  }
};

exports.deleteService = async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Delete service error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete service.' });
  }
};

exports.bulkUpdateServiceStatus = async (req, res) => {
  try {
    const { serviceIds, status, all } = req.body || {};

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    }

    let filter;
    if (all === true) {
      filter = {};
    } else {
      if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
        return res.status(400).json({ success: false, error: 'No services selected.' });
      }
      filter = { _id: { $in: serviceIds } };
    }

    const result = await Service.updateMany(filter, { $set: { status } });
    res.json({ success: true, updated: result.modifiedCount });
  } catch (err) {
    console.error('[Admin] Bulk update service status error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update services.' });
  }
};

// ---------- API PROVIDERS ----------

exports.getApiProviders = async (req, res) => {
  try {
    const providers = await ApiProvider.find({}).sort({ createdAt: -1 });
    res.render('admin/api-providers', { title: 'API Providers', providers });
  } catch (err) {
    console.error('[Admin] API providers page error:', err.message);
    res.status(500).send('Failed to load API providers.');
  }
};

exports.createApiProvider = async (req, res) => {
  try {
    const { name, apiUrl, apiKey } = req.body || {};
    await ApiProvider.create({ name, apiUrl, apiKey });
    res.redirect('/admin/api-providers');
  } catch (err) {
    console.error('[Admin] Create API provider error:', err.message);
    res.status(500).send('Failed to add API provider.');
  }
};

exports.testApiProviderConnection = async (req, res) => {
  try {
    const provider = await ApiProvider.findById(req.params.id);
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found.' });

    const result = await providerApi.getBalance({ apiUrl: provider.apiUrl, apiKey: provider.apiKey });

    provider.balance = result.balance;
    provider.currency = result.currency;
    provider.lastSyncedAt = new Date();
    await provider.save();

    res.json({ success: true, balance: result.balance, currency: result.currency });
  } catch (err) {
    console.error('[Admin] Provider connection failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.toggleApiProviderActive = async (req, res) => {
  try {
    const provider = await ApiProvider.findById(req.params.id);
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found.' });

    provider.isActive = !provider.isActive;
    await provider.save();

    res.json({ success: true, isActive: provider.isActive });
  } catch (err) {
    console.error('[Admin] Toggle provider active error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update provider.' });
  }
};

exports.deleteApiProvider = async (req, res) => {
  try {
    await ApiProvider.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Delete API provider error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete provider.' });
  }
};

// ---------- SETTINGS ----------

exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.render('admin/settings', { title: 'Site Settings', settings, message: null });
  } catch (err) {
    console.error('[Admin] Settings page error:', err.message);
    res.status(500).send('Failed to load settings.');
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { siteName, easypaisaNumber, easypaisaAccountName, currency, whatsappNumber, minimumDeposit, exchangeRate, commissionPercent, binanceId, binancePayLabel } = req.body || {};

    const settings = await Settings.getSettings();
    settings.siteName = siteName;
    settings.easypaisaNumber = easypaisaNumber;
    settings.easypaisaAccountName = easypaisaAccountName;
    // Binance — read & save exactly like the Easypaisa fields above
    settings.binanceId = binanceId || '';
    settings.binancePayLabel = binancePayLabel || 'Binance Pay ID';
    settings.currency = currency;
    settings.whatsappNumber = whatsappNumber;
    settings.minimumDeposit = parseNumeric(minimumDeposit, 0);
    const parsedExchangeRate = parseNumeric(exchangeRate, 280);
    settings.exchangeRate = parsedExchangeRate > 0 ? parsedExchangeRate : 280;
    settings.commissionPercent = parseNumeric(commissionPercent, 0);
    await settings.save();

    res.render('admin/settings', { title: 'Site Settings', settings, message: 'Settings updated successfully.' });
  } catch (err) {
    console.error('[Admin] Update settings error:', err.message);
    res.status(500).send('Failed to update settings.');
  }
};
