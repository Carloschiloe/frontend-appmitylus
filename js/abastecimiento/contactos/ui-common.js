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

// ── Modal system (sin Materialize) ──────────────────────────────────────────────
const modalState = new WeakMap();
let openCount = 0;

function getFocusable(modalEl) {
  return (
    modalEl.querySelector('[autofocus]') ||
    modalEl.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  );
}

function ensureModalState(modalEl) {
  const prev = modalState.get(modalEl);
  if (prev) return prev;
  const next = {
    isOpen: false,
    overlayEl: null,
    lastActive: null,
    escHandler: null,
    opts: {}
  };
  modalState.set(modalEl, next);
  return next;
}

function shouldUseBackdrop(modalEl, opts) {
  if (opts?.backdrop === false) return false;
  // Side panel: NO backdrop por defecto (para no bloquear el modal principal)
  if (modalEl.classList?.contains('modal-muestreo-side')) return false;
  return true;
}

function lockBody() {
  openCount += 1;
  if (openCount === 1) document.body.style.overflow = 'hidden';
}

function unlockBody() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.body.style.overflow = '';
}

function openModalEl(modalEl, opts = {}) {
  const st = ensureModalState(modalEl);
  if (st.isOpen) return;

  st.opts = { ...opts };
  st.lastActive = document.activeElement;

  try { opts.onOpenStart?.(); } catch {}

  // Vincular cierre automático por clase .modal-close una sola vez por elemento
  if (modalEl.dataset.modalCloseBound !== '1') {
    modalEl.dataset.modalCloseBound = '1';
    modalEl.addEventListener('click', (e) => {
      if (e.target.closest('.modal-close')) {
        e.preventDefault();
        closeModalEl(modalEl);
      }
    });
  }

  modalEl.setAttribute('aria-hidden', 'false');
  modalEl.classList.add('open');
  st.isOpen = true;


  const dismissible = opts.dismissible !== false;

  if (shouldUseBackdrop(modalEl, opts)) {
    const overlay = document.createElement('div');
    overlay.className = 'am-modal-overlay';
    overlay.dataset.amModalOverlay = '1';
    // Importante: los modales `.modal.app-modal-modern` ya traen su propio z-index (ej: 1001).
    // El overlay debe quedar debajo del modal para no taparlo.
    try {
      const z = Number.parseInt(getComputedStyle(modalEl).zIndex || '', 10);
      overlay.style.zIndex = Number.isFinite(z) ? String(Math.max(0, z - 1)) : '1000';
    } catch {
      overlay.style.zIndex = '1000';
    }
    overlay.addEventListener('mousedown', (e) => {
      if (!dismissible) return;
      if (e.target !== overlay) return;
      closeModalEl(modalEl);
    });
    document.body.appendChild(overlay);
    st.overlayEl = overlay;
  }

  st.escHandler = (e) => {
    if (!dismissible) return;
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    closeModalEl(modalEl);
  };
  document.addEventListener('keydown', st.escHandler);

  lockBody();

  setTimeout(() => {
    try { getFocusable(modalEl)?.focus?.(); } catch {}
    try { opts.onOpenEnd?.(); } catch {}
  }, 0);
}

function closeModalEl(modalEl) {
  const st = ensureModalState(modalEl);
  if (!st.isOpen) return;

  const opts = st.opts || {};
  try { opts.onCloseStart?.(); } catch {}

  st.isOpen = false;
  
  // Liberar el foco si está dentro del modal para evitar advertencias de accesibilidad (aria-hidden)
  if (modalEl.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  modalEl.classList.remove('open');
  modalEl.setAttribute('aria-hidden', 'true');

  try { st.overlayEl?.remove?.(); } catch {}
  st.overlayEl = null;

  if (st.escHandler) {
    document.removeEventListener('keydown', st.escHandler);
    st.escHandler = null;
  }

  unlockBody();

  try { st.lastActive?.focus?.(); } catch {}
  st.lastActive = null;

  try { opts.onCloseEnd?.(); } catch {}
}

export function getModalInstance(target, opts = {}) {
  const el = resolveModalTarget(target);
  if (!el) return null;
  const st = ensureModalState(el);
  st.opts = { ...st.opts, ...opts };
  return {
    open: () => openModalEl(el, st.opts),
    close: () => closeModalEl(el),
    get isOpen() { return !!ensureModalState(el).isOpen; }
  };
}

export function openModal(target, opts = {}) {
  const inst = getModalInstance(target, opts);
  inst?.open?.();
  return inst;
}

export function closeModal(target) {
  const el = resolveModalTarget(target);
  if (!el) return null;
  closeModalEl(el);
  return { close: () => closeModalEl(el) };
}

export function isModalOpen(target) {
  const el = resolveModalTarget(target);
  if (!el) return false;
  return !!ensureModalState(el).isOpen;
}

export function createModalConfirm({
  id = 'modalConfirm',
  className = 'modal app-modal-modern',
  defaultTitle = 'Confirmar acción',
  defaultMessage = '¿Deseas continuar?',
  cancelText = 'Cancelar',
  acceptText = 'Aceptar'
} = {}) {
  let resolveFn = null;

  function ensureModal() {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = className;
      el.style.width = '420px';
      el.innerHTML = `
        <div class="app-modal-header">
          <div class="app-modal-header-top">
            <h5 data-role="confirm-title">${defaultTitle}</h5>
          </div>
        </div>
        <div class="app-modal-body">
          <p data-role="confirm-message" style="margin:0;color:#475569;font-size:14px;">${defaultMessage}</p>
        </div>
        <div class="app-modal-footer">
          <button type="button" data-role="confirm-cancel" class="am-btn am-btn-flat">${cancelText}</button>
          <button type="button" data-role="confirm-accept" class="am-btn am-btn-primary">${acceptText}</button>
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
