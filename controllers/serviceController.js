const Service = require('../models/Service');
const Order = require('../models/Order');
const Settings = require('../models/Settings');

exports.getDashboard = async (req, res) => {
  try {
    const [totalOrders, completedOrders, orders] = await Promise.all([
      Order.countDocuments({ user: req.user._id }),
      Order.countDocuments({ user: req.user._id, status: 'completed' }),
      Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5).populate('service'),
    ]);

    const spentAgg = await Order.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: null, total: { $sum: '$charge' } } },
    ]);
    const totalSpent = spentAgg[0]?.total || 0;

    const settings = await Settings.getSettings();

    res.render('dashboard', {
      title: 'Dashboard',
      totalOrders,
      completedOrders,
      totalSpent,
      recentOrders: orders,
      settings,
    });
  } catch (err) {
    console.error('[Service] Dashboard error:', err.message);
    res.status(500).send('Failed to load dashboard.');
  }
};

exports.getServicesPage = async (req, res) => {
  try {
    const services = await Service.find({ status: 'active' }).sort({ category: 1, name: 1 });

    const grouped = services.reduce((acc, service) => {
      acc[service.category] = acc[service.category] || [];
      acc[service.category].push(service);
      return acc;
    }, {});

    const settings = await Settings.getSettings();

    res.render('services', { title: 'Services', grouped, settings });
  } catch (err) {
    console.error('[Service] Services page error:', err.message);
    res.status(500).send('Failed to load services.');
  }
};
