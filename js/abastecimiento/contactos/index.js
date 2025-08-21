// /js/abastecimiento/contactos/index.js

// ⚠️ Guard: este bloque solo corre en navegador (evita crash en Vercel/SSR)
try {
  if (
    typeof window !== 'undefined' &&
    typeof window.location !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    import('./debug-fetch.js').catch(() => {});
  }
} catch (_) {}

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
  const $ = (typeof window !== 'undefined' && (window.jQuery || window.$)) || null;
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
  const jq = (typeof window !== 'undefined' && (window.jQuery || window.$)) || null;
  if (jq && jq.fn && jq.fn.DataTable && jq(selector).length) {
    try {
      const dt = jq(selector).DataTable();
      setTimeout(() => dt.columns.adjust().draw(false), 0);
    } catch {}
  }
}

/* ---------- UI init: tabs + modales (una sola vez, sin AutoInit) ---------- */
function initUIOnce() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

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
  try {
    const tabs = document.querySelectorAll('.tabs');
    if (tabs.length && window.M && window.M.Tabs) {
      window.M.Tabs.init(tabs, {
        onShow: (tabEl) => {
          const id = (tabEl?.id || '').toLowerCase();
          if (id.includes('visita'))  ensureVisitas();
          if (id.includes('persona')) ensurePersonas();
        }
      });
    }
  } catch (e) { console.warn('[contactos] init tabs', e); }

  const cleanupOverlays = () => {
    try {
      document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
      document.body.style.overflow = '';
    } catch {}
  };

  // Modal Registrar Contacto
  try {
    const modalContactoEl = document.getElementById('modalContacto');
    if (modalContactoEl && window.M && window.M.Modal) {
      const inst = window.M.Modal.getInstance(modalContactoEl) || window.M.Modal.init(modalContactoEl, {
        onCloseEnd: () => { document.getElementById('formContacto')?.reset(); cleanupOverlays(); }
      });

      document.getElementById('btnOpenContactoModal')
        ?.addEventListener('click', (e) => { e.preventDefault(); inst.open(); });

      document.getElementById('btnOpenPersonaModal')
        ?.addEventListener('click', (e) => {
          e.preventDefault();
          try { prepararNuevo(); } catch {}
          (window.M.Modal.getInstance(modalContactoEl) || inst).open();
        });

      modalContactoEl.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          (window.M.Modal.getInstance(modalContactoEl) || inst).close();
        });
      });
    }
  } catch (e) { console.warn('[contactos] modal contacto', e); }

  // Modal Detalle
  try {
    const modalDetalleEl = document.getElementById('modalDetalleContacto');
    if (modalDetalleEl && window.M && window.M.Modal) {
      window.M.Modal.getInstance(modalDetalleEl) || window.M.Modal.init(modalDetalleEl, { onCloseEnd: () => cleanupOverlays() });
    }
  } catch {}

  // Modal Visita
  try {
    const modalVisitaEl = document.getElementById('modalVisita');
    if (modalVisitaEl && window.M && window.M.Modal) {
      window.M.Modal.getInstance(modalVisitaEl) || window.M.Modal.init(modalVisitaEl, { onCloseEnd: () => cleanupOverlays() });
    }
  } catch {}

  // Modal Asociar Empresa
  try {
    const modalAsociarEl = document.getElementById('modalAsociar');
    if (modalAsociarEl && window.M && window.M.Modal) {
      window.M.Modal.getInstance(modalAsociarEl) || window.M.Modal.init(modalAsociarEl, { onCloseEnd: () => cleanupOverlays() });
    }
  } catch {}

  window.addEventListener('hashchange', cleanupOverlays);

  /* ---- VISITAS: init al hacer clic en el tab (soporta #tab-visitas y #visitas) ---- */
  try {
    const tabVisitas = document.querySelector('a[href="#tab-visitas"], a[href="#visitas"]');
    tabVisitas?.addEventListener('click', ensureVisitas);
  } catch {}

  /* ---- PERSONAS: init al hacer clic en el tab ---- */
  try {
    const tabPersonas = document.querySelector('a[href="#tab-personas"], a[href="#personas"]');
    tabPersonas?.addEventListener('click', ensurePersonas);
  } catch {}

  /* ---- Ajuste al volver a EMPRESAS ---- */
  try {
    const tabContactos = document.querySelector('a[href="#tab-contactos"], a[href="#contactos"]');
    tabContactos?.addEventListener('click', () => adjustDT('#tablaContactos'));
  } catch {}

  /* ---- Watcher: si #tablaVisitas aparece en el DOM, inicializa automáticamente ---- */
  try {
    if (typeof MutationObserver !== 'undefined') {
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
  } catch (e) { console.warn('[contactos] MO', e); }
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
    if (typeof window !== 'undefined') {
      const h = (window.location?.hash || '').toLowerCase();
      if (h === '#tab-visitas' || h === '#visitas') {
        try { await initVisitasTab(); visitasBooted = true; }
        catch (e) { console.warn('[visitas] direct-hash init', e); }
        adjustDT('#tablaVisitas');
      } else if (h === '#tab-personas' || h === '#personas') {
        try { initFiltrosYKPIsPersonas(); initPersonasTab(); personasBooted = true; }
        catch (e) { console.warn('[personas] direct-hash init', e); }
        adjustDT('#tablaPersonas');
      }
    }

    booted = true;
  } catch (err) {
    console.error('[contactos] init error', err);
    if (typeof window !== 'undefined') window.M?.toast?.({ html: 'No se pudo inicializar', classes: 'red' });
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
      window.M?.toast?.({ html: 'No se pudo refrescar', classes: 'red' });
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
