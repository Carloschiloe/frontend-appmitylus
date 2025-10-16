// /js/abastecimiento/contactos/index.js

// Evita romper el build en Vercel (solo carga debug en local)
try {
  if (typeof window !== 'undefined' &&
      (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    import('./debug-fetch.js').catch(() => {});
  }
} catch {}

/* ======================= Imports ======================= */
import { cargarCentros, cargarContactosGuardados } from './data.js';
import { setupBuscadorProveedores } from './proveedores.js';
import { setupFormulario, prepararNuevo, abrirDetalleContacto } from './form-contacto.js';
import { initTablaContactos, renderTablaContactos } from './tabla.js';
import { initAsociacionContactos } from './asociar-empresa.js';
import { initResumenSemanalTab } from './resumen-semanal.js';

// Personas
import { initPersonasTab, renderTablaPersonas } from './personas.js';

import { setupFormularioVisita, initVisitasTab, abrirModalVisita } from '../visitas/ui.js';

/* ======================= Estado ======================= */
let booted = false;
let listenersHooked = false;
let visitasBooted = false;
let personasBooted = false;

/* ======================= Utils generales ======================= */
const rafThrottle = (fn) => {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...args);
    });
  };
};

const debounce = (fn, wait = 120) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

function withJQ(cb) {
  const jq = window.jQuery || window.$;
  if (!jq) return null;
  try { return cb(jq); } catch { return null; }
}

/* ======================= DataTables defaults ======================= */
function setDTDefaults() {
  withJQ(($) => {
    if (!$.fn?.dataTable) return;
    $.extend(true, $.fn.dataTable.defaults, {
      scrollX: false,
      autoWidth: false,
      responsive: true,
      deferRender: true
    });
    $.fn.dataTable.ext.errMode = 'none';
  });
}

/* ======================= Ajustes DataTables ======================= */
const scheduleAdjust = (() => {
  // Coalesce de múltiples pedidos de ajuste por selector
  const pending = new Set();
  const run = rafThrottle(() => {
    withJQ(($) => {
      pending.forEach((sel) => {
        try {
          if (!$.fn?.DataTable || !$(sel).length || !$.fn.DataTable.isDataTable(sel)) return;
          const dt = $(sel).DataTable();

          // Espera a que exista el wrapper de scroll si aplica
          const wrap = document.querySelector(`${sel}_wrapper`);
          const hasScroll =
            wrap && (wrap.querySelector('.dataTables_scrollHead') || wrap.querySelector('.dataTables_scroll'));

          if (!hasScroll) {
            // Reintenta en el próximo frame si el wrapper aún no aparece
            requestAnimationFrame(() => scheduleAdjust(sel));
            return;
          }

          // Ajuste diferido sin redibujar todo
          setTimeout(() => {
            try { dt.columns.adjust().draw(false); } catch {}
          }, 0);
        } catch {}
      });
      pending.clear();
    });
  });

  return (selector) => {
    pending.add(selector);
    run();
  };
})();

function adjustDT(selector) {
  scheduleAdjust(selector);
}

// Oculta el buscador nativo de DataTables para una tabla dada
function hideNativeFilter(selector) {
  const wrap = document.querySelector(`${selector}_wrapper .dataTables_filter`);
  if (wrap) wrap.style.display = 'none';
}

// Bind handler a TODAS las coincidencias del selector
function onAll(selector, event, handler, opts) {
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener(event, handler, opts);
  });
}

/* ======================= Semana ISO + Badge ======================= */
// Semana ISO (Lunes = 1). Usa jueves ISO y CEIL
function isoWeekNumber(d = new Date()) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;            // 1..7 (lunes..domingo)
  x.setUTCDate(x.getUTCDate() + 4 - day);    // ir al jueves de esta semana
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  // CEIL para cuadrar correctamente el conteo ISO
  return Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
}

function setSemanaActualBadge(){
  const el = document.getElementById('badgeSemanaActual');
  if (!el) return;
  const w = isoWeekNumber(new Date());       // usa la fecha local
  const span = el.querySelector('span');
  if (span) span.textContent = `Semana ${w}`;
}

window.isoWeekNumber = isoWeekNumber;

