function convertUsdToPkr(usdAmount, exchangeRate) {
  const usd = Number(usdAmount);
  const rate = Number(exchangeRate);

  if (!Number.isFinite(usd) || usd < 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;

  return Number((usd * rate).toFixed(2));
}

function calculateProviderCost(providerUsdRatePer1000, exchangeRate) {
  return convertUsdToPkr(providerUsdRatePer1000, exchangeRate);
}

function calculateSellingPrice(providerCostPer1000, commissionPercent) {
  const cost = Number(providerCostPer1000);
  const commission = Number(commissionPercent);

  if (!Number.isFinite(cost) || cost < 0) return 0;

  const safeCommission = Number.isFinite(commission) ? commission : 0;
  return Number((cost * (1 + safeCommission / 100)).toFixed(2));
}

module.exports = {
  convertUsdToPkr,
  calculateProviderCost,
  calculateSellingPrice,
};
