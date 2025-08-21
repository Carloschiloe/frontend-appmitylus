// /js/abastecimiento/contactos/index.js

// Guard SSR para Vercel
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

const L = (...a) => console.log('%c[CONTACTOS]', 'color:#0ea5e9;font-weight:700', ...a);

/* =======================
   DataTables defaults (global)
   ======================= */
function setDTDefaults() {
  const $ = (typeof window !== 'undefined' && (window.jQuery || window.$)) || null;
  if (!$ || !$.fn || !$.fn.dataTable) { L('DataTables no disponible aún'); return; }

  $.extend(true, $.fn.dataTable.defaults, {
    scrollX: false,
    autoWidth: false,
    responsive: true,
    deferRender: true
  });

  $.fn.dataTable.ext.errMode = 'none';
  L('DataTables defaults configurados');
}

/* Utils: ajustar columnas si la tabla existe */
function adjustDT(selector) {
  const jq = (typeof window !== 'undefined' && (window.jQuery || window.$)) || null;
  if (jq && jq.fn && jq.fn.DataTable && jq(selector).length) {
    try {
      const dt = jq(selector).DataTable();
      setTimeout(() => { dt.columns.adjust().draw(false); L('Ajuste columnas', selector); }, 0);
    } catch (e) { L('Ajuste columnas error', selector, e); }
  }
}

