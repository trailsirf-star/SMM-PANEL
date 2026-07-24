const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Service = require('../models/Service');
const Order = require('../models/Order');
const ProviderAPI = require('../services/providerApi');

// Middleware to validate API Key
const apiKeyAuth = async (req, res, next) => {
    const key = req.body.key || req.query.key;
    if (!key) return res.status(401).json({ error: 'API Key required' });
    const user = await User.findOne({ apiKey: key });
    if (!user) return res.status(401).json({ error: 'Invalid API Key' });
    req.user = user;
    next();
};

router.post('/', apiKeyAuth, async (req, res) => {
    const action = req.body.action;
    
    try {
        if (action === 'balance') {
            return res.json({ balance: req.user.balance, currency: 'PKR' });
        }
        
        if (action === 'services') {
            const services = await Service.find({ status: 'active' });
            return res.json(services);
        }
        
        if (action === 'add') {
            const { service, link, quantity } = req.body;
            const svc = await Service.findById(service).populate('provider');
            if (!svc) return res.status(400).json({ error: 'Service not found' });
            
            const charge = (svc.sellPricePer1000 / 1000) * quantity;
            if (req.user.balance < charge) return res.status(400).json({ error: 'Insufficient balance' });
            
            const user = await User.findById(req.user._id);
            user.balance -= charge;
            await user.save();
            
            const order = await Order.create({
                user: user._id, service: svc._id, provider: svc.provider?._id,
                link, quantity, charge, status: 'pending'
            });
            
            if (svc.provider) {
                const api = new ProviderAPI(svc.provider);
                const r = await api.placeOrder(svc.providerServiceId, link, quantity);
                order.providerOrderId = r.order;
                order.status = 'in progress';
                await order.save();
            }
            
            return res.json({ order: order._id, status: order.status });
        }
        
        if (action === 'status') {
            const order = await Order.findById(req.body.order);
            if (!order || order.user.toString() !== req.user._id.toString()) {
                return res.status(404).json({ error: 'Order not found' });
            }
            return res.json({ status: order.status, start_count: order.startCount, remains: order.remains });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

module.exports = router;