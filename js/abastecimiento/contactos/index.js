// Evita romper el build en Vercel
try {
  if (typeof window !== 'undefined' &&
      (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    import('./debug-fetch.js').catch(() => {});
  }
} catch {}

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

/* ======================= DataTables defaults ======================= */
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

function adjustDT(selector) {
  const jq = window.jQuery || window.$;
  if (jq && jq.fn && jq.fn.DataTable && jq(selector).length) {
    try {
      const dt = jq(selector).DataTable();
      setTimeout(() => dt.columns.adjust().draw(false), 0);
    } catch {}
  }
}

/* ---------------- UI: tabs + modales (una sola vez) ---------------- */
function initUIOnce() {
  if (!window.M) return;

  // Tabs (onShow para lazy-load)
  const tabs = document.querySelectorAll('.tabs');
  if (tabs.length) {
    M.Tabs.init(tabs, {
      onShow: (tabEl) => {
        const id = (tabEl?.id || '').toLowerCase();
        if (id.includes('visita')) {
          if (!visitasBooted) { initVisitasTab().catch(()=>{}); visitasBooted = true; }
          adjustDT('#tablaVisitas');
        }
        if (id.includes('persona')) {
          if (!personasBooted) {
            initFiltrosYKPIsPersonas();
            initPersonasTab();
            personasBooted = true;
          }
          adjustDT('#tablaPersonas');
        }
        if (id.includes('contacto')) adjustDT('#tablaContactos');
      }
    });
  }

  // Limpia overlays de Materialize al cerrar modales o cambiar hash
  const cleanupOverlays = () => {
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    document.body.style.overflow = '';
  };

  // Modal Registrar Contacto / Persona
  const modalContactoEl = document.getElementById('modalContacto');
  if (modalContactoEl) {
    const inst = M.Modal.getInstance(modalContactoEl) || M.Modal.init(modalContactoEl, {
      onCloseEnd: () => { document.getElementById('formContacto')?.reset(); cleanupOverlays(); }
    });
    document.getElementById('btnOpenContactoModal')
      ?.addEventListener('click', (e) => { e.preventDefault(); inst.open(); });
    document.getElementById('btnOpenPersonaModal')
      ?.addEventListener('click', (e) => { e.preventDefault(); try { prepararNuevo(); } catch{}; inst.open(); });
    modalContactoEl.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); inst.close(); });
    });
  }

  // Otros modales
  ['modalDetalleContacto','modalVisita','modalAsociar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) M.Modal.getInstance(el) || M.Modal.init(el, { onCloseEnd: cleanupOverlays });
  });

  window.addEventListener('hashchange', cleanupOverlays);

  // Click directo en tabs (por si no corre onShow)
  document.querySelector('a[href="#tab-visitas"], a[href="#visitas"]')
    ?.addEventListener('click', async () => {
      if (!visitasBooted) { await initVisitasTab().catch(()=>{}); visitasBooted = true; }
      adjustDT('#tablaVisitas');
    });

  document.querySelector('a[href="#tab-personas"], a[href="#personas"]')
    ?.addEventListener('click', () => {
      if (!personasBooted) {
        initFiltrosYKPIsPersonas();
        initPersonasTab();
        personasBooted = true;
      }
      adjustDT('#tablaPersonas');
    });

  document.querySelector('a[href="#tab-contactos"], a[href="#contactos"]')
    ?.addEventListener('click', () => adjustDT('#tablaContactos'));
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
    setupFormularioVisita();

    // Tabla Contactos (tab por defecto)
    initTablaContactos();
    renderTablaContactos();
    adjustDT('#tablaContactos');

    // Asociación y listeners globales
    initAsociacionContactos();
    hookGlobalListeners();

    // Navegación directa por hash
    const h = (location.hash || '').toLowerCase();
    if (h === '#tab-visitas' || h === '#visitas') {
      await initVisitasTab().catch(()=>{});
      visitasBooted = true;
      adjustDT('#tablaVisitas');
    } else if (h === '#tab-personas' || h === '#personas') {
      initFiltrosYKPIsPersonas();
      initPersonasTab();
      personasBooted = true;
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

  window.addEventListener('visita:created', async () => {
    if (visitasBooted) {
      try { await initVisitasTab(true); } catch {}
      adjustDT('#tablaVisitas');
    }
  });

  window.addEventListener('resize', () => {
    adjustDT('#tablaContactos');
    if (visitasBooted)  adjustDT('#tablaVisitas');
    if (personasBooted) adjustDT('#tablaPersonas');
  });

  listenersHooked = true;
}

// Arranque
document.addEventListener('DOMContentLoaded', () => {
  initContactosTab().catch(console.error);
});
