// js/ui/toast.js
// Toast moderno (sin Materialize). Texto plano por defecto para evitar XSS.

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function getVariantColor(variant) {
  const v = String(variant || 'info').toLowerCase();
  if (v === 'success') return '#059669';
  if (v === 'warning') return '#d97706';
  if (v === 'danger' || v === 'error') return '#dc2626';
  return '#1e293b';
}

/**
 * @param {string} text
 * @param {{variant?: 'info'|'success'|'warning'|'danger'|'error', durationMs?: number}} opts
 */
export function toast(text, opts = {}) {
  const msg = String(text ?? '').trim();
  if (!msg) return;

  const variant = opts.variant || 'info';
  const bg = getVariantColor(variant);
  const durationMs = clamp(Number(opts.durationMs || 2600), 900, 8000);

  document.querySelectorAll('[data-am-toast]').forEach((n) => n.remove());

  const el = document.createElement('div');
  el.dataset.amToast = '1';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = msg;

  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:24px',
    'transform:translateX(-50%)',
    `background:${bg}`,
    'color:#fff',
    'padding:10px 16px',
    'border-radius:12px',
    'font-size:14px',
    'font-weight:800',
    'z-index:10060',
    'box-shadow:0 10px 30px rgba(0,0,0,.22)',
    'max-width:min(720px, 92vw)',
    'text-align:center',
    'white-space:pre-wrap',
    'animation:fadeInUp .16s ease',
  ].join(';');

  document.body.appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}

