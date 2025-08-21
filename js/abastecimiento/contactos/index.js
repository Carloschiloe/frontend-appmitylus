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

  $.extend(true, $.fn.dataTable.defaults, {
    scrollX: false,
    autoWidth: false,
    responsive: true,
    deferRender: true
  });

  $.fn.dataTable.ext.errMode = 'none';
}

/* Utils: ajustar columnas si la tabla existe */
function adjustDT(selector) {
  const jq = window.jQuery || window.$;
  if (jq && jq.fn && jq.fn.DataTable && jq(selector).length) {
    try {
      const dt = jq(selector).DataTable();
      setTimeout(() => dt.columns.adjust().draw(false), 0);
    } catch {}
  }
}

/* ---------- UI init: tabs + modales (una sola vez, sin AutoInit) ---------- */
function initUIOnce() {
  if (!window.M) return;

  // Helpers para iniciar cada tab cuando se muestra su panel
  const ensureVisitas = async () => {
    if (!visitasBooted) {
      try { await initVisitasTab(); visitasBooted = true; }
      catch (e) { console.error('[visitas] init onShow', e); }
    }
    adjustDT('#tablaVisitas');
  };
  const ensurePersonas = () => {
    if (!personasBooted) {
      try {
        initFiltrosYKPIsPersonas();
        initPersonasTab();
        personasBooted = true;
      } catch (e) { console.error('[personas] init onShow', e); }
    }
    adjustDT('#tablaPersonas');
  };

  // Tabs con onShow para cubrir cualquier href/id
  const tabs = document.querySelectorAll('.tabs');
  if (tabs.length) {
    M.Tabs.init(tabs, {
      onShow: (tabEl) => {
        const id = (tabEl?.id || '').toLowerCase();
        if (id.includes('visita'))  ensureVisitas();
        if (id.includes('persona')) ensurePersonas();
      }
    });
  }

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

    document.getElementById('btnOpenContactoModal')
      ?.addEventListener('click', (e) => { e.preventDefault(); inst.open(); });

    document.getElementById('btnOpenPersonaModal')
      ?.addEventListener('click', (e) => {
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

  /* ---- VISITAS: init al hacer clic en el tab (soporta #tab-visitas y #visitas) ---- */
  const tabVisitas = document.querySelector('a[href="#tab-visitas"], a[href="#visitas"]');
  tabVisitas?.addEventListener('click', ensureVisitas);

  /* ---- PERSONAS: init al hacer clic en el tab ---- */
  const tabPersonas = document.querySelector('a[href="#tab-personas"], a[href="#personas"]');
  tabPersonas?.addEventListener('click', ensurePersonas);

  /* ---- Ajuste al volver a EMPRESAS ---- */
  const tabContactos = document.querySelector('a[href="#tab-contactos"], a[href="#contactos"]');
  tabContactos?.addEventListener('click', () => adjustDT('#tablaContactos'));

  /* ---- Watcher: si #tablaVisitas aparece en el DOM, inicializa automáticamente ---- */
  const mo = new MutationObserver(() => {
    if (!visitasBooted && document.getElementById('tablaVisitas')) {
      initVisitasTab().then(() => {
        visitasBooted = true;
        adjustDT('#tablaVisitas');
      }).catch(e => console.warn('[visitas] init via MO', e));
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

export async function initContactosTab(forceReload = false) {
  if (booted && !forceReload) return;

  try {
    setDTDefaults();
    initUIOnce();

    // Datos base
    await cargarCentros();
    await cargarContactosGuardados();

    // Wiring base
    setupBuscadorProveedores();
    setupFormulario();
    setupFormularioVisita();   // prepara el modal de visitas

    // Tabla Contactos (Empresas)
    initTablaContactos();
    renderTablaContactos();
    adjustDT('#tablaContactos');

    // Personas y Visitas se inicializan al abrir sus pestañas (lazy)
    initAsociacionContactos();
    hookGlobalListeners();

    /* 🧭 Si entras directo con hash a Visitas/Personas, inicializa de inmediato */
    if (location.hash === '#tab-visitas' || location.hash === '#visitas') {
      try { await initVisitasTab(); visitasBooted = true; }
      catch (e) { console.warn('[visitas] direct-hash init', e); }
      adjustDT('#tablaVisitas');
    } else if (location.hash === '#tab-personas' || location.hash === '#personas') {
      try { initFiltrosYKPIsPersonas(); initPersonasTab(); personasBooted = true; }
      catch (e) { console.warn('[personas] direct-hash init', e); }
      adjustDT('#tablaPersonas');
    }

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
      try { await initVisitasTab(true); }  // recarga datos en Visitas
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
