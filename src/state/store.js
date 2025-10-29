const STORAGE_KEY = 'handymanny-calculator-state-v1';

const defaultState = () => ({
  company: {
    name: 'HandyManny Services',
    phone: '(555) 123-4567',
    logo: '',
    gasRate: 0.2,
  },
  settings: {
    terms: `**Handyman Quote – Terms & Conditions**\n\n1. **Validity**: This quote is valid for 30 days from the date above.\n2. **Payment**: 50 % deposit upon acceptance, balance due upon completion.\n3. **Materials**: Prices based on current Home Depot / Tractor Supply rates; subject to change if unavailable.\n4. **Labor**: Rates include travel; fuel calculated at $0.20/mi.\n5. **Changes**: Any client-requested changes after approval require a revised quote.\n6. **Warranty**: Workmanship guaranteed for 90 days; materials per manufacturer warranty.\n7. **Cancellation**: Deposits non-refundable once work has begun.\n\n[Special conditions added by user appear here]\n`,
    openAiKey: '',
  },
  drafts: [],
  currentQuoteId: null,
  ui: {
    view: 'landing',
    showPreview: false,
    showSettings: false,
    showChat: false,
  },
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (error) {
    console.error('Failed to load state', error);
    return defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state', error);
  }
}

class Store {
  constructor(initialState) {
    this.state = initialState;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    saveState(this.state);
    this.listeners.forEach((listener) => listener(this.state));
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  update(path, value) {
    const keys = path.split('.');
    let current = this.state;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const key = keys[i];
      current[key] = { ...current[key] };
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
    this.notify();
  }

  mutate(mutator) {
    this.state = mutator(this.state);
    this.notify();
  }
}

export const store = new Store(typeof window !== 'undefined' ? loadState() : defaultState());

export function resetStore() {
  const next = defaultState();
  store.state = next;
  store.notify();
}

export function createQuoteId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `Q-${timestamp}-${random}`.toUpperCase();
}

export const STORAGE = {
  key: STORAGE_KEY,
  defaultState,
};
