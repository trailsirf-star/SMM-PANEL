const cron = require('node-cron');
const { syncOrderStatuses, syncProviderBalances } = require('../services/orderSync');

/**
 * Registers all scheduled jobs. Called once from server.js at startup.
 * No manual trigger needed — these run automatically for the lifetime of
 * the process, which is exactly what a long-running Railway service gives us.
 */
function startCronJobs() {
  // Every 60 seconds: sync order statuses from the provider(s).
  cron.schedule('*/60 * * * * *', () => {
    syncOrderStatuses();
  });

  // Every 30 minutes: refresh cached provider balances.
  cron.schedule('*/30 * * * *', () => {
    syncProviderBalances();
  });

  console.log('[CRON] Jobs registered: order sync (60s), provider balance sync (30m).');

  // Run once immediately on boot too, so the dashboard isn't empty on first load.
  syncOrderStatuses();
  syncProviderBalances();
}

module.exports = startCronJobs;
