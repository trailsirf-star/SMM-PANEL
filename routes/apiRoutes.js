const express = require('express');
const User = require('../models/User');
const Service = require('../models/Service');
const Order = require('../models/Order');
const providerApi = require('../services/providerApi');
const { protect } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const router = express.Router();

// ---------------------------------------------------------------------------
// Internal endpoint: polled by AJAX from the logged-in user's My Orders page.
// GET /api/orders/status
// ---------------------------------------------------------------------------
router.get('/orders/status', protect, orderController.getOrdersStatusJson);

// ---------------------------------------------------------------------------
// PUBLIC RESELLER API — /api/v2
//
// Mimics the same standard action-based format used by SMM providers
// (POST with `key` + `action`), so that other people can resell FROM this
// panel exactly the same way this panel resells from its own provider(s).
// Authenticated via the calling user's own `apiKey` field.
// ---------------------------------------------------------------------------

async function authenticateApiKey(req, res, next) {
  const key = req.body.key || req.query.key;

  if (!key) {
    return res.json({ error: 'Missing key parameter.' });
  }

  const user = await User.findOne({ apiKey: key });

  if (!user) {
    return res.json({ error: 'Invalid API key.' });
  }

  if (user.status === 'banned') {
    return res.json({ error: 'Account is banned.' });
  }

  req.apiUser = user;
  next();
}

router.post('/v2', authenticateApiKey, async (req, res) => {
  const { action } = req.body;

  try {
    switch (action) {
      case 'services':
        return await handleServices(req, res);
      case 'add':
        return await handleAdd(req, res);
      case 'status':
        return await handleStatus(req, res);
      case 'balance':
        return await handleBalance(req, res);
      default:
        return res.json({ error: 'Incorrect action.' });
    }
  } catch (err) {
    console.error('[API v2] Error:', err.message);
    return res.json({ error: 'Internal error processing request.' });
  }
});

async function handleServices(req, res) {
  const services = await Service.find({ status: 'active' }).select(
    'name category sellPricePer1000 minOrder maxOrder description'
  );

  const formatted = services.map((s) => ({
    service: String(s._id),
    name: s.name,
    category: s.category,
    rate: s.sellPricePer1000.toFixed(4),
    min: s.minOrder,
    max: s.maxOrder,
    type: 'Default',
  }));

  res.json(formatted);
}

async function handleAdd(req, res) {
  const { service: serviceId, link, quantity } = req.body;
  const qty = parseInt(quantity, 10);

  const service = await Service.findById(serviceId).populate('provider');

  if (!service || service.status !== 'active') {
    return res.json({ error: 'Service not found.' });
  }

  if (!link) {
    return res.json({ error: 'Link parameter is required.' });
  }

  if (!qty || qty < service.minOrder || qty > service.maxOrder) {
    return res.json({ error: `Quantity must be between ${service.minOrder} and ${service.maxOrder}.` });
  }

  const charge = Math.ceil((service.sellPricePer1000 / 1000) * qty * 100) / 100;
  const providerCost = Math.ceil((service.providerCostPer1000 / 1000) * qty * 100) / 100;

  const user = req.apiUser;

  if (user.balance < charge) {
    return res.json({ error: 'Not enough funds.' });
  }

  user.balance -= charge;
  await user.save();

  const order = await Order.create({
    user: user._id,
    service: service._id,
    link,
    quantity: qty,
    charge,
    providerCost,
    status: 'pending',
  });

  if (service.provider && service.provider.isActive) {
    try {
      const { order: providerOrderId } = await providerApi.placeOrder(
        { apiUrl: service.provider.apiUrl, apiKey: service.provider.apiKey },
        { service: service.providerServiceId, link, quantity: qty }
      );
      order.providerOrderId = providerOrderId;
      order.status = 'processing';
      await order.save();
    } catch (err) {
      user.balance += charge;
      await user.save();
      order.status = 'cancelled';
      order.errorMessage = err.message;
      await order.save();
      return res.json({ error: 'Failed to place order with upstream provider.' });
    }
  }

  res.json({ order: String(order._id) });
}

async function handleStatus(req, res) {
  const { order: orderId, orders: orderIds } = req.body;

  if (orderIds) {
    const ids = orderIds.split(',').map((s) => s.trim());
    const found = await Order.find({ _id: { $in: ids }, user: req.apiUser._id });

    const result = {};
    for (const o of found) {
      result[String(o._id)] = {
        charge: o.charge.toFixed(2),
        start_count: o.startCount,
        status: o.status,
        remains: o.remains,
      };
    }
    return res.json(result);
  }

  const order = await Order.findOne({ _id: orderId, user: req.apiUser._id });

  if (!order) {
    return res.json({ error: 'Order not found.' });
  }

  res.json({
    charge: order.charge.toFixed(2),
    start_count: order.startCount,
    status: order.status,
    remains: order.remains,
  });
}

async function handleBalance(req, res) {
  res.json({ balance: req.apiUser.balance.toFixed(2), currency: 'PKR' });
}

module.exports = router;
