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

// Personas
import { initPersonasTab, renderTablaPersonas } from './personas.js';

import { setupFormularioVisita, initVisitasTab, abrirModalVisita } from '../visitas/tab.js';

/* ======================= Estado ======================= */
let booted = false;
let listenersHooked = false;
let visitasBooted = false;
let personasBooted = false;

/* ======================= Utils locales ======================= */
function setDTDefaults() {
  const jq = window.jQuery || window.$;
  if (!jq?.fn?.dataTable) return;
  jq.extend(true, jq.fn.dataTable.defaults, {
    scrollX: false,
    autoWidth: false,
    responsive: true,
    deferRender: true,
  });
  jq.fn.dataTable.ext.errMode = 'none';
}

function adjustDT(selector) {
  const jq = window.jQuery || window.$;
  if (!jq?.fn?.DataTable || !jq(selector).length) return;
  try {
    const dt = jq(selector).DataTable();
    setTimeout(() => dt.columns.adjust().draw(false), 0);
  } catch {}
}

// Oculta el buscador nativo de DataTables para una tabla dada
function hideNativeFilter(selector) {
  const wrap = document.querySelector(`${selector}_wrapper .dataTables_filter`);
  if (wrap) wrap.style.display = 'none';
}

// Bind handler a TODAS las coincidencias del selector
function onAll(selector, event, handler) {
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener(event, handler);
  });
}

/* ======================= Semana ISO + Badge ======================= */
function isoWeekNumber(dateStr){
  // dateStr: 'YYYY-MM-DD' o ISO; lunes=0
  const d = dateStr ? new Date(dateStr) : new Date();
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // lunes=0
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target - firstThu) / 86400000;
  return 1 + Math.floor(diff / 7);
}
function setSemanaActualBadge(){
  const el = document.getElementById('badgeSemanaActual');
  if (!el) return;
  const today = new Date();
  const ymd = today.toISOString().slice(0,10);
  const w = isoWeekNumber(ymd);
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

  // Modal Registrar Contacto / Persona
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

    document.getElementById('btnOpenContactoModal')
      ?.addEventListener('click', (e) => {
        e.preventDefault();
        try { prepararNuevo(); } catch {}
        try { document.getElementById('formContacto')?.reset(); } catch {}
        M.updateTextFields?.();
        inst.open();
      });

    document.getElementById('btnOpenPersonaModal')
      ?.addEventListener('click', (e) => {
        e.preventDefault();
        try { prepararNuevo(); } catch {}
        try { document.getElementById('formContacto')?.reset(); } catch {}
        M.updateTextFields?.();
        inst.open();
      });

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

  // Click directo en tabs
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
  const jq = window.jQuery || window.$;
  const input = document.getElementById('searchContactos');
  if (!jq || !jq.fn?.DataTable || !input || input.dataset.bound) return;
  input.addEventListener('input', () => {
    try { jq('#tablaContactos').DataTable().search(input.value || '').draw(); } catch {}
  });
  input.dataset.bound = '1';
  hideNativeFilter('#tablaContactos');
}
function bindSearchPersonas(){
  const jq = window.jQuery || window.$;
  const input = document.getElementById('searchPersonas');
  if (!jq || !jq.fn?.DataTable || !input || input.dataset.bound) return;
  input.addEventListener('input', () => {
    try { jq('#tablaPersonas').DataTable().search(input.value || '').draw(); } catch {}
  });
  input.dataset.bound = '1';
  hideNativeFilter('#tablaPersonas');
}
function bindSearchVisitas(){
  const jq = window.jQuery || window.$;
  const input = document.getElementById('searchVisitas');
  if (!jq || !jq.fn?.DataTable || !input || input.dataset.bound) return;
  input.addEventListener('input', () => {
    try { jq('#tablaVisitas').DataTable().search(input.value || '').draw(); } catch {}
  });
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
  });

  // Responsivo
  window.addEventListener('resize', () => {
    adjustDT('#tablaContactos');
    hideNativeFilter('#tablaContactos');
    if (visitasBooted)  { adjustDT('#tablaVisitas');  hideNativeFilter('#tablaVisitas'); }
    if (personasBooted) { adjustDT('#tablaPersonas'); hideNativeFilter('#tablaPersonas'); }
  });

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
  initContactosTab().catch(console.error);
});

/* ======================= Exponer helpers a window ======================= */
window.abrirDetalleContacto = abrirDetalleContacto;
window.abrirModalVisita = abrirModalVisita;

// Por si quieres forzar la limpieza desde consola
window.nukeStuckOverlays = nukeStuckOverlays;
