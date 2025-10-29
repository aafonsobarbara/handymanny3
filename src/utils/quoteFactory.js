import { createQuoteId } from '../state/store.js';

export function createQuote() {
  const today = new Date().toISOString().split('T')[0];
  return {
    id: createQuoteId(),
    createdAt: new Date().toISOString(),
    status: 'Draft',
    client: {
      name: '',
      phone: '',
      date: today,
    },
    chat: [],
    services: [],
    materials: [],
    materialsLocked: false,
    materialsResearch: [],
    helpers: {
      mode: 'solo',
      count: 0,
      days: 0,
      rate: 0,
      total: 0,
    },
    distanceMiles: 0,
    margin: 25,
    totals: {
      materials: 0,
      serviceTotal: 0,
      helpers: 0,
      fuel: 0,
      cost: 0,
      clientPrice: 0,
      gross: 0,
      net: 0,
      margin: 25,
    },
    terms: {
      useCustom: false,
      customText: '',
    },
    specialConditions: '',
    pdfDataUrl: '',
    lastUpdated: new Date().toISOString(),
  };
}