/* ---------- UI init: tabs + modales (una sola vez) ---------- */
function initUIOnce() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const ensureVisitas = async () => {
    L('ensureVisitas() disparado. visitasBooted=', visitasBooted, 'tabla?', !!document.getElementById('tablaVisitas'));
    if (!visitasBooted) {
      try { await initVisitasTab(); visitasBooted = true; L('Visitas INIT OK'); }
      catch (e) { console.error('[CONTACTOS] initVisitasTab onShow', e); }
    }
    adjustDT('#tablaVisitas');
  };
  const ensurePersonas = () => {
    L('ensurePersonas() disparado. personasBooted=', personasBooted);
    if (!personasBooted) {
      try {
        initFiltrosYKPIsPersonas();
        initPersonasTab();
        personasBooted = true;
        L('Personas INIT OK');
      } catch (e) { console.error('[CONTACTOS] initPersonasTab onShow', e); }
    }
    adjustDT('#tablaPersonas');
  };

  // Tabs con onShow para cubrir cualquier href/id
  try {
    const tabs = document.querySelectorAll('.tabs');
    if (tabs.length && window.M?.Tabs) {
      L('Inicializando Tabs (Materialize) con onShow');
      window.M.Tabs.init(tabs, {
        onShow: (tabEl) => {
          const id = (tabEl?.id || '').toLowerCase();
          L('onShow ->', id);
          if (id.includes('visita'))  ensureVisitas();
          if (id.includes('persona')) ensurePersonas();
        }
      });
    } else {
      L('Tabs no inicializados (no hay .tabs o M.Tabs)');
    }
  } catch (e) { L('Error iniciando Tabs', e); }

  const cleanupOverlays = () => {
    try {
      document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
      document.body.style.overflow = '';
      L('cleanupOverlays()');
    } catch {}
  };

  // Modal Registrar Contacto
  try {
    const modalContactoEl = document.getElementById('modalContacto');
    if (modalContactoEl && window.M?.Modal) {
      const inst = window.M.Modal.getInstance(modalContactoEl) || window.M.Modal.init(modalContactoEl, {
        onCloseEnd: () => { document.getElementById('formContacto')?.reset(); cleanupOverlays(); }
      });

      document.getElementById('btnOpenContactoModal')
        ?.addEventListener('click', (e) => { e.preventDefault(); inst.open(); L('Abrir modal contacto'); });

      document.getElementById('btnOpenPersonaModal')
        ?.addEventListener('click', (e) => {
          e.preventDefault();
          try { prepararNuevo(); } catch {}
          (window.M.Modal.getInstance(modalContactoEl) || inst).open();
          L('Abrir modal persona');
        });

      modalContactoEl.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          (window.M.Modal.getInstance(modalContactoEl) || inst).close();
          L('Cerrar modal contacto/persona');
        });
      });
    }
  } catch (e) { L('modal contacto error', e); }

  // Modal Detalle
  try {
    const el = document.getElementById('modalDetalleContacto');
    if (el && window.M?.Modal) window.M.Modal.getInstance(el) || window.M.Modal.init(el, { onCloseEnd: cleanupOverlays });
  } catch {}

  // Modal Visita
  try {
    const el = document.getElementById('modalVisita');
    if (el && window.M?.Modal) window.M.Modal.getInstance(el) || window.M.Modal.init(el, { onCloseEnd: cleanupOverlays });
  } catch {}

  // Modal Asociar Empresa
  try {
    const el = document.getElementById('modalAsociar');
    if (el && window.M?.Modal) window.M.Modal.getInstance(el) || window.M.Modal.init(el, { onCloseEnd: cleanupOverlays });
  } catch {}

  window.addEventListener('hashchange', cleanupOverlays);

  // Click explícito en tabs (por si onShow no corre)
  try {
    const tabVisitas = document.querySelector('a[href="#tab-visitas"], a[href="#visitas"]');
    tabVisitas?.addEventListener('click', () => { L('click TAB Visitas'); ensureVisitas(); });

    const tabPersonas = document.querySelector('a[href="#tab-personas"], a[href="#personas"]');
    tabPersonas?.addEventListener('click', () => { L('click TAB Personas'); ensurePersonas(); });

    const tabContactos = document.querySelector('a[href="#tab-contactos"], a[href="#contactos"]');
    tabContactos?.addEventListener('click', () => { L('click TAB Contactos'); adjustDT('#tablaContactos'); });
  } catch {}

  // Watcher: si #tablaVisitas aparece, inicializa
  try {
    if (typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(() => {
        if (!visitasBooted && document.getElementById('tablaVisitas')) {
          L('MO -> aparece #tablaVisitas, inicializando…');
          initVisitasTab().then(() => {
            visitasBooted = true;
            adjustDT('#tablaVisitas');
            L('Visitas INIT OK via MO');
          }).catch(e => console.warn('[visitas] init via MO', e));
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      L('MutationObserver listo');
    }
  } catch (e) { L('MO error', e); }

  // Helpers debug
  window.__contactosDiag = () => ({
    visitasBooted, personasBooted,
    hasTablaVisitas: !!document.getElementById('tablaVisitas'),
    hash: (window.location?.hash || ''),
  });
  L('initUIOnce() listo');
}

export async function initContactosTab(forceReload = false) {
  if (booted && !forceReload) { L('initContactosTab() omitido (booted)'); return; }

  try {
    setDTDefaults();
    initUIOnce();

    // Datos base
    L('Cargando centros y contactos…');
    await cargarCentros();
    await cargarContactosGuardados();

    // Wiring base
    setupBuscadorProveedores();
    setupFormulario();
    setupFormularioVisita();   // modal de visitas
    L('Wiring base OK');

    // Tabla Contactos (Empresas)
    initTablaContactos();
    renderTablaContactos();
    adjustDT('#tablaContactos');

    // Personas/Visitas lazy
    initAsociacionContactos();
    hookGlobalListeners();

    // Direct hash
    if (typeof window !== 'undefined') {
      const h = (window.location?.hash || '').toLowerCase();
      L('hash actual:', h);
      if (h === '#tab-visitas' || h === '#visitas') {
        try { await initVisitasTab(); visitasBooted = true; L('Visitas INIT OK (hash directo)'); }
        catch (e) { console.warn('[visitas] direct-hash init', e); }
        adjustDT('#tablaVisitas');
      } else if (h === '#tab-personas' || h === '#personas') {
        try { initFiltrosYKPIsPersonas(); initPersonasTab(); personasBooted = true; L('Personas INIT OK (hash directo)'); }
        catch (e) { console.warn('[personas] direct-hash init', e); }
        adjustDT('#tablaPersonas');
      }
    }

    booted = true;
    L('initContactosTab() COMPLETO');
  } catch (err) {
    console.error('[contactos] init error', err);
    window.M?.toast?.({ html: 'No se pudo inicializar', classes: 'red' });
  }
}

function hookGlobalListeners() {
  if (listenersHooked) return;

  document.addEventListener('filtro-personas-changed', () => renderTablaPersonas?.());

  document.addEventListener('reload-tabla-contactos', async () => {
    try {
      L('reload-tabla-contactos');
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

  window.addEventListener('visita:created', async () => {
    if (visitasBooted) {
      try { L('visita:created -> recargando Visitas'); await initVisitasTab(true); }
      catch (e) { console.error('[visitas] reload tras crear', e); }
      adjustDT('#tablaVisitas');
    }
  });

  window.addEventListener('resize', () => {
    adjustDT('#tablaContactos');
    if (visitasBooted)  adjustDT('#tablaVisitas');
    if (personasBooted) adjustDT('#tablaPersonas');
  });

  listenersHooked = true;
  L('Listeners globales OK');
}

document.addEventListener('DOMContentLoaded', () => {
  L('DOMContentLoaded');
  initContactosTab().catch(console.error);
});
