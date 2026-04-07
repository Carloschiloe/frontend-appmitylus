// /js/abastecimiento/contactos/ui-common.js

export const rafThrottle = (fn) => {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...args);
    });
  };
};

export const debounce = (fn, wait = 120) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function fetchJson(url, options = {}) {
  const resp = await fetch(url, { credentials: 'same-origin', ...options });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${text.slice(0, 200)}`);
  }
  if (resp.status === 204) return null;
  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return resp.json();
  const text = await resp.text().catch(() => '');
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function resolveModalTarget(target) {
  if (typeof target === 'string') return document.getElementById(target);
  if (target && target.nodeType === 1) return target;
  return null;
}

export function getModalInstance(target, opts = {}) {
  const el = resolveModalTarget(target);
  if (!(el && window.M?.Modal)) return null;
  return M.Modal.getInstance(el) || M.Modal.init(el, opts);
}

export function openModal(target, opts = {}) {
  const inst = getModalInstance(target, opts);
  inst?.open();
  return inst;
}

export function closeModal(target, opts = {}) {
  const inst = getModalInstance(target, opts);
  inst?.close();
  return inst;
}

export function isModalOpen(target) {
  const el = resolveModalTarget(target);
  if (!el) return false;
  const inst = window.M?.Modal ? M.Modal.getInstance(el) : null;
  return !!(inst?.isOpen || el.classList?.contains('open') || el.style?.display === 'block');
}

export function createModalConfirm({
  id = 'modalConfirm',
  className = 'modal app-modal',
  defaultTitle = 'Confirmar accion',
  defaultMessage = 'Deseas continuar?',
  cancelText = 'Volver',
  acceptText = 'Aceptar'
} = {}) {
  let resolveFn = null;

  function ensureModal() {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = className;
      el.innerHTML = `
        <div class="modal-content">
          <h6 data-role="confirm-title">${defaultTitle}</h6>
          <p data-role="confirm-message">${defaultMessage}</p>
        </div>
        <div class="modal-footer modal-actions">
          <button type="button" data-role="confirm-cancel" class="dash-btn">${cancelText}</button>
          <button type="button" data-role="confirm-accept" class="mmpp-add">${acceptText}</button>
        </div>
      `;
      document.body.appendChild(el);

      el.querySelector('[data-role="confirm-cancel"]')?.addEventListener('click', () => {
        resolveFn?.(false);
        resolveFn = null;
        getModalInstance(id)?.close();
      });
      el.querySelector('[data-role="confirm-accept"]')?.addEventListener('click', () => {
        resolveFn?.(true);
        resolveFn = null;
        getModalInstance(id)?.close();
      });
    }
    return getModalInstance(id, { dismissible: true });
  }

  return function askConfirm(title, message, acceptOverride = acceptText) {
    return new Promise((resolve) => {
      const inst = ensureModal();
      const root = document.getElementById(id);
      const t = root?.querySelector('[data-role="confirm-title"]');
      const m = root?.querySelector('[data-role="confirm-message"]');
      const y = root?.querySelector('[data-role="confirm-accept"]');
      if (t) t.textContent = title || defaultTitle;
      if (m) m.textContent = message || defaultMessage;
      if (y) y.textContent = acceptOverride || acceptText;
      resolveFn = resolve;
      inst?.open();
    });
  };
}
