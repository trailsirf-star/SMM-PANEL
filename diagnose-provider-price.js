#!/usr/bin/env node
/**
 * diagnose-provider-price.js
 *
 * One-off diagnostic — NOT part of the app.
 *
 * Makes a real, raw "action=services" call directly to your provider
 * (bypassing providerApi.js's field-picking logic entirely), prints the
 * first service exactly as the provider sends it, then looks up that same
 * service in MongoDB to show what importServicesFromProvider actually
 * stored. Put these two side by side to see whether the wrong field is
 * being picked.
 *
 * SETUP:
 *   1. Copy this file into your project root (same folder as package.json,
 *      next to server.js) so its requires resolve correctly.
 *   2. Run it from there, where your real .env (MONGO_URI) is already loaded:
 *        node diagnose-provider-price.js
 *   3. If you have more than one provider configured, target one by name:
 *        node diagnose-provider-price.js "Tajammul"
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const ApiProvider = require('./models/ApiProvider');
const Service = require('./models/Service');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const nameFilter = process.argv[2];
    const provider = nameFilter
      ? await ApiProvider.findOne({ name: new RegExp(nameFilter, 'i') })
      : await ApiProvider.findOne({});

    if (!provider) {
      console.error('No matching ApiProvider found in the database.');
      process.exit(1);
    }
    console.log(`Using provider: ${provider.name} (${provider.apiUrl})\n`);

    // Raw, unprocessed call — bypasses providerApi.js entirely so we see
    // exactly what the provider sends, before any field-picking logic runs.
    const { data } = await axios.post(
      provider.apiUrl,
      new URLSearchParams({ key: provider.apiKey, action: 'services' }),
      { timeout: 15000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const list = Array.isArray(data) ? data : (data.services || data.data || data.result || []);
    if (!list.length) {
      console.error('Provider returned no services. Raw response:', JSON.stringify(data).slice(0, 500));
      process.exit(1);
    }

    const first = list[0];
    console.log('--- RAW first service from provider (unprocessed) ---');
    console.log(JSON.stringify({
      service: first.service,
      name: first.name,
      rate: first.rate,
      price: first.price,
      cost: first.cost,
      charge: first.charge,
      originalObject: first,
    }, null, 2));

    // Compare against what's currently stored for this service after import.
    const providerServiceId = String(first.service ?? first.id ?? '').trim();
    const stored = await Service.findOne({ providerServiceId, provider: provider._id });

    console.log('\n--- What is currently stored in MongoDB for this service ---');
    if (stored) {
      console.log(JSON.stringify({
        providerServiceId: stored.providerServiceId,
        providerCostPer1000: stored.providerCostPer1000,
        sellPricePer1000: stored.sellPricePer1000,
      }, null, 2));
    } else {
      console.log('(No matching service found in DB yet — run Import Services first, then re-run this script.)');
    }

    process.exit(0);
  } catch (err) {
    console.error('Diagnostic failed:', err.response?.data || err.message);
    process.exit(1);
  }
})();
