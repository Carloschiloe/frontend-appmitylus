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
}

export function initContactosTabs({ onVisitas, onPersonas, onMuestreos, onContactos, onAny }) {
  if (!window.M) return;
  const tabs = document.querySelectorAll('.tabs');
  if (!tabs.length) return;

  M.Tabs.init(tabs, {
    onShow: (tabEl) => {
      const id = (tabEl?.id || '').toLowerCase();
      if (id.includes('visita')) onVisitas?.();
      if (id.includes('persona')) onPersonas?.();
      if (id.includes('muestreo')) onMuestreos?.();
      if (id.includes('contacto')) onContactos?.();
      onAny?.();
    }
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

    document.getElementById('btnOpenContactoModal')?.addEventListener('click', openModalContacto);
    document.getElementById('btnOpenPersonaModal')?.addEventListener('click', openModalContacto);

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

  ['modalDetalleContacto', 'modalVisita', 'modalAsociar', 'modalMuestreo', 'modalMuestreoItems', 'modalMuInfo', 'modalMuRechazo'].forEach((id) => {
    const opts = modalConfigs[id] || { onCloseEnd: onCleanup };
    initModal(id, opts);
  });
}
