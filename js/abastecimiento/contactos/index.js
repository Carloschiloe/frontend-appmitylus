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

// Bind handler a TODAS las coincidencias del selector
function onAll(selector, event, handler) {
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener(event, handler);
  });
}

/* ======================= Limpiar overlays “pegados” ======================= */
function nukeStuckOverlays() {
  // Quita overlays de Materialize si quedaron colgando
  document.querySelectorAll('.modal-overlay, .sidenav-overlay').forEach(el => el.remove());
  // Cierra y oculta modales que hayan quedado con .open
  document.querySelectorAll('.modal.open').forEach(el => {
    try { M.Modal.getInstance(el)?.close(); } catch {}
    el.classList.remove('open');
    el.style.display = 'none';
  });
  // Desbloquea el scroll por seguridad
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
        }
        if (id.includes('persona')) {
          if (!personasBooted) {
            initPersonasTab();
            personasBooted = true;
          }
          adjustDT('#tablaPersonas');
        }
        if (id.includes('contacto')) adjustDT('#tablaContactos');
        // por si cambia de tab con un overlay colgado
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
        // Seguridad adicional: dejar siempre el form en modo NUEVO al cerrar
        try { document.getElementById('formContacto')?.reset(); } catch {}
        try { prepararNuevo(); } catch {}
        M.updateTextFields?.();
        cleanupOverlays();
      }
    });

    // >>>>>>> FIX PRINCIPAL: abrir SIEMPRE en modo NUEVO <<<<<<<
    document.getElementById('btnOpenContactoModal')
      ?.addEventListener('click', (e) => {
        e.preventDefault();
        try { prepararNuevo(); } catch {}
        try { document.getElementById('formContacto')?.reset(); } catch {}
        M.updateTextFields?.();
        inst.open();
      });

    // Mantengo también el botón de “Agregar persona” que reutiliza el mismo modal visual
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

  // Click directo en tabs (antes tomaba solo el primero)
  onAll('a[href="#tab-visitas"], a[href="#visitas"]', 'click', async () => {
    if (!visitasBooted) { await initVisitasTab().catch(()=>{}); visitasBooted = true; }
    adjustDT('#tablaVisitas');
    nukeStuckOverlays();
  });

  onAll('a[href="#tab-personas"], a[href="#personas"]', 'click', () => {
    if (!personasBooted) {
      initPersonasTab();
      personasBooted = true;
    }
    adjustDT('#tablaPersonas');
    nukeStuckOverlays();
  });

  onAll('a[href="#tab-contactos"], a[href="#contactos"]', 'click', () => {
    adjustDT('#tablaContactos');
    nukeStuckOverlays();
  });

  // Limpieza inicial por si llegó la página con algo pegado
  nukeStuckOverlays();
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
    } else if (h === '#tab-personas' || h === '#personas') {
      initPersonasTab();
      personasBooted = true;
      adjustDT('#tablaPersonas');
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
      if (personasBooted) adjustDT('#tablaPersonas');
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
      nukeStuckOverlays();
    }
  });

  // Responsivo
  window.addEventListener('resize', () => {
    adjustDT('#tablaContactos');
    if (visitasBooted)  adjustDT('#tablaVisitas');
    if (personasBooted) adjustDT('#tablaPersonas');
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
