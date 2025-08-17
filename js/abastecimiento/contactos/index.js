// /js/contactos/index.js
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  import('./debug-fetch.js').catch(() => {});
}

import { cargarCentros, cargarContactosGuardados } from './data.js';
import { setupBuscadorProveedores } from './proveedores.js';
import { setupFormulario } from './form-contacto.js';
import { setupFormularioVisita } from './visitas.js';
import { initTablaContactos, renderTablaContactos } from './tabla.js';

import { initAsociacionContactos } from './asociar-empresa.js';

// Personas (separado)
import { initPersonasTab, renderTablaPersonas } from './personas.js';
import { initFiltrosYKPIsPersonas } from './filtros-kpis-personas.js';

let booted = false, listenersHooked = false;

export async function initContactosTab(forceReload = false) {
  if (booted && !forceReload) return;
  try {
    if (window.M && M.AutoInit) M.AutoInit();

    await cargarCentros();
    await cargarContactosGuardados();

    setupBuscadorProveedores();
    setupFormulario();
    setupFormularioVisita();

    // CONTACTOS (sin KPIs/chips de empresa)
    initTablaContactos();
    renderTablaContactos();

    // PERSONAS (con KPIs/chips)
    if (document.getElementById('tab-personas')) {
      initFiltrosYKPIsPersonas();
      initPersonasTab();
    }

    initAsociacionContactos();
    hookGlobalListeners();

    // 👇 Parche: asegurar que el modal de contacto cierre siempre
    fixModalClose();

    booted = true;
  } catch (err) {
    console.error('[contactos] init error', err);
    M.toast?.({ html: 'No se pudo inicializar', classes: 'red' });
  }
}

function hookGlobalListeners() {
  if (listenersHooked) return;
  document.addEventListener('filtro-personas-changed', () => renderTablaPersonas?.());
  document.addEventListener('reload-tabla-contactos', async () => {
    try {
      await cargarContactosGuardados();
      renderTablaContactos();
      renderTablaPersonas?.();
    } catch (e) {
      console.error(e);
      M.toast?.({ html: 'No se pudo refrescar', classes: 'red' });
    }
  });
  listenersHooked = true;
}

// ------- Parche: forzar cierre del modal de contacto -------
function fixModalClose() {
  const modalEl = document.getElementById('modalContacto');
  if (!modalEl || !window.M || !M.Modal) return;

  // crea/recupera instancia (idempotente)
  let inst = M.Modal.getInstance(modalEl) || M.Modal.init(modalEl, {
    onCloseEnd: () => document.getElementById('formContacto')?.reset()
  });

  // asegura que cualquier .modal-close lo cierre
  modalEl.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      try { (M.Modal.getInstance(modalEl) || inst).close(); } catch {}
    });
  });

  // por si abres el modal con el botón superior
  const openBtn = document.getElementById('btnOpenContactoModal');
  if (openBtn) openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    (M.Modal.getInstance(modalEl) || inst).open();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initContactosTab().catch(console.error);
});
