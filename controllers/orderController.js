const Service = require('../models/Service');
const Order = require('../models/Order');
const User = require('../models/User');
const providerApi = require('../services/providerApi');
const Settings = require('../models/Settings');
const pricingService = require('../services/pricingService');

exports.getNewOrderPage = async (req, res) => {
  try {
    const services = await Service.find({ status: 'active' }).sort({ category: 1, name: 1 });
    const settings = await Settings.getSettings();
    res.render('new-order', { title: 'New Order', services, settings, error: null });
  } catch (err) {
    console.error('[Order] New order page error:', err.message);
    res.status(500).send('Failed to load order page.');
  }
};

exports.createOrder = async (req, res) => {
  const { serviceId, link, quantity } = req.body;
  const qty = parseInt(quantity, 10);

  try {
    const service = await Service.findById(serviceId).populate('provider');

    if (!service || service.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Selected service is not available.' });
    }

    if (!link || !link.trim()) {
      return res.status(400).json({ success: false, error: 'Link is required.' });
    }

    if (!qty || qty < service.minOrder || qty > service.maxOrder) {
      return res.status(400).json({
        success: false,
        error: `Quantity must be between ${service.minOrder} and ${service.maxOrder}.`,
      });
    }

    const charge = pricingService.calculateSellingPrice((service.sellPricePer1000 / 1000) * qty, 0);

    const user = await User.findById(req.user._id);

    if (user.balance < charge) {
      return res.status(400).json({ success: false, error: 'Insufficient balance. Please add funds.' });
    }

    // Deduct balance first, then attempt to place the order with the provider.
    user.balance -= charge;
    await user.save();

    const order = await Order.create({
      user: user._id,
      service: service._id,
      link: link.trim(),
      quantity: qty,
      charge,
      status: 'pending',
    });

    if (service.provider && service.provider.isActive) {
      try {
        const { order: providerOrderId } = await providerApi.placeOrder(
          { apiUrl: service.provider.apiUrl, apiKey: service.provider.apiKey },
          { service: service.providerServiceId, link: link.trim(), quantity: qty }
        );

        order.providerOrderId = providerOrderId;
        order.status = 'processing';
        await order.save();
      } catch (err) {
        console.error('[Order] Provider placeOrder failed:', err.message);
        // Refund the user since the provider rejected/failed the order.
        user.balance += charge;
        await user.save();
        order.status = 'cancelled';
        order.errorMessage = err.message;
        await order.save();

        return res.status(502).json({
          success: false,
          error: 'Failed to place order with the provider. You have been refunded.',
        });
      }
    }

    res.json({ success: true, order });
  } catch (err) {
    console.error('[Order] Create order error:', err.message);
    res.status(500).json({ success: false, error: 'Something went wrong placing your order.' });
  }
};

exports.getOrdersPage = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('service');

    res.render('orders', { title: 'My Orders', orders });
  } catch (err) {
    console.error('[Order] Orders page error:', err.message);
    res.status(500).send('Failed to load orders.');
  }
};

// Lightweight JSON endpoint polled by AJAX on the My Orders page.
exports.getOrdersStatusJson = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('_id status remains startCount quantity lastCheckedAt')
      .lean();

    res.json({ success: true, orders });
  } catch (err) {
    console.error('[Order] Orders status JSON error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch order statuses.' });
  }
};
