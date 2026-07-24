const Order = require('../models/Order');
const ApiProvider = require('../models/ApiProvider');
const ProviderAPI = require('./providerApi');

exports.syncOrders = async () => {
    try {
        // Fetch all active orders that are not completed
        const activeOrders = await Order.find({
            status: { $in: ['pending', 'processing', 'in progress'] },
            providerOrderId: { $ne: null }
        }).populate('provider');

        if (activeOrders.length === 0) return;

        console.log(`[Cron] Syncing ${activeOrders.length} active orders...`);

        // Group by provider to minimize API calls
        const grouped = {};
        activeOrders.forEach(order => {
            const pid = order.provider?._id?.toString();
            if (!pid) return;
            if (!grouped[pid]) grouped[pid] = { provider: order.provider, orders: [] };
            grouped[pid].orders.push(order);
        });

        for (const pid in grouped) {
            const { provider, orders } = grouped[pid];
            if (!provider || !provider.isActive) continue;

            const api = new ProviderAPI(provider);
            
            // Try Bulk first, fallback to individual if bulk fails (compatibility)
            try {
                const ids = orders.map(o => o.providerOrderId);
                const res = await api.getMultiStatus(ids);
                
                // Standard SMM bulk response: { "order_id": { status, start_count, remains } }
                if (res && typeof res === 'object' && !Array.isArray(res)) {
                    for (const o of orders) {
                        const statusData = res[o.providerOrderId];
                        if (statusData) {
                            o.status = statusData.status.toLowerCase();
                            o.startCount = statusData.start_count || 0;
                            o.remains = statusData.remains || 0;
                            o.lastCheckedAt = Date.now();
                            await o.save();
                        }
                    }
                } else {
                    // Fallback to individual if bulk format is unexpected
                    await syncIndividual(api, orders);
                }
            } catch (err) {
                console.log(`[Cron] Bulk sync failed for ${provider.name}, trying individual...`);
                await syncIndividual(api, orders);
            }
        }
    } catch (error) {
        console.error('[Cron] Order Sync Error:', error.message);
    }
};

async function syncIndividual(api, orders) {
    for (const o of orders) {
        try {
            const res = await api.getOrderStatus(o.providerOrderId);
            o.status = res.status.toLowerCase();
            o.startCount = res.start_count || 0;
            o.remains = res.remains || 0;
            o.lastCheckedAt = Date.now();
            await o.save();
        } catch (e) {
            console.error(`[Cron] Error syncing order ${o._id}:`, e.message);
        }
    }
}