/* ======================= Limpiar overlays “pegados” ======================= */
function nukeStuckOverlays() {
  document.querySelectorAll('.modal-overlay, .sidenav-overlay').forEach(el => el.remove());
  document.querySelectorAll('.modal.open').forEach(el => {
    try { M.Modal.getInstance(el)?.close(); } catch {}
    el.classList.remove('open');
    el.style.display = 'none';
  });
  document.body.style.overflow = '';
}

/* ======================= UI: tabs + modales (init una vez) ======================= */
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
          hideNativeFilter('#tablaVisitas');
          bindSearchVisitas();
        }

        if (id.includes('persona')) {
          if (!personasBooted) {
            initPersonasTab();
            personasBooted = true;
          }
          adjustDT('#tablaPersonas');
          hideNativeFilter('#tablaPersonas');
          bindSearchPersonas();
        }

        if (id.includes('contacto')) {
          adjustDT('#tablaContactos');
          hideNativeFilter('#tablaContactos');
          bindSearchContactos();
        }

        nukeStuckOverlays();
      }
    });
  }

  const cleanupOverlays = () => nukeStuckOverlays();

  // Modal Registrar Contacto / Persona comparten el mismo form (tu flujo actual)
  const modalContactoEl = document.getElementById('modalContacto');
  if (modalContactoEl) {
    const inst = M.Modal.getInstance(modalContactoEl) || M.Modal.init(modalContactoEl, {
      onCloseEnd: () => {
        try { document.getElementById('formContacto')?.reset(); } catch {}
        try { prepararNuevo(); } catch {}
        M.updateTextFields?.();
        cleanupOverlays();
      }
    });

    const openModalContacto = (e) => {
      e?.preventDefault?.();
      try { prepararNuevo(); } catch {}
      try { document.getElementById('formContacto')?.reset(); } catch {}
      M.updateTextFields?.();
      inst.open();
    };

    document.getElementById('btnOpenContactoModal')?.addEventListener('click', openModalContacto);
    document.getElementById('btnOpenPersonaModal')?.addEventListener('click', openModalContacto);

    modalContactoEl.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); inst.close(); });
    });
  }

  // Otros modales
  ['modalDetalleContacto','modalVisita','modalAsociar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) M.Modal.getInstance(el) || M.Modal.init(el, { onCloseEnd: cleanupOverlays });
  });

  window.addEventListener('hashchange', cleanupOverlays, { passive: true });

  // Click directo en tabs (enlaces fuera del ul.tabs)
  onAll('a[href="#tab-visitas"], a[href="#visitas"]', 'click', async () => {
    if (!visitasBooted) { await initVisitasTab().catch(()=>{}); visitasBooted = true; }
    adjustDT('#tablaVisitas');
    hideNativeFilter('#tablaVisitas');
    bindSearchVisitas();
    nukeStuckOverlays();
  });

  onAll('a[href="#tab-personas"], a[href="#personas"]', 'click', () => {
    if (!personasBooted) {
      initPersonasTab();
      personasBooted = true;
    }
    adjustDT('#tablaPersonas');
    hideNativeFilter('#tablaPersonas');
    bindSearchPersonas();
    nukeStuckOverlays();
  });

  onAll('a[href="#tab-contactos"], a[href="#contactos"]', 'click', () => {
    adjustDT('#tablaContactos');
    hideNativeFilter('#tablaContactos');
    bindSearchContactos();
    nukeStuckOverlays();
  });

  // --- Botón "Registrar muestreo" (placeholder) ---
  document.getElementById('btnOpenMuestreoModal')?.addEventListener('click', (e) => {
    e.preventDefault();
    M.toast?.({ html: 'Registrar muestreo: próximamente', displayLength: 1800 });
  });

  // Badge semana actual
  setSemanaActualBadge();
  nukeStuckOverlays();
}

/* ======================= Buscadores (toolbar) ======================= */
function bindSearchContactos(){
  const input = document.getElementById('searchContactos');
  if (!input || input.dataset.bound) return;

  const handler = debounce(() => {
    withJQ(($) => {
      try { $('#tablaContactos').DataTable().search(input.value || '').draw(); } catch {}
    });
  }, 120);

  input.addEventListener('input', handler);
  input.dataset.bound = '1';
  hideNativeFilter('#tablaContactos');
}

