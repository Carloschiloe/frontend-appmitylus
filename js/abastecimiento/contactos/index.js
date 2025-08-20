// /js/abastecimiento/contactos/index.js
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  import('./debug-fetch.js').catch(() => {});
}

import { cargarCentros, cargarContactosGuardados } from './data.js';
import { setupBuscadorProveedores } from './proveedores.js';
import { setupFormulario, prepararNuevo } from './form-contacto.js';
import { initTablaContactos, renderTablaContactos } from './tabla.js';
import { initAsociacionContactos } from './asociar-empresa.js';

// Personas
import { initPersonasTab, renderTablaPersonas } from './personas.js';
import { initFiltrosYKPIsPersonas } from './filtros-kpis-personas.js';

// Visitas
import { setupFormularioVisita, initVisitasTab } from './visitas.js';

let booted = false;
let listenersHooked = false;
let visitasBooted = false;

/* ---------- UI init: tabs + modales (una sola vez, sin AutoInit) ---------- */
function initUIOnce() {
  if (!window.M) return;

  // Tabs
  const tabs = document.querySelectorAll('.tabs');
  if (tabs.length) M.Tabs.init(tabs, {});

  const cleanupOverlays = () => {
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    document.body.style.overflow = '';
  };

  // Modal Registrar Contacto
  const modalContactoEl = document.getElementById('modalContacto');
  if (modalContactoEl) {
    const inst = M.Modal.getInstance(modalContactoEl) || M.Modal.init(modalContactoEl, {
      onCloseEnd: () => { document.getElementById('formContacto')?.reset(); cleanupOverlays(); }
    });

    const openBtn = document.getElementById('btnOpenContactoModal');
    if (openBtn) openBtn.addEventListener('click', (e) => { e.preventDefault(); inst.open(); });

    const personaBtn = document.getElementById('btnOpenPersonaModal');
    if (personaBtn) personaBtn.addEventListener('click', (e) => {
      e.preventDefault(); try { prepararNuevo(); } catch {} (M.Modal.getInstance(modalContactoEl) || inst).open();
    });

    modalContactoEl.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); (M.Modal.getInstance(modalContactoEl) || inst).close(); });
    });
  }

  // Modal Detalle
  const modalDetalleEl = document.getElementById('modalDetalleContacto');
  if (modalDetalleEl) {
    M.Modal.getInstance(modalDetalleEl) || M.Modal.init(modalDetalleEl, { onCloseEnd: () => cleanupOverlays() });
  }

  // Modal Visita
  const modalVisitaEl = document.getElementById('modalVisita');
  if (modalVisitaEl) {
    M.Modal.getInstance(modalVisitaEl) || M.Modal.init(modalVisitaEl, { onCloseEnd: () => cleanupOverlays() });
  }

  // Modal Asociar Empresa
  const modalAsociarEl = document.getElementById('modalAsociar');
  if (modalAsociarEl) {
    M.Modal.getInstance(modalAsociarEl) || M.Modal.init(modalAsociarEl, { onCloseEnd: () => cleanupOverlays() });
  }

  window.addEventListener('hashchange', cleanupOverlays);

  // Lazy-load de Visitas al hacer click en la pestaña (si aún no se inicializa)
  const tabVisitas = document.querySelector('a[href="#tab-visitas"]');
  tabVisitas?.addEventListener('click', async () => {
    if (!visitasBooted) {
      try { await initVisitasTab(); visitasBooted = true; }
      catch (e) { console.error('[visitas] init (lazy) error', e); }
    }
  });
}

export async function initContactosTab(forceReload = false) {
  if (booted && !forceReload) return;

  try {
    initUIOnce();

    // Datos base
    await cargarCentros();
    await cargarContactosGuardados();

    // Wiring
    setupBuscadorProveedores();
    setupFormulario();
    setupFormularioVisita();   // prepara el modal de visitas

    // Tabla Contactos (Empresas)
    initTablaContactos();
    renderTablaContactos();

    // Personas
    if (document.getElementById('tab-personas')) {
      initFiltrosYKPIsPersonas();
      initPersonasTab();
    }

    // Visitas: inicialización directa
    try { await initVisitasTab(); visitasBooted = true; }
    catch (e) { console.warn('[visitas] init directo falló, se intentará al abrir la pestaña', e?.message || e); }

    initAsociacionContactos();
    hookGlobalListeners();

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

  // 🔁 Cuando se cree una visita, recarga la tabla de visitas
  window.addEventListener('visita:created', async () => {
    try { await initVisitasTab(true); visitasBooted = true; }
    catch (e) { console.error('[visitas] reload tras crear', e); }
  });

  listenersHooked = true;
}

document.addEventListener('DOMContentLoaded', () => {
  initContactosTab().catch(console.error);
});
