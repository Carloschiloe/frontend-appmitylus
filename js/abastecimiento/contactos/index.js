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
import { setupFormularioVisita, initVisitasTab } from '../visitas/tab.js';

let booted = false;
let listenersHooked = false;
let visitasBooted = false;
let personasBooted = false;

/* =======================
   DataTables defaults (global)
   ======================= */
function setDTDefaults() {
  const $ = window.jQuery || window.$;
  if (!$ || !$.fn || !$.fn.dataTable) return;

  // Evita el scroll horizontal por defecto y mejora el ajuste de columnas
  $.extend(true, $.fn.dataTable.defaults, {
    scrollX: false,
    autoWidth: false,
    responsive: true,          // que pueda reordenar/ocultar si hace falta
    deferRender: true
  });

  // Manejo de errores silencioso en consola
  $.fn.dataTable.ext.errMode = 'none';
}

/* Utils: ajustar columnas si la tabla existe */
function adjustDT(selector) {
  const jq = window.jQuery || window.$;
  if (jq && jq.fn && jq.fn.DataTable && jq(selector).length) {
    try {
      const dt = jq(selector).DataTable();
      // pequeño delay asegura que el tab ya quedó visible
      setTimeout(() => dt.columns.adjust().draw(false), 0);
    } catch {}
  }
}

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
      e.preventDefault();
      try { prepararNuevo(); } catch {}
      (M.Modal.getInstance(modalContactoEl) || inst).open();
    });

    modalContactoEl.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        (M.Modal.getInstance(modalContactoEl) || inst).close();
      });
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

  // --- Lazy-load de VISITAS al hacer click en la pestaña
  const tabVisitas = document.querySelector('a[href="#tab-visitas"]');
  tabVisitas?.addEventListener('click', async () => {
    if (!visitasBooted) {
      try { await initVisitasTab(); visitasBooted = true; }
      catch (e) { console.error('[visitas] init (lazy) error', e); }
    }
    adjustDT('#tablaVisitas');
  });

  // --- Lazy-load de AGENDA (PERSONAS) al hacer click en la pestaña
  const tabPersonas = document.querySelector('a[href="#tab-personas"]');
  tabPersonas?.addEventListener('click', async () => {
    if (!personasBooted) {
      try {
        initFiltrosYKPIsPersonas();
        initPersonasTab();
        personasBooted = true;
      } catch (e) { console.error('[personas] init (lazy) error', e); }
    }
    adjustDT('#tablaPersonas');
  });

  // Ajuste opcional al volver a EMPRESAS
  const tabContactos = document.querySelector('a[href="#tab-contactos"]');
  tabContactos?.addEventListener('click', () => adjustDT('#tablaContactos'));
}

export async function initContactosTab(forceReload = false) {
  if (booted && !forceReload) return;

  try {
    // ⚙️ Asegura defaults de DataTables antes de crear cualquier tabla
    setDTDefaults();

    initUIOnce();

    // Datos base
    await cargarCentros();
    await cargarContactosGuardados();

    // Wiring
    setupBuscadorProveedores();
    setupFormulario();
    setupFormularioVisita();   // prepara el modal de visitas

    // Tabla Contactos (Empresas) — esta pestaña sí se inicia visible
    initTablaContactos();
    renderTablaContactos();
    adjustDT('#tablaContactos');

    // Personas y Visitas se inicializan al abrir sus pestañas (lazy)
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
      adjustDT('#tablaContactos');
      if (personasBooted) adjustDT('#tablaPersonas');
    } catch (e) {
      console.error(e);
      M.toast?.({ html: 'No se pudo refrescar', classes: 'red' });
    }
  });

  // 🔁 Cuando se cree una visita, si la tabla ya está montada, recárgala y ajusta
  window.addEventListener('visita:created', async () => {
    if (visitasBooted) {
      try { await initVisitasTab(true); }  // recarga datos en el módulo de visitas
      catch (e) { console.error('[visitas] reload tras crear', e); }
      adjustDT('#tablaVisitas');
    }
  });

  // Ajuste en resize por seguridad
  window.addEventListener('resize', () => {
    adjustDT('#tablaContactos');
    if (visitasBooted)  adjustDT('#tablaVisitas');
    if (personasBooted) adjustDT('#tablaPersonas');
  });

  listenersHooked = true;
}

document.addEventListener('DOMContentLoaded', () => {
  initContactosTab().catch(console.error);
});



