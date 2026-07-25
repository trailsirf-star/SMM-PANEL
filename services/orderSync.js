const Order = require('../models/Order');
const ApiProvider = require('../models/ApiProvider');
const providerApi = require('./providerApi');

const ACTIVE_STATUSES = ['pending', 'processing', 'in progress'];

// Provider status strings are lowercase-ish and vary slightly by provider;
// normalize them to our own enum.
function normalizeStatus(providerStatus) {
  if (!providerStatus) return null;
  const s = String(providerStatus).toLowerCase();

  if (s.includes('partial')) return 'partial';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('refund')) return 'refunded';
  if (s.includes('progress')) return 'in progress';
  if (s.includes('processing')) return 'processing';
  if (s.includes('complete')) return 'completed';
  if (s.includes('pending')) return 'pending';

  return null; // unknown status string, leave order untouched
}

/**
 * Runs every 60 seconds. Finds all orders still in an active state, groups
 * them by provider (since each Order's Service references a provider), and
 * calls getMultiStatus in batches per provider for efficiency.
 */
async function syncOrderStatuses() {
  const runStartedAt = new Date();

  try {
    const orders = await Order.find({
      status: { $in: ACTIVE_STATUSES },
      providerOrderId: { $ne: null },
    }).populate({ path: 'service', populate: { path: 'provider' } });

    if (orders.length === 0) {
      console.log(`[CRON][orderSync] ${runStartedAt.toISOString()} — no active orders to check.`);
      return;
    }

    // Group orders by provider so we can batch the multi-status call per provider.
    const groups = new Map(); // providerId -> { provider, orders: [] }

    for (const order of orders) {
      const provider = order.service?.provider;
      if (!provider || !provider.isActive) continue;

      const key = String(provider._id);
      if (!groups.has(key)) groups.set(key, { provider, orders: [] });
      groups.get(key).orders.push(order);
    }

    let updatedCount = 0;

    for (const { provider, orders: providerOrders } of groups.values()) {
      const BATCH_SIZE = 100;

      for (let i = 0; i < providerOrders.length; i += BATCH_SIZE) {
        const batch = providerOrders.slice(i, i + BATCH_SIZE);
        const idToOrder = new Map(batch.map((o) => [String(o.providerOrderId), o]));

        let statusMap;
        try {
          statusMap = await providerApi.getMultiStatus(
            { apiUrl: provider.apiUrl, apiKey: provider.apiKey },
            [...idToOrder.keys()]
          );
        } catch (err) {
          console.error(`[CRON][orderSync] Provider "${provider.name}" batch failed:`, err.message);
          continue;
        }

        for (const [providerOrderId, info] of Object.entries(statusMap || {})) {
          const order = idToOrder.get(String(providerOrderId));
          if (!order) continue;

          const normalized = normalizeStatus(info.status);
          const update = { lastCheckedAt: new Date() };

          if (normalized) update.status = normalized;
          if (info.remains !== undefined) update.remains = Number(info.remains) || 0;
          if (info.start_count !== undefined) update.startCount = Number(info.start_count) || 0;
          if (info.error) update.errorMessage = String(info.error);

          await Order.updateOne({ _id: order._id }, { $set: update });
          updatedCount += 1;
        }
      }
    }

    console.log(
      `[CRON][orderSync] ${runStartedAt.toISOString()} — checked ${orders.length} orders, updated ${updatedCount}.`
    );
  } catch (err) {
    console.error('[CRON][orderSync] Unexpected error:', err.message);
  }
}

/**
 * Runs every 30 minutes. Refreshes the cached balance for every active
 * ApiProvider so the admin dashboard shows an up-to-date number.
 */
async function syncProviderBalances() {
  const runStartedAt = new Date();

  try {
    const providers = await ApiProvider.find({ isActive: true });

    for (const provider of providers) {
      try {
        const { balance, currency } = await providerApi.getBalance({
          apiUrl: provider.apiUrl,
          apiKey: provider.apiKey,
        });

        provider.balance = balance;
        provider.currency = currency;
        provider.lastSyncedAt = new Date();
        await provider.save();

        console.log(
          `[CRON][balanceSync] ${runStartedAt.toISOString()} — "${provider.name}" balance: ${balance} ${currency}`
        );
      } catch (err) {
        console.error(`[CRON][balanceSync] Failed for provider "${provider.name}":`, err.message);
      }
    }
  } catch (err) {
    console.error('[CRON][balanceSync] Unexpected error:', err.message);
  }
}

module.exports = { syncOrderStatuses, syncProviderBalances, normalizeStatus };
