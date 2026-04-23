// js/ui/am-modal.js
// Controlador de modales "am-modal" usando el CSS en base-ui.css (.am-modal-overlay + .am-modal)

const stateByModal = new WeakMap();

function getFocusable(modalEl) {
  return (
    modalEl.querySelector('[autofocus]') ||
    modalEl.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  );
}

function ensureState(modalEl) {
  const prev = stateByModal.get(modalEl);
  if (prev) return prev;
  const next = { isOpen: false, overlay: null, lastActive: null, escHandler: null };
  stateByModal.set(modalEl, next);
  return next;
}

export function closeAmModal(modalEl) {
  if (!modalEl) return;
  const st = ensureState(modalEl);
  if (!st.isOpen) return;
  st.isOpen = false;

  try { st.overlay?.remove?.(); } catch {}
  st.overlay = null;

  document.body.style.overflow = '';
  
  // Liberar el foco si está dentro del modal para evitar advertencias de accesibilidad (aria-hidden)
  if (modalEl.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  modalEl.setAttribute('aria-hidden', 'true');

  if (st.escHandler) {
    document.removeEventListener('keydown', st.escHandler);
    st.escHandler = null;
  }

  try { st.lastActive?.focus?.(); } catch {}
  st.lastActive = null;
}

/**
 * @param {HTMLElement} modalEl Elemento con clase .am-modal
 * @param {{dismissible?: boolean}} opts
 */
export function openAmModal(modalEl, opts = {}) {
  if (!modalEl) return;
  const st = ensureState(modalEl);
  if (st.isOpen) return;

  st.isOpen = true;
  st.lastActive = document.activeElement;

  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-hidden', 'false');

  const overlay = document.createElement('div');
  overlay.className = 'am-modal-overlay';
  overlay.appendChild(modalEl);
  st.overlay = overlay;

  // Close buttons inside modal
  if (modalEl.dataset.amModalBound !== '1') {
    modalEl.dataset.amModalBound = '1';
    modalEl.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-am-modal-close], .modal-close');
      if (!btn) return;
      e.preventDefault();
      closeAmModal(modalEl);
    });
  }

  const dismissible = opts.dismissible !== false;
  overlay.addEventListener('mousedown', (e) => {
    if (!dismissible) return;
    if (e.target !== overlay) return;
    closeAmModal(modalEl);
  });

  st.escHandler = (e) => {
    if (e.key !== 'Escape') return;
    closeAmModal(modalEl);
  };
  document.addEventListener('keydown', st.escHandler);

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    try { getFocusable(modalEl)?.focus?.(); } catch {}
  }, 0);
}

