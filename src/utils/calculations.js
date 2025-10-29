export function calculateServiceSubtotal(hours, rate) {
  const safeHours = Number(hours) || 0;
  const safeRate = Number(rate) || 0;
  return Number((safeHours * safeRate).toFixed(2));
}

export function calculateFuelCost(distance, ratePerMile) {
  const miles = Number(distance) || 0;
  const rate = Number(ratePerMile) || 0;
  return Number((miles * rate).toFixed(2));
}

export function calculateHelpersTotal(helpers, days, dailyRate) {
  const count = Number(helpers) || 0;
  const dayCount = Number(days) || 0;
  const rate = Number(dailyRate) || 0;
  return Number((count * dayCount * rate).toFixed(2));
}

export function calculateTotals({
  materialsTotal,
  services,
  helpersTotal,
  fuelCost,
  margin,
}) {
  const serviceTotal = services.reduce((sum, service) => sum + (Number(service.total) || 0), 0);
  const helpers = Number(helpersTotal) || 0;
  const fuel = Number(fuelCost) || 0;
  const materials = Number(materialsTotal) || 0;
  const cost = Number((materials + serviceTotal + helpers + fuel).toFixed(2));
  const safeMargin = Math.max(0, Math.min(100, Number(margin) || 0));
  const clientPrice = Number((cost * (1 + safeMargin / 100)).toFixed(2));
  const gross = Number((clientPrice - cost).toFixed(2));
  return {
    materials,
    serviceTotal,
    helpers,
    fuel,
    cost,
    margin: safeMargin,
    clientPrice,
    gross,
    net: gross,
  };
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}
