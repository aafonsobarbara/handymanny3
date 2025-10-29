let idCounter = 0;

export function toast(message, variant = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const id = `toast-${idCounter += 1}`;
  const node = document.createElement('div');
  node.className = `toast ${variant}`;
  node.id = id;
  node.textContent = message;
  container.appendChild(node);
  setTimeout(() => {
    node.classList.add('fade-out');
    setTimeout(() => node.remove(), 320);
  }, duration);
}
