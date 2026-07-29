const axios = require('axios');

const DEFAULT_TIMEOUT = 15000;

function safeJson(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

async function callProvider(apiUrl, payload) {
  try {

const { data } = await axios.post(
  apiUrl,
  new URLSearchParams(payload),
  {
    timeout: 30000,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  }
);

    const parsed = safeJson(data);
    if (process.env.DEBUG_PROVIDER_SERVICES === 'true' && payload?.action === 'services') {
      const list = normalizeServiceList(parsed);
      console.log('[Provider API] raw services response type:', Array.isArray(parsed) ? 'array' : typeof parsed);
      console.log('[Provider API] raw services response sample:', JSON.stringify(Array.isArray(parsed) ? parsed.slice(0, 3) : parsed, null, 2));
      console.log('[Provider API] first raw service:', JSON.stringify(list[0] || null, null, 2));
    }

    return parsed;
  } catch (err) {
    const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`Provider API request failed: ${msg}`);
  }
}

function pickServicePrice(s) {
  const candidates = [
    ['rate', s.rate],
    ['price', s.price],
    ['cost', s.cost],
  ];

  const selected = candidates.find(([, value]) => value !== undefined && value !== null && value !== '');
  return {
    value: selected ? selected[1] : 0,
    source: selected ? selected[0] : 'none',
  };
}

function normalizeServiceList(data) {
  const normalized = safeJson(data);

  if (Array.isArray(normalized)) return normalized;
  if (Array.isArray(normalized?.services)) return normalized.services;
  if (Array.isArray(normalized?.data)) return normalized.data;
  if (Array.isArray(normalized?.result)) return normalized.result;

  return [];
}

async function placeOrder({ apiUrl, apiKey }, { service, link, quantity }) {
  const data = await callProvider(apiUrl, {
    key: apiKey,
    action: 'add',
    service,
    link,
    quantity,
  });

  if (!data || data.error || !data.order) {
    throw new Error(data?.error || 'Provider did not return an order ID.');
  }

  return { order: String(data.order) };
}

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

async function getMultiStatus({ apiUrl, apiKey }, providerOrderIdsArray) {
  if (!providerOrderIdsArray || providerOrderIdsArray.length === 0) return {};

  const data = await callProvider(apiUrl, {
    key: apiKey,
    action: 'status',
    orders: providerOrderIdsArray.join(','),
  });

  return data || {};
}

async function getBalance({ apiUrl, apiKey }) {
  const data = await callProvider(apiUrl, {
    key: apiKey,
    action: 'balance',
  });

  if (!data || data.error) {
    throw new Error(data?.error || 'Failed to fetch provider balance.');
  }

  return {
    balance: Number(data.balance ?? data?.data?.balance ?? 0) || 0,
    currency: data.currency ?? data?.data?.currency ?? 'USD',
  };
}

async function getServices({ apiUrl, apiKey }) {
  const data = await callProvider(apiUrl, {
    key: apiKey,
    action: 'services',
  });

  const services = normalizeServiceList(data)
    .filter(Boolean)
    .map((s) => {
      const pickedPrice = pickServicePrice(s);
      return {
        service: s.service ?? s.id ?? s.sid ?? s.service_id ?? null,
        name: s.name ?? s.service_name ?? '',
        category: s.category ?? s.type ?? 'Other',
        rate: pickedPrice.value,
        priceSource: pickedPrice.source,
        rawRate: s.rate,
        rawPrice: s.price,
        rawCost: s.cost,
        min: s.min ?? s.min_order ?? 100,
        max: s.max ?? s.max_order ?? 10000,
        type: s.description ?? s.desc ?? s.type ?? '',
        status: s.status ?? s.enabled ?? s.active ?? null,
      };
    })
    .filter((s) => s.service !== null && s.name);

  if (!services.length) {
    throw new Error('Unexpected response fetching provider services.');
  }

  return services;
}

module.exports = {
  placeOrder,
  getOrderStatus,
  getMultiStatus,
  getBalance,
  getServices,
};
