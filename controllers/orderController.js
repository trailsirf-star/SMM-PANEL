const Order = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const ProviderAPI = require('../services/providerApi');

exports.getNewOrder = async (req, res) => {
    const services = await Service.find({ status: 'active' }).populate('provider');
    res.render('new-order', { services });
};

exports.postNewOrder = async (req, res) => {
    const { serviceId, link, quantity } = req.body;
    try {
        const service = await Service.findById(serviceId).populate('provider');
        if (!service) throw new Error('Service not found');
        
        const qty = parseInt(quantity);
        if (qty < service.minOrder || qty > service.maxOrder) {
            throw new Error(`Quantity must be between ${service.minOrder} and ${service.maxOrder}`);
        }

        const charge = (service.sellPricePer1000 / 1000) * qty;
        const user = await User.findById(req.user._id);

        if (user.balance < charge) throw new Error('Insufficient balance');

        // Deduct balance
        user.balance -= charge;
        await user.save();

        // Create DB Order
        const order = await Order.create({
            user: user._id,
            service: service._id,
            provider: service.provider?._id,
            link,
            quantity: qty,
            charge,
            status: 'pending'
        });

        // Call Provider API
        if (service.provider && service.provider.isActive) {
            try {
                const api = new ProviderAPI(service.provider);
                const res = await api.placeOrder(service.providerServiceId, link, qty);
                order.providerOrderId = res.order;
                order.status = 'in progress';
                await order.save();
            } catch (apiErr) {
                // Refund user if API fails
                user.balance += charge;
                await user.save();
                order.status = 'cancelled';
                await order.save();
                throw new Error('Provider API Error. Order cancelled & refunded.');
            }
        }

        req.flash('success_msg', 'Order placed successfully');
        res.redirect('/orders');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/orders/new');
    }
};

exports.getMyOrders = async (req, res) => {
    const orders = await Order.find({ user: req.user._id }).populate('service').sort({ createdAt: -1 });
    res.render('orders', { orders });
};

exports.getOrderStatuses = async (req, res) => {
    const orders = await Order.find({ user: req.user._id }).select('status providerOrderId').lean();
    res.json(orders);
};