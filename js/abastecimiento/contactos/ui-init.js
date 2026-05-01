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
  const syncUrlHash = (targetId) => {
    if (!targetId) return;
    const nextHash = `#${String(targetId).replace(/^#/, '')}`;
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}${nextHash}`);
    } catch {
      try { location.hash = nextHash; } catch {}
    }
    try { window.dispatchEvent(new CustomEvent('mmpp:navigate', { detail: { hash: nextHash } })); } catch {}
  };

  const activateTabById = (targetId) => {
    if (!targetId) return;
    
    // 1. Limpiar todos los paneles y botones
    document.querySelectorAll('.mx-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('[data-c-tab]').forEach(b => b.classList.remove('active'));
    
    // 2. Activar el panel y botón objetivo
    const panel = document.getElementById(targetId);
    const btn = document.querySelector(`[data-c-tab="${targetId}"]`);
    
    if (panel) panel.classList.add('active');
    if (btn) btn.classList.add('active');
    
    // 3. Sincronizar URL
    syncUrlHash(targetId);
    
    // 4. Disparar callbacks
    if (targetId === 'tab-interacciones') onVisitas?.();
    if (targetId === 'tab-directorio') onContactos?.();
    if (targetId === 'tab-calendario') onCalendario?.();
    if (targetId === 'tab-muestreos') onMuestreos?.();
    onAny?.();
  };

  // ── Tabs principales (Delegación en contenedor) ──────────────────────────
  const mainTabs = document.getElementById('cMainTabs');
  if (mainTabs) {
    mainTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-c-tab]');
      if (!btn) return;
      activateTabById(btn.getAttribute('data-c-tab'));
    });
  } else {
    // Fallback manual si el ID no se encuentra
    document.querySelectorAll('[data-c-tab]').forEach((btn) => {
      btn.addEventListener('click', () => activateTabById(btn.getAttribute('data-c-tab')));
    });
  }

  // ── Sub-tabs de Directorio (data-dir-tab) ─────────────────────────────────
  document.querySelectorAll('[data-dir-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-dir-tab');
      document.querySelectorAll('#tab-directorio .mx-sub-panel').forEach((p) => p.classList.remove('active'));
      document.querySelectorAll('[data-dir-tab]').forEach((b) => b.classList.remove('active'));
      const subId = target === 'dir-empresas' ? 'tab-contactos' : 'tab-personas';
      document.getElementById(subId)?.classList.add('active');
      btn.classList.add('active');
      syncUrlHash('tab-directorio');
      if (target === 'dir-personas') onPersonas?.();
      if (target === 'dir-empresas') onContactos?.();
      onAny?.();
    });
  });

  // ── Sub-tabs de Interacciones (data-inter-tab) ────────────────────────────
  document.querySelectorAll('[data-inter-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-inter-tab');
      document.querySelectorAll('#tab-interacciones .mx-sub-panel').forEach((p) => p.classList.remove('active'));
      document.querySelectorAll('[data-inter-tab]').forEach((b) => b.classList.remove('active'));
      document.getElementById(target)?.classList.add('active');
      btn.classList.add('active');
      syncUrlHash('tab-interacciones');
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
        
        onCleanup?.();
      }
    });

    const openModalContacto = (e) => {
      e?.preventDefault?.();
      try { onPrepararNuevo?.(); } catch {}
      try { document.getElementById('formContacto')?.reset(); } catch {}
      onResetContactoExtras?.();
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

  ['modalDetalleContacto', 'modalVisita', 'modalAsociar', 'modalMuestreo', 'modalMuestreoItems', 'modalMuInfo', 'modalMuRechazo', 'modalTrato', 'modalMuResultado'].forEach((id) => {
    const opts = modalConfigs[id] || { onCloseEnd: onCleanup };
    const inst = initModal(id, opts);
    const root = document.getElementById(id);
    if (!root) return;
    if (root.dataset.modalCloseBound === '1') return;
    root.dataset.modalCloseBound = '1';
    root.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        inst?.close?.();
      });
    });
  });
}
