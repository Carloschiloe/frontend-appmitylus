// /js/abastecimiento/contactos/ui-init.js
import { getModalInstance } from './ui-common.js';

export function ensureMuestreoPortals() {
  const muModal = document.getElementById('modalMuestreo');
  if (muModal && muModal.parentElement !== document.body) {
    document.body.appendChild(muModal);
  }
  const muSide = document.getElementById('modalMuestreoItems');
  if (muSide && muSide.parentElement !== document.body) {
    document.body.appendChild(muSide);
  }
  // modalTrato también necesita estar en body para evitar
  // conflictos de stacking context con <main> (mismo patrón que los de muestreo)
  const tratoModal = document.getElementById('modalTrato');
  if (tratoModal && tratoModal.parentElement !== document.body) {
    document.body.appendChild(tratoModal);
  }
}

export function initContactosTabs({ onVisitas, onPersonas, onMuestreos, onContactos, onCalendario, onAny }) {
  // ── Tabs principales (data-c-tab) ──────────────────────────────────────────
  document.querySelectorAll('[data-c-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-c-tab');
      document.querySelectorAll('.c-panel').forEach((p) => p.classList.remove('active'));
      document.querySelectorAll('[data-c-tab]').forEach((b) => b.classList.remove('active'));
      document.getElementById(target)?.classList.add('active');
      btn.classList.add('active');
      if (target === 'tab-interacciones') onVisitas?.();
      if (target === 'tab-directorio') onContactos?.();
      if (target === 'tab-calendario') onCalendario?.();
      if (target === 'tab-muestreos') onMuestreos?.();
      onAny?.();
    });
  });

  // ── Sub-tabs de Directorio (data-dir-tab) ─────────────────────────────────
  document.querySelectorAll('[data-dir-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-dir-tab');
      document.querySelectorAll('#tab-directorio .c-sub-panel').forEach((p) => p.classList.remove('active'));
      document.querySelectorAll('[data-dir-tab]').forEach((b) => b.classList.remove('active'));
      const subId = target === 'dir-empresas' ? 'tab-contactos' : 'tab-personas';
      document.getElementById(subId)?.classList.add('active');
      btn.classList.add('active');
      if (target === 'dir-personas') onPersonas?.();
      if (target === 'dir-empresas') onContactos?.();
      onAny?.();
    });
  });

  // ── Sub-tabs de Interacciones (data-inter-tab) ────────────────────────────
  document.querySelectorAll('[data-inter-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-inter-tab');
      document.querySelectorAll('#tab-interacciones .c-sub-panel').forEach((p) => p.classList.remove('active'));
      document.querySelectorAll('[data-inter-tab]').forEach((b) => b.classList.remove('active'));
      document.getElementById(target)?.classList.add('active');
      btn.classList.add('active');
      if (target === 'inter-visitas') onVisitas?.();
      onAny?.();
    });
  });
}

export function initContactosModals({
  onCleanup,
  onResetContactoExtras,
  onPrepararNuevo,
  onMuestreoClose
}) {
  if (!window.M) return;

  const initModal = (id, opts) => getModalInstance(id, opts || {});

  const modalContactoEl = document.getElementById('modalContacto');
  if (modalContactoEl) {
    // Delegación de eventos para Pestañas (Tabs Premium) - Más robusto
    modalContactoEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.am-tab-btn');
      if (!btn) return;
      
      const targetId = btn.getAttribute('data-tab');
      if (!targetId) return;

      // Desactivar todos los botones y paneles dentro de ESTE modal
      modalContactoEl.querySelectorAll('.am-tab-btn').forEach(b => b.classList.remove('active'));
      modalContactoEl.querySelectorAll('.am-panel-view').forEach(p => p.classList.remove('active'));

      // Activar el seleccionado
      btn.classList.add('active');
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add('active');
    });

    const inst = initModal('modalContacto', {
      onOpenStart: () => {
        // Asegurar que siempre inicie en la primera pestaña
        modalContactoEl.querySelectorAll('.am-tab-btn').forEach(b => b.classList.remove('active'));
        modalContactoEl.querySelectorAll('.am-panel-view').forEach(p => p.classList.remove('active'));
        modalContactoEl.querySelector('.am-tab-btn[data-tab="tabGeneral"]')?.classList.add('active');
        document.getElementById('tabGeneral')?.classList.add('active');
      },
      onCloseEnd: () => {
        try { document.getElementById('formContacto')?.reset(); } catch {}
        onResetContactoExtras?.();
        try { onPrepararNuevo?.(); } catch {}
        
        M.updateTextFields?.();
        onCleanup?.();
      }
    });

    const openModalContacto = (e) => {
      e?.preventDefault?.();
      try { onPrepararNuevo?.(); } catch {}
      try { document.getElementById('formContacto')?.reset(); } catch {}
      onResetContactoExtras?.();
      M.updateTextFields?.();
      inst?.open();
    };

    // Permite abrir el modal desde otros módulos sin depender de botones "fantasma"
    if (modalContactoEl.dataset.openEvtBound !== '1') {
      modalContactoEl.dataset.openEvtBound = '1';
      document.addEventListener('mmpp:open-contacto-modal', openModalContacto);
    }

    modalContactoEl.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        inst?.close();
      });
    });
  }

  const modalConfigs = {
    modalMuestreo: {
      onCloseEnd: () => {
        onMuestreoClose?.();
        onCleanup?.();
      },
      startingTop: '4%',
      endingTop: '6%'
    },
    modalMuestreoItems: {
      onCloseEnd: onCleanup,
      opacity: 0,
      dismissible: false,
      startingTop: '4%',
      endingTop: '6%'
    }
  };

  ['modalDetalleContacto', 'modalVisita', 'modalAsociar', 'modalMuestreo', 'modalMuestreoItems', 'modalMuInfo', 'modalMuRechazo', 'modalTrato'].forEach((id) => {
    const opts = modalConfigs[id] || { onCloseEnd: onCleanup };
    initModal(id, opts);
  });
}
