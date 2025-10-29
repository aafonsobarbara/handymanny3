import { toast } from './toast.js';

class PriceResearcher {
  constructor() {
    this.worker = null;
    this.callbacks = new Map();
  }

  ensureWorker() {
    if (!this.worker) {
      this.worker = new Worker('./src/workers/priceWorker.js', { type: 'module' });
      this.worker.onmessage = (event) => {
        const { id, status, results, error } = event.data;
        const callback = this.callbacks.get(id);
        if (!callback) return;
        this.callbacks.delete(id);
        if (status === 'success') {
          callback.resolve(results);
        } else {
          callback.reject(new Error(error || 'Price research failed'));
        }
      };
    }
  }

  async lookup(item) {
    this.ensureWorker();
    return new Promise((resolve, reject) => {
      const id = `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      this.callbacks.set(id, { resolve, reject });
      try {
        this.worker.postMessage({ id, item });
      } catch (error) {
        this.callbacks.delete(id);
        reject(error);
      }
    });
  }
}

export const priceResearcher = new PriceResearcher();

export async function researchMaterials(materials) {
  const enhanced = await Promise.all(
    materials.map(async (material) => {
      try {
        const results = await priceResearcher.lookup(material.name);
        if (!results.length) throw new Error('No prices found');
        return {
          ...material,
          pricing: results.map((result) => ({
            store: result.store,
            unitPrice: result.price,
            total: Number((result.price * (material.quantity || 1)).toFixed(2)),
            link: result.link,
            sourceName: result.name,
          })),
          error: null,
        };
      } catch (error) {
        toast(`Price lookup failed for ${material.name}. Please enter manually.`, 'warning');
        return {
          ...material,
          pricing: [],
          manualUnitPrice: '',
          error: error.message,
        };
      }
    })
  );
  return enhanced;
}
