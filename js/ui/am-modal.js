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

/**
 * Crea un diálogo de confirmación dinámico usando el sistema mx-modal.
 * @returns {Function} (title, message, acceptLabel) => Promise<boolean>
 */
export function createMxConfirm({
  id = 'mxConfirm',
  defaultTitle = 'Confirmar acción',
  defaultMessage = '¿Deseas continuar con esta operación?',
  cancelLabel = 'Cancelar',
  acceptLabel = 'Aceptar'
} = {}) {
  let resolveFn = null;

  function ensureModal() {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'mx-modal-overlay';
      el.style.display = 'none';
      el.innerHTML = `
        <div class="mx-modal" style="max-width: 400px;">
          <div class="mx-modal-head">
            <h3 data-role="confirm-title">${defaultTitle}</h3>
          </div>
          <div class="mx-modal-body">
            <p data-role="confirm-message" style="margin:0; color:var(--color-text-muted); font-size:14px; line-height:1.5;">${defaultMessage}</p>
          </div>
          <div class="mx-modal-foot">
            <button type="button" data-role="confirm-cancel" class="mx-btn mx-btn-outline">${cancelLabel}</button>
            <button type="button" data-role="confirm-accept" class="mx-btn mx-btn-primary">${acceptLabel}</button>
          </div>
        </div>
      `;
      document.body.appendChild(el);

      el.querySelector('[data-role="confirm-cancel"]').addEventListener('click', () => {
        resolveFn?.(false);
        el.style.display = 'none';
        document.body.style.overflow = '';
      });

      el.querySelector('[data-role="confirm-accept"]').addEventListener('click', () => {
        resolveFn?.(true);
        el.style.display = 'none';
        document.body.style.overflow = '';
      });
    }
    return el;
  }

  return function ask(title, message, okLabel) {
    return new Promise((resolve) => {
      const el = ensureModal();
      el.querySelector('[data-role="confirm-title"]').textContent = title || defaultTitle;
      el.querySelector('[data-role="confirm-message"]').textContent = message || defaultMessage;
      el.querySelector('[data-role="confirm-accept"]').textContent = okLabel || acceptLabel;
      resolveFn = resolve;
      el.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  };
}
