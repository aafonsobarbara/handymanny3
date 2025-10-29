import { store } from '../state/store.js';
import { createQuote } from '../utils/quoteFactory.js';
import {
  calculateServiceSubtotal,
  calculateHelpersTotal,
  calculateFuelCost,
  calculateTotals,
  formatCurrency,
} from '../utils/calculations.js';
import { parseServicesAndMaterials } from '../utils/openai.js';
import { researchMaterials } from '../utils/priceResearch.js';
import { DEFAULT_TERMS } from '../constants/terms.js';
import { toast } from '../utils/toast.js';

function currentQuote(state) {
  return state.drafts.find((draft) => draft.id === state.currentQuoteId) || null;
}

function renderDraftRow(draft) {
  return `
    <div class="card" data-action="open-quote" data-id="${draft.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;">
        <div>
          <div style="font-weight:600;font-size:16px;">${draft.client.name || 'Untitled Quote'}</div>
          <div style="color:var(--muted);font-size:13px;">${draft.id} • ${new Date(draft.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="text-align:right;">
          <div>
            <span class="status-dot ${draft.status.toLowerCase()}"></span>
            <span style="font-weight:600;">${draft.status}</span>
          </div>
          <div style="color:var(--muted);font-size:13px;">${formatCurrency(draft.totals.clientPrice || 0)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderLanding(state) {
  return `
    <div style="max-width:960px;margin:0 auto;padding:48px 24px;">
      <div class="header">
        <div>
          <h1 style="margin:0;font-size:32px;">HandyManny Calculator</h1>
          <p style="margin-top:8px;color:var(--muted);">Build polished handyman quotes in minutes.</p>
        </div>
        <div style="display:flex;gap:12px;">
          <button class="btn btn-ghost" data-action="open-settings">Settings</button>
          <button class="btn btn-ghost" data-action="clear-all">Clear All</button>
          <button class="btn" data-action="new-quote">+ New Quote</button>
        </div>
      </div>
      <div class="grid" style="margin-top:32px;gap:16px;">
        ${state.drafts.length === 0 ? '<div class="card" style="text-align:center;padding:48px;">No quotes yet. Click "New Quote" to begin.</div>' : state.drafts.map(renderDraftRow).join('')}
      </div>
    </div>
  `;
}

function renderChat(chat) {
  return `
    <div class="chat-panel">
      ${chat.length === 0 ? '<p style="color:var(--muted);">Start the AI service chat to generate services and materials.</p>' : chat.map((message) => `
        <div class="chat-message ${message.role === 'assistant' ? 'ai' : ''}">
          <div style="font-weight:600;margin-bottom:6px;">${message.role === 'assistant' ? 'AI' : 'You'}</div>
          <div style="white-space:pre-wrap;">${message.content}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderMaterialsTable(quote) {
  if (!quote.materialsLocked) {
    const rows = quote.materials.map((material, index) => `
      <tr>
        <td><input data-action="update-material" data-field="name" data-index="${index}" value="${material.name}"></td>
        <td><input data-action="update-material" data-field="quantity" data-index="${index}" type="number" min="0" step="0.01" value="${material.quantity}"></td>
        <td><input data-action="update-material" data-field="unit" data-index="${index}" value="${material.unit}"></td>
        <td><button class="btn btn-ghost" data-action="remove-material" data-index="${index}">Remove</button></td>
      </tr>
    `).join('');
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3>Materials Draft</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost" data-action="add-material">Add Item</button>
            <button class="btn" data-action="lock-materials" ${quote.materials.length === 0 ? 'disabled' : ''}>Lock Materials</button>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Unit</th><th></th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--muted);">Add materials manually or via AI chat.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  const rows = quote.materialsResearch.length
    ? quote.materialsResearch.map((material) => {
        const priceRows = material.pricing?.length
          ? material.pricing.map((price) => `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;">
                <div>
                  <div style="font-weight:600;">${price.store}</div>
                  <div style="color:var(--muted);font-size:13px;">${price.sourceName}</div>
                </div>
                <div style="text-align:right;">
                  <div>${formatCurrency(price.unitPrice)} / ${material.unit}</div>
                  <a href="${price.link}" target="_blank" rel="noopener" style="font-size:12px;">View</a>
                </div>
              </div>
            `).join('')
          : `<div style="color:var(--muted);font-size:13px;margin-bottom:8px;">No prices found. Enter manually.</div>`;
        const manual = `<div class="form-group" style="margin-top:8px;">
            <label>Manual price</label>
            <input type="number" min="0" step="0.01" value="${material.manualUnitPrice || ''}" data-action="manual-material-price" data-index="${material.index}">
          </div>`;
        return `
          <tr>
            <td>
              <div style="font-weight:600;">${material.name}</div>
              <div style="color:var(--muted);font-size:13px;">${material.quantity} ${material.unit}</div>
            </td>
            <td colspan="3">
              ${priceRows}
              ${material.error ? `<div style="color:var(--danger);font-size:12px;">${material.error}</div>` : ''}
              ${manual}
            </td>
          </tr>
        `;
      }).join('')
    : quote.materials.map((material, index) => `
        <tr>
          <td>${material.name}</td>
          <td>${material.quantity}</td>
          <td>${material.unit}</td>
          <td><input type="number" min="0" step="0.01" data-action="manual-material-price" data-index="${index}" value="${material.manualUnitPrice || ''}" placeholder="Unit price"></td>
        </tr>
      `).join('');

  const materialSource = quote.materialsResearch.length ? quote.materialsResearch : quote.materials;
  const total = materialSource.reduce((sum, item) => {
    if (item.pricing?.length) {
      return sum + Math.min(...item.pricing.map((p) => p.total));
    }
    if (item.manualUnitPrice) {
      return sum + item.manualUnitPrice * (item.quantity || 1);
    }
    return sum;
  }, 0);

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3>Materials Research</h3>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost" data-action="refresh-prices">Refresh Prices</button>
          <button class="btn btn-ghost" data-action="unlock-materials">Unlock</button>
        </div>
      </div>
      <table class="table">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Store</th><th>Details</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align:right;font-weight:600;">Materials Total</td>
            <td style="font-weight:600;">${formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function renderLaborTable(quote) {
  const serviceRows = quote.services.map((service, index) => `
    <tr>
      <td>${service.name}</td>
      <td>${service.hours}</td>
      <td><input type="number" min="0" step="1" data-action="update-service-rate" data-index="${index}" value="${service.rate || 75}"></td>
      <td>${formatCurrency(service.total || 0)}</td>
    </tr>
  `).join('');
  const helperRow = quote.helpers.mode === 'helpers' ? `
    <tr>
      <td>Helpers</td>
      <td>${quote.helpers.days} days × ${quote.helpers.count} helpers</td>
      <td>${formatCurrency(quote.helpers.rate || 0)}</td>
      <td>${formatCurrency(quote.helpers.total || 0)}</td>
    </tr>
  ` : '';
  const fuelRow = `
    <tr>
      <td>Fuel</td>
      <td>${quote.distanceMiles} miles</td>
      <td>${formatCurrency(store.state.company.gasRate)}</td>
      <td>${formatCurrency(quote.totals.fuel)}</td>
    </tr>
  `;
  return `
    <div class="card">
      <h3>Labor Summary</h3>
      <table class="table">
        <thead>
          <tr><th>Description</th><th>Qty/Hours</th><th>Rate</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${serviceRows || '<tr><td colspan="4" style="text-align:center;color:var(--muted);">No services yet.</td></tr>'}
          ${helperRow}
          ${fuelRow}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align:right;font-weight:600;">Grand Total</td>
            <td style="font-weight:600;">${formatCurrency(quote.totals.clientPrice)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function renderProfitBlock(quote) {
  return `
    <div class="card">
      <h3>Profit Margin</h3>
      <div class="grid two">
        <div class="form-group">
          <label>Margin %</label>
          <input type="number" min="0" max="100" step="0.5" value="${quote.margin}" data-action="update-margin">
        </div>
        <div class="form-group">
          <label>Total Cost</label>
          <input type="text" value="${formatCurrency(quote.totals.cost)}" readonly>
        </div>
        <div class="form-group">
          <label>Client Price</label>
          <input type="text" value="${formatCurrency(quote.totals.clientPrice)}" readonly>
        </div>
        <div class="form-group">
          <label>Net Profit</label>
          <input type="text" value="${formatCurrency(quote.totals.net)}" readonly>
        </div>
      </div>
    </div>
  `;
}

function renderTermsBlock(quote) {
  return `
    <div class="card">
      <h3>Terms & Conditions</h3>
      <label style="display:flex;align-items:center;gap:12px;">
        <input type="checkbox" ${quote.terms.useCustom ? 'checked' : ''} data-action="toggle-terms">
        <span>Add special conditions?</span>
      </label>
      ${quote.terms.useCustom ? `
        <div class="form-group" style="margin-top:16px;">
          <label>Special Conditions</label>
          <textarea data-action="update-custom-terms">${quote.terms.customText}</textarea>
        </div>
      ` : `<p style="color:var(--muted);margin-top:16px;">Default terms will be used.</p>`}
    </div>
  `;
}

function renderQuoteView(state) {
  const quote = currentQuote(state);
  if (!quote) return '<p>Quote not found</p>';
  const chatSection = state.ui.showChat ? renderChat(quote.chat) : '';
  return `
    <div style="max-width:1200px;margin:0 auto;padding:32px 24px;">
      <div class="header">
        <div>
          <button class="btn btn-ghost" data-action="back">← Back</button>
          <h2 style="margin:12px 0 0 0;">${quote.client.name || 'New Quote'}</h2>
        </div>
        <div style="display:flex;gap:12px;">
          <button class="btn btn-ghost" data-action="open-settings">Settings</button>
          <button class="btn" data-action="preview-quote">Preview Quote</button>
        </div>
      </div>
      <div class="layout-split" style="display:grid;grid-template-columns:2fr 1fr;gap:24px;">
        <div>
          <section class="card">
            <h3>Client Details</h3>
            <div class="grid two">
              <div class="form-group">
                <label>Client Name *</label>
                <input type="text" value="${quote.client.name}" data-action="update-client" data-field="name">
              </div>
              <div class="form-group">
                <label>Client Phone *</label>
                <input type="text" value="${quote.client.phone}" data-action="update-client" data-field="phone">
              </div>
              <div class="form-group">
                <label>Quote Date</label>
                <input type="text" value="${quote.client.date}" readonly>
              </div>
            </div>
            <button class="btn" data-action="toggle-chat" style="margin-top:16px;">${state.ui.showChat ? 'Hide' : 'Start'} Service Chat</button>
          </section>
          ${renderMaterialsTable(quote)}
          <section class="card">
            <h3>Labor & Travel</h3>
            <div style="display:flex;gap:16px;margin-bottom:16px;">
              <label class="tag"><input type="radio" name="helpers-mode" value="solo" ${quote.helpers.mode === 'solo' ? 'checked' : ''} data-action="helpers-mode"> Solo</label>
              <label class="tag"><input type="radio" name="helpers-mode" value="helpers" ${quote.helpers.mode === 'helpers' ? 'checked' : ''} data-action="helpers-mode"> With Helpers</label>
            </div>
            ${quote.helpers.mode === 'helpers' ? `
              <div class="grid three">
                <div class="form-group">
                  <label># Helpers</label>
                  <input type="number" min="0" data-action="helpers-input" data-field="count" value="${quote.helpers.count}">
                </div>
                <div class="form-group">
                  <label># Days</label>
                  <input type="number" min="0" data-action="helpers-input" data-field="days" value="${quote.helpers.days}">
                </div>
                <div class="form-group">
                  <label>Daily Rate ($)</label>
                  <input type="number" min="0" step="0.01" data-action="helpers-input" data-field="rate" value="${quote.helpers.rate}">
                </div>
              </div>
              <div style="margin-top:12px;font-weight:600;">Helpers Total: ${formatCurrency(quote.helpers.total)}</div>
            ` : ''}
            <div class="form-group" style="margin-top:16px;">
              <label>Round-trip distance (miles)</label>
              <input type="number" min="0" step="1" value="${quote.distanceMiles}" data-action="update-distance">
            </div>
          </section>
          ${renderProfitBlock(quote)}
          ${renderTermsBlock(quote)}
        </div>
        ${state.ui.showChat ? chatSection : ''}
      </div>
      ${state.ui.showChat ? '' : ''}
      ${renderLaborTable(quote)}
    </div>
  `;
}

function renderPreview(state) {
  if (!state.ui.showPreview) return '';
  const quote = currentQuote(state);
  if (!quote) return '';
  const materialsRows = quote.materials.map((material) => {
    const best = material.pricing?.length ? material.pricing.reduce((prev, curr) => (curr.total < prev.total ? curr : prev), material.pricing[0]) : null;
    const manualTotal = material.manualUnitPrice ? (material.manualUnitPrice * (material.quantity || 1)) : 0;
    const total = best ? best.total : manualTotal;
    const priceCell = best ? `${formatCurrency(best.unitPrice)} from ${best.store}` : material.manualUnitPrice ? `${formatCurrency(material.manualUnitPrice)} (manual)` : '—';
    const link = best?.link ? `<a href="${best.link}" target="_blank" rel="noopener">Link</a>` : '';
    return `<tr><td>${material.name}</td><td>${material.quantity}</td><td>${material.unit}</td><td>${priceCell}</td><td>${formatCurrency(total)}</td><td>${link}</td></tr>`;
  }).join('');

  const serviceRows = quote.services.map((service) => `<tr><td>${service.name}</td><td>${formatCurrency(service.rate || 75)}</td><td>${service.hours} h</td><td>${formatCurrency(service.total || 0)}</td></tr>`).join('');

  const helperRow = quote.helpers.mode === 'helpers' ? `<tr><td>Helpers</td><td>${formatCurrency(quote.helpers.rate)}</td><td>${quote.helpers.count} helpers × ${quote.helpers.days} days</td><td>${formatCurrency(quote.helpers.total)}</td></tr>` : '';

  const fuelRow = `<tr><td>Fuel</td><td>${formatCurrency(store.state.company.gasRate)}</td><td>${quote.distanceMiles} miles</td><td>${formatCurrency(quote.totals.fuel)}</td></tr>`;

  const baseTerms = store.state.settings.terms || DEFAULT_TERMS;
  const terms = quote.terms.useCustom
    ? `${baseTerms}\n\n${quote.terms.customText}`
    : baseTerms;

  return `
    <div class="modal" data-action="close-preview">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2>Quote Preview</h2>
          <button class="btn btn-ghost" data-action="close-preview">Close</button>
        </div>
        <div class="quote-preview">
          <header>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:24px;font-weight:700;">${store.state.company.name}</div>
                <div>${store.state.company.phone}</div>
              </div>
              ${store.state.company.logo ? `<img src="${store.state.company.logo}" alt="Logo" style="height:64px;">` : '<div style="width:64px;height:64px;border:2px dashed rgba(255,255,255,0.6);border-radius:16px;display:flex;align-items:center;justify-content:center;">Logo</div>'}
            </div>
          </header>
          <section>
            <h2>Client</h2>
            <div>${quote.client.name}</div>
            <div>${quote.client.phone}</div>
            <div>${quote.client.date}</div>
          </section>
          <section>
            <h2>Materials</h2>
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th><th>Link</th></tr></thead>
              <tbody>${materialsRows}</tbody>
            </table>
          </section>
          <section>
            <h2>Labor & Travel</h2>
            <table>
              <thead><tr><th>Description</th><th>Rate</th><th>Qty/Hours</th><th>Total</th></tr></thead>
              <tbody>${serviceRows}${helperRow}${fuelRow}</tbody>
            </table>
          </section>
          <footer>
            <div class="totals">
              <div>Total Cost: ${formatCurrency(quote.totals.cost)}</div>
              <div>Client Price: ${formatCurrency(quote.totals.clientPrice)}</div>
              <div>Net Profit: ${formatCurrency(quote.totals.net)}</div>
            </div>
            <div style="margin-top:16px;white-space:pre-wrap;">${terms}</div>
          </footer>
        </div>
        <div style="display:flex;gap:12px;margin-top:24px;">
          <button class="btn" data-action="generate-pdf">Generate PDF</button>
          <button class="btn btn-secondary" data-action="mark-approved">Mark as Approved</button>
        </div>
        ${quote.pdfDataUrl ? `<a href="${quote.pdfDataUrl}" download="${quote.client.name || 'quote'}.pdf" style="display:inline-block;margin-top:16px;">Download last PDF</a>` : ''}
      </div>
    </div>
  `;
}

function renderSettings(state) {
  if (!state.ui.showSettings) return '';
  return `
    <div class="modal" data-action="close-settings">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2>Settings</h2>
          <button class="btn btn-ghost" data-action="close-settings">Close</button>
        </div>
        <div class="grid two">
          <div class="form-group">
            <label>Company Name</label>
            <input type="text" value="${state.company.name}" data-action="settings-input" data-field="name">
          </div>
          <div class="form-group">
            <label>Company Phone</label>
            <input type="text" value="${state.company.phone}" data-action="settings-input" data-field="phone">
          </div>
          <div class="form-group">
            <label>Logo URL</label>
            <input type="text" value="${state.company.logo}" data-action="settings-input" data-field="logo">
          </div>
          <div class="form-group">
            <label>Gas rate ($/mile)</label>
            <input type="number" min="0" step="0.01" value="${state.company.gasRate}" data-action="settings-input" data-field="gasRate">
          </div>
          <div class="form-group">
            <label>OpenAI API Key</label>
            <input type="password" value="${state.settings.openAiKey}" data-action="settings-api-key">
            <small style="color:var(--muted);">Stored locally only.</small>
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label>Default Terms & Conditions</label>
            <textarea data-action="settings-terms">${state.settings.terms}</textarea>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px;gap:12px;">
          <button class="btn btn-danger" data-action="clear-all">Clear All Drafts</button>
          <button class="btn" data-action="close-settings">Done</button>
        </div>
      </div>
    </div>
  `;
}

function updateQuote(mutator) {
  store.mutate((state) => {
    const quote = currentQuote(state);
    if (!quote) return state;
    const updatedQuote = mutator({
      ...quote,
      services: quote.services.map((s) => ({ ...s })),
      materials: quote.materials.map((m) => ({ ...m })),
      materialsResearch: quote.materialsResearch.map((m) => ({
        ...m,
        pricing: m.pricing ? m.pricing.map((p) => ({ ...p })) : undefined,
      })),
      helpers: { ...quote.helpers },
      totals: { ...quote.totals },
    });
    const drafts = state.drafts.map((d) => (d.id === quote.id ? { ...updatedQuote, lastUpdated: new Date().toISOString() } : d));
    return { ...state, drafts };
  });
}

async function handleAction(event) {
  const { action } = event.target.dataset;
  if (!action) return;
  const state = store.state;
  const quote = currentQuote(state);

  switch (action) {
    case 'new-quote': {
      const quote = createQuote();
      store.setState({
        drafts: [quote, ...state.drafts],
        currentQuoteId: quote.id,
        ui: { ...state.ui, view: 'quote', showChat: true },
      });
      break;
    }
    case 'open-quote': {
      const id = event.target.closest('[data-id]')?.dataset.id;
      store.setState({ currentQuoteId: id, ui: { ...state.ui, view: 'quote' } });
      break;
    }
    case 'back': {
      store.setState({ currentQuoteId: null, ui: { ...state.ui, view: 'landing' } });
      break;
    }
    case 'open-settings': {
      store.setState({ ui: { ...state.ui, showSettings: true } });
      break;
    }
    case 'close-settings': {
      store.setState({ ui: { ...state.ui, showSettings: false } });
      break;
    }
    case 'clear-all': {
      if (confirm('Delete all drafts and reset settings?')) {
        localStorage.removeItem('handymanny-calculator-state-v1');
        window.location.reload();
      }
      break;
    }
    case 'toggle-chat': {
      store.setState({ ui: { ...state.ui, showChat: !state.ui.showChat } });
      break;
    }
    case 'update-client': {
      const field = event.target.dataset.field;
      const value = event.target.value;
      updateQuote((quote) => {
        quote.client[field] = value;
        return quote;
      });
      break;
    }
    case 'add-material': {
      updateQuote((quote) => {
        quote.materials.push({ name: 'New Material', quantity: 1, unit: 'unit' });
        return quote;
      });
      break;
    }
    case 'update-material': {
      const index = Number(event.target.dataset.index);
      const field = event.target.dataset.field;
      const value = event.target.value;
      updateQuote((quote) => {
        const material = quote.materials[index];
        if (!material) return quote;
        material[field] = field === 'quantity' ? Number(value) : value;
        return quote;
      });
      break;
    }
    case 'remove-material': {
      const index = Number(event.target.dataset.index);
      updateQuote((quote) => {
        quote.materials.splice(index, 1);
        return quote;
      });
      break;
    }
    case 'lock-materials': {
      if (!quote) return;
      if (!quote.materials.length) {
        toast('Add at least one material before locking.', 'error');
        return;
      }
      updateQuote((quote) => {
        quote.materialsLocked = true;
        quote.materialsResearch = quote.materials.map((material, index) => ({ ...material, index }));
        return quote;
      });
      toast('Materials locked. Fetching prices...', 'info');
      researchMaterials(quote.materials).then((materialsResearch) => {
        updateQuote((q) => {
          q.materialsResearch = materialsResearch.map((material, index) => ({ ...material, index }));
          q.totals.materials = materialsResearch.reduce((sum, item) => {
            if (item.pricing?.length) {
              return sum + Math.min(...item.pricing.map((p) => p.total));
            }
            if (item.manualUnitPrice) {
              return sum + (item.manualUnitPrice * (item.quantity || 1));
            }
            return sum;
          }, 0);
          q.materials = materialsResearch.map((material, index) => ({ ...material, index }));
          return recalcTotals(q);
        });
      });
      break;
    }
    case 'refresh-prices': {
      if (!quote) return;
      toast('Refreshing prices...', 'info');
      researchMaterials(quote.materials).then((materialsResearch) => {
        updateQuote((q) => {
          q.materialsResearch = materialsResearch.map((material, index) => ({ ...material, index }));
          return recalcTotals(q);
        });
      });
      break;
    }
    case 'unlock-materials': {
      updateQuote((quote) => {
        quote.materialsLocked = false;
        quote.materialsResearch = [];
        quote.materials = quote.materials.map((material) => ({ name: material.name, quantity: material.quantity, unit: material.unit }));
        return quote;
      });
      break;
    }
    case 'manual-material-price': {
      const index = Number(event.target.dataset.index);
      const value = Number(event.target.value);
      updateQuote((quote) => {
        const target = quote.materialsResearch[index] || quote.materials[index];
        if (!target) return quote;
        target.manualUnitPrice = value;
        return recalcTotals(quote);
      });
      break;
    }
    case 'update-service-rate': {
      const index = Number(event.target.dataset.index);
      const rate = Number(event.target.value) || 0;
      updateQuote((quote) => {
        const service = quote.services[index];
        if (!service) return quote;
        service.rate = rate;
        service.total = calculateServiceSubtotal(service.hours, rate);
        return recalcTotals(quote);
      });
      break;
    }
    case 'helpers-mode': {
      const mode = event.target.value;
      updateQuote((quote) => {
        quote.helpers.mode = mode;
        if (mode === 'solo') {
          quote.helpers.total = 0;
        }
        return recalcTotals(quote);
      });
      break;
    }
    case 'helpers-input': {
      const field = event.target.dataset.field;
      const value = Number(event.target.value) || 0;
      updateQuote((quote) => {
        quote.helpers[field] = value;
        if (quote.helpers.mode === 'helpers') {
          quote.helpers.total = calculateHelpersTotal(quote.helpers.count, quote.helpers.days, quote.helpers.rate);
        } else {
          quote.helpers.total = 0;
        }
        return recalcTotals(quote);
      });
      break;
    }
    case 'update-distance': {
      const value = Number(event.target.value) || 0;
      updateQuote((quote) => {
        quote.distanceMiles = value;
        quote.totals.fuel = calculateFuelCost(value, store.state.company.gasRate);
        return recalcTotals(quote);
      });
      break;
    }
    case 'update-margin': {
      const value = Number(event.target.value) || 0;
      updateQuote((quote) => {
        quote.margin = value;
        return recalcTotals(quote);
      });
      break;
    }
    case 'toggle-terms': {
      updateQuote((quote) => {
        quote.terms.useCustom = !quote.terms.useCustom;
        return quote;
      });
      break;
    }
    case 'update-custom-terms': {
      const value = event.target.value;
      updateQuote((quote) => {
        quote.terms.customText = value;
        return quote;
      });
      break;
    }
    case 'preview-quote': {
      if (!quote.client.name || !quote.client.phone) {
        toast('Client name and phone are required.', 'error');
        return;
      }
      store.setState({ ui: { ...state.ui, showPreview: true } });
      break;
    }
    case 'close-preview': {
      store.setState({ ui: { ...state.ui, showPreview: false } });
      break;
    }
    case 'generate-pdf': {
      if (!quote) return;
      generatePdf(quote);
      break;
    }
    case 'mark-approved': {
      updateQuote((quote) => {
        quote.status = 'Approved';
        return quote;
      });
      toast('Quote marked as approved.', 'success');
      break;
    }
    case 'settings-input': {
      const field = event.target.dataset.field;
      const value = field === 'gasRate' ? Number(event.target.value) || 0 : event.target.value;
      store.update(`company.${field}`, value);
      if (field === 'gasRate' && quote) {
        updateQuote((quote) => {
          quote.totals.fuel = calculateFuelCost(quote.distanceMiles, value);
          return recalcTotals(quote);
        });
      }
      break;
    }
    case 'settings-api-key': {
      store.update('settings', { ...state.settings, openAiKey: event.target.value });
      break;
    }
    case 'settings-terms': {
      store.update('settings', { ...state.settings, terms: event.target.value });
      break;
    }
    default:
      break;
  }
}

function recalcTotals(quote) {
  const materialsTotal = (quote.materialsResearch.length ? quote.materialsResearch : quote.materials).reduce((sum, material) => {
    if (material.pricing?.length) {
      const min = Math.min(...material.pricing.map((p) => p.total));
      return sum + min;
    }
    if (material.manualUnitPrice) {
      return sum + (material.manualUnitPrice * (material.quantity || 1));
    }
    return sum;
  }, 0);

  quote.totals.fuel = calculateFuelCost(quote.distanceMiles, store.state.company.gasRate);
  quote.services = quote.services.map((service) => ({
    ...service,
    total: calculateServiceSubtotal(service.hours, service.rate || 75),
  }));
  quote.totals = calculateTotals({
    materialsTotal,
    services: quote.services,
    helpersTotal: quote.helpers.total,
    fuelCost: quote.totals.fuel,
    margin: quote.margin,
  });
  return quote;
}

async function handleChatSubmit(event) {
  const form = event.target.closest('form[data-chat-form]');
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector('textarea');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  updateQuote((quote) => {
    quote.chat.push({ role: 'user', content });
    return quote;
  });
  const state = store.state;
  const quote = currentQuote(state);
  const spinner = document.createElement('div');
  spinner.textContent = 'Thinking...';
  spinner.className = 'chat-message ai';
  form.parentElement.querySelector('.chat-panel').appendChild(spinner);
  try {
    const { assistantMessage, parsed } = await parseServicesAndMaterials(quote.chat);
    updateQuote((quote) => {
      quote.chat.push({ role: 'assistant', content: assistantMessage });
      if (parsed?.services?.length) {
        quote.services = parsed.services.map((service) => {
          const hours = Number(service.hours);
          const rate = Number(service.rate);
          const safeHours = Number.isFinite(hours) ? hours : 0;
          const safeRate = Number.isFinite(rate) ? rate : 75;
          return {
            name: service.name,
            hours: safeHours,
            rate: safeRate,
            total: calculateServiceSubtotal(safeHours, safeRate),
          };
        });
      }
      if (parsed?.materials) {
        quote.materials = parsed.materials.map((material) => {
          const quantity = Number(material.quantity);
          const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
          return {
            name: material.name,
            quantity: safeQuantity,
            unit: material.unit || 'unit',
          };
        });
      }
      quote.materialsLocked = false;
      quote.materialsResearch = [];
      return recalcTotals(quote);
    });
    toast('AI chat updated services and materials.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    if (spinner.isConnected) {
      spinner.remove();
    }
  }
}

function setupChatListener(container) {
  container.querySelectorAll('form[data-chat-form]').forEach((form) => {
    form.addEventListener('submit', handleChatSubmit);
  });
}

function renderChatForm() {
  return `
    <form data-chat-form style="margin-top:16px;display:flex;flex-direction:column;gap:12px;">
      <textarea placeholder="Describe the job (e.g. Paint living room walls, replace trim, etc.)"></textarea>
      <button class="btn" type="submit">Send to AI</button>
    </form>
  `;
}

function renderQuoteWithChat(state) {
  const quote = currentQuote(state);
  if (!quote) return renderQuoteView(state);
  const base = renderQuoteView(state);
  if (!state.ui.showChat) return base;
  const container = document.createElement('div');
  container.innerHTML = base;
  const chatPanel = container.querySelector('.chat-panel');
  if (chatPanel) {
    chatPanel.insertAdjacentHTML('beforeend', renderChatForm());
  }
  return container.innerHTML;
}

export function renderApp(container, state) {
  let html = '';
  if (state.ui.view === 'landing') {
    html = renderLanding(state);
  } else {
    html = renderQuoteWithChat(state);
  }
  const preview = renderPreview(state);
  const settings = renderSettings(state);
  container.innerHTML = `${html}${preview}${settings}`;
  container.querySelectorAll('[data-action]').forEach((node) => {
    node.addEventListener('click', handleAction);
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
      node.addEventListener('change', handleAction);
      node.addEventListener('input', handleAction);
    }
  });
  setupChatListener(container);
}

function generatePdf(quote) {
  import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js').then((module) => {
    const jsPDFLib = module.jsPDF || module.default?.jsPDF || module.default || (window.jspdf && window.jspdf.jsPDF);
    const JsPdfClass = jsPDFLib?.jsPDF || jsPDFLib;
    if (!JsPdfClass) {
      toast('Unable to load PDF generator. Check your connection.', 'error');
      return;
    }
    const doc = new JsPdfClass({ unit: 'pt', format: 'a4' });
    const margin = 40;
    let y = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('HandyManny Quote', margin, y);
    y += 24;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`${quote.client.name}`, margin, y);
    y += 16;
    doc.text(`Phone: ${quote.client.phone}`, margin, y);
    y += 16;
    doc.text(`Date: ${quote.client.date}`, margin, y);
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.text('Materials', margin, y);
    y += 16;
    quote.materials.forEach((material) => {
      doc.setFont('helvetica', 'normal');
      const line = `${material.name} - ${material.quantity} ${material.unit}`;
      doc.text(line, margin, y);
      y += 16;
    });
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Labor & Travel', margin, y);
    y += 16;
    quote.services.forEach((service) => {
      doc.setFont('helvetica', 'normal');
      doc.text(`${service.name} - ${service.hours}h @ ${formatCurrency(service.rate)}`, margin, y);
      y += 16;
    });
    if (quote.helpers.mode === 'helpers') {
      doc.text(`Helpers: ${quote.helpers.count} × ${quote.helpers.days} days = ${formatCurrency(quote.helpers.total)}`, margin, y);
      y += 16;
    }
    doc.text(`Fuel: ${quote.distanceMiles} miles = ${formatCurrency(quote.totals.fuel)}`, margin, y);
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.text('Totals', margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.text(`Cost: ${formatCurrency(quote.totals.cost)}`, margin, y);
    y += 16;
    doc.text(`Client Price: ${formatCurrency(quote.totals.clientPrice)}`, margin, y);
    y += 16;
    doc.text(`Net Profit: ${formatCurrency(quote.totals.net)}`, margin, y);
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.text('Terms', margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    const baseTerms = store.state.settings.terms || DEFAULT_TERMS;
    const terms = quote.terms.useCustom ? `${baseTerms}\n\n${quote.terms.customText}` : baseTerms;
    const lines = doc.splitTextToSize(terms, 520);
    doc.text(lines, margin, y);
    const pdfData = doc.output('datauristring');
    updateQuote((q) => {
      q.pdfDataUrl = pdfData;
      return q;
    });
    const link = document.createElement('a');
    link.href = pdfData;
    link.download = `${quote.client.name || 'quote'}.pdf`;
    link.click();
    toast('PDF generated.', 'success');
  }).catch(() => toast('Unable to load PDF generator. Check your connection.', 'error'));
}
