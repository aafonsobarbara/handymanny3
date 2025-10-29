import { store } from './state/store.js';
import { renderApp } from './views/appView.js';

const container = document.getElementById('app');

function init() {
  renderApp(container, store.state);
  store.subscribe((state) => renderApp(container, state));
}

window.addEventListener('DOMContentLoaded', init);
