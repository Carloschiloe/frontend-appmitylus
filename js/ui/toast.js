// js/ui/toast.js
// Toast unificado Mitynex Core (mx-)

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function getContainer() {
  let container = document.getElementById('mx-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'mx-toast-container';
    container.className = 'mx-toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function getIcon(variant) {
  if (variant === 'success') return '<i class="bi bi-check-circle-fill"></i>';
  if (variant === 'warning') return '<i class="bi bi-exclamation-triangle-fill"></i>';
  if (variant === 'danger' || variant === 'error') return '<i class="bi bi-x-circle-fill"></i>';
  return '<i class="bi bi-info-circle-fill"></i>';
}

/**
 * Muestra una notificación flotante.
 * @param {string} text 
 * @param {{variant?: 'info'|'success'|'warning'|'danger'|'error', durationMs?: number}} opts 
 */
export function toast(text, opts = {}) {
  const msg = String(text ?? '').trim();
  if (!msg) return;

  const variant = opts.variant || 'info';
  const durationMs = clamp(Number(opts.durationMs || 3500), 1000, 10000);
  const container = getContainer();

  const el = document.createElement('div');
  el.className = `mx-toast mx-toast-${variant === 'error' ? 'danger' : variant}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  
  el.innerHTML = `
    <span class="mx-toast-icon">${getIcon(variant)}</span>
    <span class="mx-toast-text">${msg}</span>
  `;

  container.appendChild(el);

  // Auto-remove
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px) scale(0.95)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}
