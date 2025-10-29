const HOME_DEPOT_API = 'https://www.homedepot.com/hsearch/api/v1/search';
const TRACTOR_SUPPLY_API = 'https://www.tractorsupply.com/tsc/search';

async function fetchHomeDepot(item) {
  const url = `${HOME_DEPOT_API}?keyword=${encodeURIComponent(item)}&storeSkuType=10051`;
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error('Home Depot request failed');
  const data = await response.json();
  const first = data?.response?.docs?.[0];
  if (!first) throw new Error('No products found');
  return {
    store: 'Home Depot',
    name: first?.storeSkuDisplayName || item,
    price: Number(first?.storeSkuPrice) || Number(first?.price || 0),
    link: `https://www.homedepot.com/p/${first?.storeSkuNumber}`,
  };
}

async function fetchTractorSupply(item) {
  const url = `${TRACTOR_SUPPLY_API}/${encodeURIComponent(item)}`;
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error('Tractor Supply request failed');
  const html = await response.text();
  const priceMatch = html.match(/"salePrice":\s*"(\d+\.\d+)"/);
  const nameMatch = html.match(/"productName":\s*"([^"]+)"/);
  const price = priceMatch ? Number(priceMatch[1]) : 0;
  const name = nameMatch ? nameMatch[1] : item;
  const link = `https://www.tractorsupply.com/search?q=${encodeURIComponent(item)}`;
  if (!price) throw new Error('No price found');
  return { store: 'Tractor Supply', name, price, link };
}

self.onmessage = async (event) => {
  const { id, item } = event.data;
  const results = [];
  try {
    const [homeDepotResult, tractorResult] = await Promise.allSettled([
      fetchHomeDepot(item),
      fetchTractorSupply(item),
    ]);
    if (homeDepotResult.status === 'fulfilled') {
      results.push(homeDepotResult.value);
    }
    if (tractorResult.status === 'fulfilled') {
      results.push(tractorResult.value);
    }
    self.postMessage({ id, status: 'success', results });
  } catch (error) {
    self.postMessage({ id, status: 'error', error: error.message });
  }
};
