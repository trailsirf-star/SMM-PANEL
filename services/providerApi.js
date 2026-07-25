const axios = require('axios');

/**
 * Generic client for a standard SMM-panel-style provider API.
 * This format (POST with an `action` field, plus `key`) is used across the
 * SMM reselling industry, so this wrapper is provider-agnostic: pass in the
 * apiUrl + apiKey of whichever ApiProvider document you're calling.
 *
 * Every method takes { apiUrl, apiKey } as its first argument so providers
 * are never hardcoded — they come from the ApiProvider model, configured in
 * the admin panel.
 */

const DEFAULT_TIMEOUT = 15000;

async function callProvider(apiUrl, payload) {

  console.log("========== PROVIDER ==========");
  console.log("URL:", apiUrl);
  console.log("Payload:", payload);

  try {
    const { data } = await axios.post(
      apiUrl,
      new URLSearchParams(payload),
      {
        timeout: DEFAULT_TIMEOUT,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("Response:", data);

    return data;

  } catch (err) {
    console.log("Axios Error:", err.message);
    console.log("Response:", err.response?.data);

    throw new Error(
      `Provider API request failed: ${
        err.response?.data
          ? JSON.stringify(err.response.data)
          : err.message
      }`
    );
  }
}

/**
 * Places a new order with the provider.
 * @returns {Promise<{order: string}>}
 */
async function placeOrder({ apiUrl, apiKey }, { service, link, quantity }) {
  const data = await callProvider(apiUrl, {
    key: apiKey,
    action: 'add',
    service,
    link,
    quantity,
  });

  if (!data || !data.order) {
    throw new Error(data?.error || 'Provider did not return an order ID.');
  }

  return { order: String(data.order) };
}

/**
 * Gets the status of a single provider order.
 * @returns {Promise<{status: string, remains: number, start_count: number}>}
 */
async function getOrderStatus({ apiUrl, apiKey }, providerOrderId) {
  const data = await callProvider(apiUrl, {
    key: apiKey,
    action: 'status',
    order: providerOrderId,
  });

  if (!data || data.error) {
    throw new Error(data?.error || 'Failed to fetch order status.');
  }

  return {
    status: data.status,
    remains: Number(data.remains) || 0,
    start_count: Number(data.start_count) || 0,
  };
}

/**
 * Bulk status check — much more efficient than calling getOrderStatus in a loop.
 * @param {string[]} providerOrderIdsArray
 * @returns {Promise<Object>} map of providerOrderId -> { status, remains, start_count }
 */
async function getMultiStatus({ apiUrl, apiKey }, providerOrderIdsArray) {
  if (!providerOrderIdsArray || providerOrderIdsArray.length === 0) return {};

  const data = await callProvider(apiUrl, {
    key: apiKey,
    action: 'status',
    orders: providerOrderIdsArray.join(','),
  });

  // Standard format returns an object keyed by order id when `orders` is used.
  return data || {};
}

/**
 * Gets the current balance on the provider account.
 * @returns {Promise<{balance: number, currency: string}>}
 */
async function getBalance({ apiUrl, apiKey }) {
  const data = await callProvider(apiUrl, {
    key: apiKey,
    action: 'balance',
  });

  if (!data || data.error) {
    throw new Error(data?.error || 'Failed to fetch provider balance.');
  }

  return {
    balance: Number(data.balance) || 0,
    currency: data.currency || 'USD',
  };
}

/**
 * Gets the list of services available from the provider (for importing).
 * @returns {Promise<Array>}
 */
async function getServices({ apiUrl, apiKey }) {
  const data = await callProvider(apiUrl, {
    key: apiKey,
    action: 'services',
  });

  if (!Array.isArray(data)) {
    throw new Error('Unexpected response fetching provider services.');
  }

  return data;
}

module.exports = {
  placeOrder,
  getOrderStatus,
  getMultiStatus,
  getBalance,
  getServices,
};
