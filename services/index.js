const cron = require('node-cron');
const ApiProvider = require('../models/ApiProvider');
const ProviderAPI = require('../services/providerApi');
const { syncOrders } = require('../services/orderSync');

module.exports = function() {
    // Sync orders every 60 seconds
    cron.schedule('* * * * *', async () => {
        console.log('[Cron] Running 60s order sync...');
        await syncOrders();
    });

    // Sync balances every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        console.log('[Cron] Running 30m balance sync...');
        try {
            const providers = await ApiProvider.find({ isActive: true });
            for (const p of providers) {
                try {
                    const api = new ProviderAPI(p);
                    const res = await api.getBalance();
                    p.balance = res.balance;
                    p.lastSyncedAt = new Date();
                    await p.save();
                    console.log(`[Cron] Updated balance for ${p.name}: ${res.balance}`);
                } catch (e) {
                    console.error(`[Cron] Balance sync failed for ${p.name}`);
                }
            }
        } catch (error) {
            console.error('[Cron] Provider balance sync error:', error.message);
        }
    });
};