function bindSearchPersonas(){
  const input = document.getElementById('searchPersonas');
  if (!input || input.dataset.bound) return;

  const handler = debounce(() => {
    withJQ(($) => {
      try { $('#tablaPersonas').DataTable().search(input.value || '').draw(); } catch {}
    });
  }, 120);

  input.addEventListener('input', handler);
  input.dataset.bound = '1';
  hideNativeFilter('#tablaPersonas');
}

function bindSearchVisitas(){
  const input = document.getElementById('searchVisitas');
  if (!input || input.dataset.bound) return;

  const handler = debounce(() => {
    withJQ(($) => {
      try { $('#tablaVisitas').DataTable().search(input.value || '').draw(); } catch {}
    });
  }, 120);

  input.addEventListener('input', handler);
  input.dataset.bound = '1';
  hideNativeFilter('#tablaVisitas');
}

/* ======================= Boot principal ======================= */
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
    hideNativeFilter('#tablaContactos');
    bindSearchContactos();
    nukeStuckOverlays();

    // Asociación y listeners globales
    initAsociacionContactos();
    hookGlobalListeners();

    // Navegación directa por hash
    const h = (location.hash || '').toLowerCase();
    if (h === '#tab-visitas' || h === '#visitas') {
      await initVisitasTab().catch(()=>{});
      visitasBooted = true;
      adjustDT('#tablaVisitas');
      hideNativeFilter('#tablaVisitas');
      bindSearchVisitas();
    } else if (h === '#tab-personas' || h === '#personas') {
      initPersonasTab();
      personasBooted = true;
      adjustDT('#tablaPersonas');
      hideNativeFilter('#tablaPersonas');
      bindSearchPersonas();
    }

    nukeStuckOverlays();
    booted = true;
  } catch (err) {
    console.error('[contactos] init error', err);
    M.toast?.({ html: 'No se pudo inicializar', classes: 'red' });
  }
}

/* ======================= Listeners globales ======================= */
function hookGlobalListeners() {
  if (listenersHooked) return;

  document.addEventListener('filtro-personas-changed', () => renderTablaPersonas?.());

  document.addEventListener('reload-tabla-contactos', async () => {
    try {
      await cargarContactosGuardados();
      renderTablaContactos();
      renderTablaPersonas?.();
      adjustDT('#tablaContactos');
      hideNativeFilter('#tablaContactos');
      if (personasBooted) { adjustDT('#tablaPersonas'); hideNativeFilter('#tablaPersonas'); }
      if (visitasBooted)  { adjustDT('#tablaVisitas');  hideNativeFilter('#tablaVisitas'); }
      nukeStuckOverlays();
    } catch (e) {
      console.error(e);
      M.toast?.({ html: 'No se pudo refrescar', classes: 'red' });
    }
  });

  // Cuando se crea una visita desde otro módulo
  window.addEventListener('visita:created', async () => {
    if (visitasBooted) {
      try { await initVisitasTab(true); } catch {}
      adjustDT('#tablaVisitas');
      hideNativeFilter('#tablaVisitas');
      nukeStuckOverlays();
    }
  }, { passive: true });

  // Resize coalesced
  const onResize = rafThrottle(() => {
    adjustDT('#tablaContactos');
    hideNativeFilter('#tablaContactos');
    if (visitasBooted)  { adjustDT('#tablaVisitas');  hideNativeFilter('#tablaVisitas'); }
    if (personasBooted) { adjustDT('#tablaPersonas'); hideNativeFilter('#tablaPersonas'); }
  });
  window.addEventListener('resize', onResize);

  // Botón “Nuevo contacto” (si algún día lo agregas aparte del de la barra)
  document.getElementById('btnNuevoContacto')?.addEventListener('click', (e)=>{
    e.preventDefault();
    try { prepararNuevo(); } catch {}
    const el = document.getElementById('modalContacto');
    (M.Modal.getInstance(el) || M.Modal.init(el)).open();
  });

  listenersHooked = true;
}

/* ======================= Arranque ======================= */
document.addEventListener('DOMContentLoaded', () => {
  initContactosTab().then(()=>{
    try { initResumenSemanalTab(); } catch(e){ console.error(e); }
  }).catch(console.error);
});

/* ======================= Exponer helpers a window ======================= */
window.abrirDetalleContacto = abrirDetalleContacto;
window.abrirModalVisita = abrirModalVisita;

// Por si quieres forzar la limpieza desde consola
window.nukeStuckOverlays = nukeStuckOverlays;
