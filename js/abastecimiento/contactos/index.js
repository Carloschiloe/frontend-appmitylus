// /js/abastecimiento/contactos/index.js

/* ======================= Imports ======================= */
import { cargarCentros, cargarContactosGuardados } from './data.js';
import { state } from './state.js';
import { setupBuscadorProveedores } from './proveedores.js';
import { setupFormulario, prepararNuevo, abrirDetalleContacto } from './form-contacto.js';
import { initTablaContactos, renderTablaContactos } from './tabla.js';
import { initAsociacionContactos } from './asociar-empresa.js';
import { createMuestreoModule } from './muestreo.js';
import { createMuestreosTabModule } from './muestreos-tab.js';
import { createCalendarioTabModule } from './calendario-tab.js';
import { createGestionBoardModule } from './gestion-board.js';
import { createUiShellModule } from './ui-shell.js';
import { ensureMuestreoPortals, initContactosTabs, initContactosModals } from './ui-init.js';
import { getModalInstance, closeModal, rafThrottle, debounce } from './ui-common.js';
import { createGestionActionsModule } from './gestion-actions.js';
import { createTableSearchModule } from './table-search.js';

//  cache-bust del modulo de Resumen (para que **SIEMPRE** te cargue la version nueva)
import { initResumenSemanalTab } from './resumen-semanal.js';

// Personas
import { initPersonasTab, renderTablaPersonas } from './personas.js';

import { setupFormularioVisita, initVisitasTab, abrirModalVisita, setVisitasPreset } from '../visitas/ui.js';
import { openInteraccionModal } from './interacciones/modal.js';
import { list as listInteracciones, create as createInteraccion, normalizeForSave as normalizeInteraccionForSave } from './interacciones/api.js';

/* ======================= Estado ======================= */
let booted = false;
let listenersHooked = false;
let visitasBooted = false;
let personasBooted = false;
let muestreosBooted = false;
let calendarioBooted = false;
const consultaFilterState = {
  visitasPreset: ''
};
let gestionBoardModule = null;
let gestionActionsModule = null;
let tableSearchModule = null;

/* ======================= DataTables defaults ======================= */
function setDTDefaults() {
  // DataTables retirado en Gestion/Consulta.
}

/* ======================= Ajustes (compat legado) ======================= */
function adjustDT() {}
function hideNativeFilter() {}
function onAll(selector, event, handler, opts) {
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener(event, handler, opts);
  });
}

/* ======================= Semana ISO + Badge ======================= */
function isoWeekNumber(d = new Date()) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
}
function setSemanaActualBadge(){
  const el = document.getElementById('badgeSemanaActual');
  if (!el) return;
  const w = isoWeekNumber(new Date());
  const span = el.querySelector('span');
  if (span) span.textContent = `Semana ${w}`;
}
window.isoWeekNumber = isoWeekNumber;

const muestreoModule = createMuestreoModule({
  activateTab: (hash) => activarTab(hash),
  createInteraccion,
  listInteracciones,
  normalizeInteraccionForSave,
  onSavedGestion: () => renderGestionHomeBoard(),
  normalizeText: (v) => normalizeText(v)
});

const muestreosTabModule = createMuestreosTabModule({
  openMuestreoPanel: (opts) => muestreoModule.openPanel(opts),
  openMuestreoFromSeed: (seed, opts) => muestreoModule.openFromSeed(seed, opts),
  refreshConsultaFilterStates: () => refreshConsultaFilterStates(),
  ensureVisitasLoaded: async () => {
    const h = String(location.hash || '').toLowerCase();
    const needVisitData = muestreosBooted || h === '#tab-muestreos' || h === '#muestreos';
    if (!needVisitData) return;
    if (!visitasBooted) {
      await initVisitasTab().catch(() => {});
      visitasBooted = true;
    }
  }
});

const calendarioTabModule = createCalendarioTabModule({
  openInteraccionModal,
  openMuestreoFromSeed: (seed, opts) => muestreoModule.openFromSeed(seed, opts),
});

const uiShellModule = createUiShellModule({
  activateTab: (hash) => activarTab(hash),
  applyConsultaPreset: (target, preset) => applyConsultaPreset(target, preset)
});

/* ======================= Limpiar overlays Spegados ======================= */
function nukeStuckOverlays() {
  if (muestreoModule.isOpening()) return;
  if (document.getElementById('modalMuestreo')?.classList.contains('open')) return;
  document.querySelectorAll('.modal-overlay, .sidenav-overlay').forEach(el => el.remove());
  document.querySelectorAll('.modal.open').forEach(el => {
    try { closeModal(el); } catch {}
    el.classList.remove('open');
    el.style.display = 'none';
  });
  document.body.style.overflow = '';
  document.body.classList.remove('mu-layout-active');
}

/* ======================= Helpers de campos NUEVOS ======================= */
function resetContactoExtras() {
  const loc = document.getElementById('contactoLocalidad'); if (loc) loc.value = '';
  const bio = document.getElementById('contactoBiomasa');   if (bio) bio.checked = false;
  const nuevo = document.getElementById('contactoProveedorNuevo'); if (nuevo) nuevo.checked = false;
  const paso = document.getElementById('contacto_proximoPaso'); if (paso) paso.value = '';
  const pasoFecha = document.getElementById('contacto_proximoPasoFecha'); if (pasoFecha) pasoFecha.value = '';
  try { M.updateTextFields?.(); } catch {}
}

function activarTab(hash) {
  if (!hash) return;
  const raw = (String(hash).startsWith('#') ? hash.slice(1) : hash).toLowerCase();

  // Mapeo de hashes legacy a nuevos panel IDs
  const MAIN_MAP = {
    'tab-contactos': 'tab-directorio',
    'contactos': 'tab-directorio',
	    'tab-personas': 'tab-directorio',
	    'personas': 'tab-directorio',
	    'calendario': 'tab-calendario',
	    'tab-visitas': 'tab-interacciones',
	    'visitas': 'tab-interacciones',
    // Legacy: pestaña Buscar/Consulta removida
    'tab-consulta': 'tab-gestion',
    'tab-buscar': 'tab-gestion',
    'buscar': 'tab-gestion',
    'muestreos': 'tab-muestreos',
  };
  const mainId = MAIN_MAP[raw] || raw;

  // Activar panel principal
  document.querySelectorAll('.c-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('[data-c-tab]').forEach((b) => b.classList.remove('active'));
  const panel = document.getElementById(mainId);
  if (panel) panel.classList.add('active');
  document.querySelector(`[data-c-tab="${mainId}"]`)?.classList.add('active');

  // Activar sub-panel según el hash original
  if (raw === 'tab-personas' || raw === 'personas') {
    document.querySelectorAll('#tab-directorio .c-sub-panel').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('[data-dir-tab]').forEach((b) => b.classList.remove('active'));
    document.getElementById('tab-personas')?.classList.add('active');
    document.querySelector('[data-dir-tab="dir-personas"]')?.classList.add('active');
  } else if (raw === 'tab-visitas' || raw === 'visitas') {
    document.querySelectorAll('#tab-interacciones .c-sub-panel').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('[data-inter-tab]').forEach((b) => b.classList.remove('active'));
    document.getElementById('inter-visitas')?.classList.add('active');
    document.querySelector('[data-inter-tab="inter-visitas"]')?.classList.add('active');
  }

  // Actualizar hash sin recargar
  try {
    history.replaceState(null, '', `${location.pathname}${location.search}#${mainId}`);
  } catch {
    location.hash = mainId;
  }
}

function ensureGestionActionsModule() {
  if (gestionActionsModule) return gestionActionsModule;
  gestionActionsModule = createGestionActionsModule({
    activateTab: activarTab,
    applyConsultaPreset,
    initVisitasTab,
    openVisitaModal: abrirModalVisita,
    openInteraccionModal,
    openMuestreoPanel: (opts) => muestreoModule.openPanel(opts),
    onSavedGestion: () => {
      renderGestionHomeBoard();
      document.getElementById('interacciones-root')?._activityRefresh?.();
    },
    setVisitasBooted: (v) => { visitasBooted = !!v; }
  });
  return gestionActionsModule;
}

function bindGestionHomeActions() {
  ensureGestionActionsModule().bindHomeActions();
}


function isVisitaPendiente(v) {
  const est = normalizeText(v?.estado || '');
  if (!est) return false;
  if (est === 'sin accion' || est === 'cerrado' || est === 'completado' || est === 'finalizado') return false;
  return true;
}

async function applyConsultaPreset(target, preset) {
  if (target === '#tab-muestreos') {
    await muestreosTabModule.initTab(false).catch(() => {});
    muestreosBooted = true;
    refreshConsultaFilterStates();
    return;
  }

  if (target !== '#tab-visitas') return;
  await initVisitasTab().catch(()=>{});
  visitasBooted = true;

  if (preset === 'visitas-pendientes') {
    consultaFilterState.visitasPreset = 'Pendientes';
    setVisitasPreset('visitas-pendientes');
    const input = document.getElementById('searchVisitas');
    if (input) {
      input.value = '';
      input.placeholder = 'Filtro activo: visitas pendientes';
    }
    refreshConsultaFilterStates();
    return;
  }

  consultaFilterState.visitasPreset = '';
  setVisitasPreset('');
  const input = document.getElementById('searchVisitas');
  if (input) input.placeholder = 'Buscar en visitas...';
  refreshConsultaFilterStates();
}

function toDateSafe(v) {
  if (!v) return null;
  const d = (v instanceof Date) ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDateShort(v) {
  const d = toDateSafe(v);
  if (!d) return 'Sin fecha';
  return d.toLocaleDateString('es-CL');
}

function fmtDateISO(v) {
  const d = toDateSafe(v);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function buildMuestreoSeedFromVisitaId(id) {
  const visitId = String(id || '').trim();
  if (!visitId) return null;

  const visita = (state.visitasGuardadas || []).find((x) => String(x?._id || x?.id || '') === visitId);
  if (!visita) return null;

  const contacto = (state.contactosGuardados || []).find((x) => String(x?._id || x?.id || '') === String(visita.contactoId || ''));
  const proveedor = contacto?.proveedorNombre || visita.proveedorNombre || visita.contacto || '';
  const proveedorKey = contacto?.proveedorKey || visita.proveedorKey || '';
  const centro = visita.centroCodigo || contacto?.centroCodigo || '';
  const fecha = fmtDateISO(visita.fecha) || fmtDateISO(new Date());
  const responsable = contacto?.responsablePG || contacto?.responsable || visita?.responsablePG || '';

  return {
    visitaId: visitId,
    proveedorKey,
    proveedor,
    proveedorNombre: proveedor,
    centroId: visita.centroId || '',
    centroCodigo: centro,
    centro,
    fecha,
    responsable,
    responsablePG: responsable,
    route: 'terreno'
  };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  d.setMilliseconds(-1);
  return d;
}

function plusDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function normalizeText(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function setConsultaFilterState(elId, labels = [], fallback = 'Sin filtros') {
  const el = document.getElementById(elId);
  if (!el) return;
  const clean = (labels || []).map((x) => String(x || '').trim()).filter(Boolean);
  el.textContent = clean.length ? `Activos: ${clean.join(' · ')}` : fallback;
  if (!clean.length) el.dataset.level = 'none';
  else if (clean.length <= 2) el.dataset.level = 'low';
  else el.dataset.level = 'high';
}

function refreshConsultaFilterStates() {
  const fltSemana = document.getElementById('fltSemana')?.value || '';
  const fltComuna = document.getElementById('fltComuna')?.value || '';
  const fltResp = document.getElementById('fltResp')?.value || '';
  const qContactos = (document.getElementById('searchContactos')?.value || '').trim();
  setConsultaFilterState('estadoFiltroContactos', [
    fltSemana ? `Semana ${fltSemana}` : '',
    fltComuna ? `Comuna ${fltComuna}` : '',
    fltResp ? `Resp ${fltResp}` : '',
    qContactos ? 'Búsqueda' : ''
  ]);

  const fltVisSem = document.getElementById('fltVisSem')?.value || '';
  const fltVisComuna = document.getElementById('fltVisComuna')?.value || '';
  const qVisitas = (document.getElementById('searchVisitas')?.value || '').trim();
  setConsultaFilterState('estadoFiltroVisitas', [
    consultaFilterState.visitasPreset || '',
    fltVisSem ? `Semana ${fltVisSem}` : '',
    fltVisComuna ? `Comuna ${fltVisComuna}` : '',
    qVisitas ? 'Búsqueda' : ''
  ]);

  const qPersonas = (document.getElementById('searchPersonas')?.value || '').trim();
  setConsultaFilterState('estadoFiltroPersonas', [qPersonas ? 'Búsqueda' : '']);

  const qMuestreos = (document.getElementById('searchMuestreos')?.value || '').trim();
  const muProv = (document.getElementById('muFltProveedor')?.value || '').trim();
  const muCont = (document.getElementById('muFltContacto')?.value || '').trim();
  const muResp = (document.getElementById('muFltResponsable')?.value || '').trim();
  const muOri = (document.getElementById('muFltOrigen')?.value || '').trim();
  const muDesde = (document.getElementById('muFltDesde')?.value || '').trim();
  const muHasta = (document.getElementById('muFltHasta')?.value || '').trim();
  setConsultaFilterState('estadoFiltroMuestreos', [
    muProv ? 'Proveedor' : '',
    muCont ? 'Contacto' : '',
    muResp ? 'Responsable' : '',
    muOri ? `Ruta ${muOri}` : '',
    (muDesde || muHasta) ? 'Rango fecha' : '',
    qMuestreos ? 'Búsqueda' : ''
  ]);
}

function ensureTableSearchModule() {
  if (tableSearchModule) return tableSearchModule;
  tableSearchModule = createTableSearchModule({
    debounce,
    refreshConsultaFilterStates: () => refreshConsultaFilterStates(),
    consultaFilterState
  });
  return tableSearchModule;
}

function ensureGestionBoardModule() {
  if (gestionBoardModule) return gestionBoardModule;
  gestionBoardModule = createGestionBoardModule({
    state,
    normalizeText,
    toDateSafe,
    fmtDateShort,
    startOfToday,
    endOfToday,
    plusDays,
    debounce,
    isVisitaPendiente,
    listInteracciones,
    openInteraccionModal,
    abrirDetalleContacto,
    activateTab: activarTab,
    refreshConsultaFilterStates
  });
  return gestionBoardModule;
}

function bindGestionFilters() {
  ensureGestionBoardModule().bindFilters();
}

function bindGestionHomeBoardEvents() {
  ensureGestionBoardModule().bindBoardEvents();
}

async function renderGestionHomeBoard() {
  await ensureGestionBoardModule().renderBoard();
}

function bindRegistroValidationHints() {
  if (document.body.dataset.registroValidationBound === '1') return;
  document.body.dataset.registroValidationBound = '1';

  const form = document.getElementById('formContacto');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    const proveedorId = (document.getElementById('proveedorId')?.value || '').trim();
    const telefono = (document.getElementById('contactoTelefono')?.value || '').trim();
    const email = (document.getElementById('contactoEmail')?.value || '').trim();
    const paso = (document.getElementById('contacto_proximoPaso')?.value || '').trim();
    const fechaPaso = (document.getElementById('contacto_proximoPasoFecha')?.value || '').trim();

    if (!proveedorId) {
      e.preventDefault();
      M.toast?.({ html: 'Selecciona un proveedor antes de guardar.', classes: 'red' });
      return;
    }

    if (telefono && !/^[+()\d\s-]{8,}$/.test(telefono)) {
      e.preventDefault();
      M.toast?.({ html: 'Teléfono inválido. Revisa el formato.', classes: 'red' });
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.preventDefault();
      M.toast?.({ html: 'Email inválido. Revisa el formato.', classes: 'red' });
      return;
    }

    if (paso && normalizeText(paso) !== 'sin accion' && !fechaPaso) {
      e.preventDefault();
      M.toast?.({ html: 'Si defines próximo paso, agrega fecha compromiso.', classes: 'red' });
    }
  }, true);
}

/* ======================= UI: tabs + modales (init una vez) ======================= */
function initUIOnce() {
  uiShellModule.bindSideNav();
  bindRegistroValidationHints();
  bindConsultaFilterStateListeners();
  muestreoModule.bindUI();
  ensureMuestreoPortals();

	  initContactosTabs({
	    onVisitas: () => {
	      if (!visitasBooted) { initVisitasTab().catch(()=>{}); visitasBooted = true; }
	      refreshVisitasTableUI();
	      bindConsultaFilterStateListeners();
	      refreshConsultaFilterStates();
	    },
	    onCalendario: () => {
	      calendarioTabModule.initTab(false).catch(() => {});
	      calendarioBooted = true;
	      refreshConsultaFilterStates();
	    },
	    onPersonas: () => {
	      if (!personasBooted) { initPersonasTab(); personasBooted = true; }
	      refreshPersonasTableUI();
	      refreshConsultaFilterStates();
	    },
    onMuestreos: () => {
      muestreosTabModule.initTab(false).catch(() => {});
      muestreosBooted = true;
      refreshConsultaFilterStates();
    },
    onContactos: () => {
      refreshContactosTableUI();
      refreshConsultaFilterStates();
    },
    onAny: () => {
      nukeStuckOverlays();
    }
  });

  const cleanupOverlays = () => nukeStuckOverlays();
  initContactosModals({
    onCleanup: cleanupOverlays,
    onResetContactoExtras: resetContactoExtras,
    onPrepararNuevo: prepararNuevo,
    onMuestreoClose: () => {
      try { closeModal('modalMuestreoItems'); } catch {}
    }
  });

  window.addEventListener('hashchange', cleanupOverlays, { passive: true });
  window.addEventListener('resize', () => {
    muestreoModule.scheduleLayout();
  }, { passive: true });

  onAll('a[href="#tab-visitas"], a[href="#visitas"]', 'click', async () => {
    if (!visitasBooted) { await initVisitasTab().catch(()=>{}); visitasBooted = true; }
    await applyConsultaPreset('#tab-visitas', '');
    refreshVisitasTableUI(); nukeStuckOverlays();
  });

  onAll('a[href="#tab-personas"], a[href="#personas"]', 'click', () => {
    if (!personasBooted) { initPersonasTab(); personasBooted = true; }
    refreshPersonasTableUI(); nukeStuckOverlays();
  });

	  onAll('a[href="#tab-contactos"], a[href="#contactos"]', 'click', () => {
	    refreshContactosTableUI(); nukeStuckOverlays();
	  });

	  onAll('a[href="#tab-calendario"], a[href="#calendario"]', 'click', () => {
	    calendarioTabModule.initTab(false).catch(() => {});
	    calendarioBooted = true;
	    refreshConsultaFilterStates();
	    nukeStuckOverlays();
	  });

	  onAll('a[href="#tab-muestreos"], a[href="#muestreos"]', 'click', () => {
	    muestreosTabModule.initTab(false).catch(() => {});
	    muestreosBooted = true;
	    refreshConsultaFilterStates();
	    nukeStuckOverlays();
	  });

  document.getElementById('btnOpenMuestreoModal')?.addEventListener('click', (e) => {
    e.preventDefault();
    muestreoModule.openPanel({ route: 'terreno', view: 'form' });
  });

  document.addEventListener('muestreo:open-from-visita', (e) => {
    const id = e?.detail?.id || '';
    const view = (e?.detail?.view === 'summary') ? 'summary' : 'form';
    const seed = buildMuestreoSeedFromVisitaId(id);
    if (typeof muestreoModule.openFromSeed === 'function') {
      muestreoModule.openFromSeed(seed || {}, { route: 'terreno', view });
    } else {
      muestreoModule.openPanel({ route: 'terreno', view });
    }
  });

  setSemanaActualBadge();
  nukeStuckOverlays();
}

/* ======================= Buscadores (toolbar) ======================= */
function bindSearchContactos() {
  ensureTableSearchModule().bindSearchContactos();
}

function bindSearchPersonas() {
  ensureTableSearchModule().bindSearchPersonas();
}

function bindSearchVisitas() {
  ensureTableSearchModule().bindSearchVisitas();
}

function refreshContactosTableUI() {
  ensureTableSearchModule().refreshContactosTableUI();
}

function refreshVisitasTableUI() {
  ensureTableSearchModule().refreshVisitasTableUI();
}

function refreshPersonasTableUI() {
  ensureTableSearchModule().refreshPersonasTableUI();
}

function bindConsultaFilterStateListeners() {
  ensureTableSearchModule().bindConsultaFilterStateListeners();
}

/* ======================= Boot principal ======================= */
export async function initContactosTab(forceReload = false) {
  if (booted && !forceReload) return;

  try {
    const initialHash = (location.hash || '').toLowerCase();
    const normalizedHash = uiShellModule.normalizeHash(initialHash);
    if (normalizedHash && normalizedHash !== initialHash) {
      try {
        const nextUrl = `${location.pathname}${location.search}${normalizedHash}`;
        history.replaceState(null, '', nextUrl);
      } catch {
        location.hash = normalizedHash;
      }
    }

    setDTDefaults();
    initUIOnce();
    bindGestionHomeActions();
    bindGestionHomeBoardEvents();
    bindGestionFilters();

    await cargarCentros();
    await cargarContactosGuardados();
    // Exponer para módulos externos (ej. Tratos autocomplete, Muestreo centros)
    window._contactosGuardados = state.contactosGuardados || [];
    window._state = state; // Expone listaCentros para el selector dinámico de muestreos

    setupBuscadorProveedores();
    setupFormulario();
    setupFormularioVisita();

    initTablaContactos();
    renderTablaContactos();
    refreshContactosTableUI();
    nukeStuckOverlays();

    initAsociacionContactos();
    hookGlobalListeners();

    const h = (location.hash || '').toLowerCase();
	    if (h === '#tab-visitas' || h === '#visitas') {
	      await initVisitasTab().catch(()=>{}); visitasBooted = true;
	      refreshVisitasTableUI();
		    } else if (h === '#tab-calendario' || h === '#calendario') {
		      activarTab('#tab-calendario');
		      await calendarioTabModule.initTab(false).catch(() => {});
		      calendarioBooted = true;
		      refreshConsultaFilterStates();
		    } else if (h === '#tab-muestreos' || h === '#muestreos') {
	      await muestreosTabModule.initTab(false).catch(() => {});
	      muestreosBooted = true;
	      refreshConsultaFilterStates();
	    } else if (h === '#tab-personas' || h === '#personas') {
      initPersonasTab(); personasBooted = true;
      refreshPersonasTableUI();
    } else if (!h) {
      activarTab('#tab-gestion');
    }

    // Aqui se inicializa el TAB de Resumen (lo carga este index, no el HTML)
    try { await initResumenSemanalTab(); } catch(e){ console.error(e); }
    await renderGestionHomeBoard();

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
      window._contactosGuardados = state.contactosGuardados || [];
	      renderTablaContactos();
	      renderTablaPersonas?.();
	      if (muestreosBooted) {
	        await muestreosTabModule.renderTablaMuestreos(true).catch(() => {});
	      }
	      if (calendarioBooted) {
	        await calendarioTabModule.render(true).catch(() => {});
	      }
	      await renderGestionHomeBoard();
	      adjustDT('#tablaContactos'); hideNativeFilter('#tablaContactos');
      if (personasBooted) { adjustDT('#tablaPersonas'); hideNativeFilter('#tablaPersonas'); }
      if (visitasBooted)  { adjustDT('#tablaVisitas');  hideNativeFilter('#tablaVisitas'); }
      nukeStuckOverlays();
    } catch (e) {
      console.error(e);
      M.toast?.({ html: 'No se pudo refrescar', classes: 'red' });
    }
  });

  window.addEventListener('visita:created', async () => {
    if (visitasBooted) {
      try { await initVisitasTab(true); } catch {}
      adjustDT('#tablaVisitas'); hideNativeFilter('#tablaVisitas'); nukeStuckOverlays();
    }
    await renderGestionHomeBoard();
  }, { passive: true });

  window.addEventListener('visita:updated', () => { renderGestionHomeBoard().catch(()=>{}); }, { passive: true });
  window.addEventListener('visita:deleted', () => { renderGestionHomeBoard().catch(()=>{}); }, { passive: true });
  window.addEventListener('muestreo:created', () => {
    if (muestreosBooted) muestreosTabModule.renderTablaMuestreos(true).catch(() => {});
    renderGestionHomeBoard().catch(() => {});
  }, { passive: true });
  window.addEventListener('muestreo:updated', () => {
    if (muestreosBooted) muestreosTabModule.renderTablaMuestreos(true).catch(() => {});
    renderGestionHomeBoard().catch(() => {});
  }, { passive: true });

  const onResize = rafThrottle(() => {
    adjustDT('#tablaContactos'); hideNativeFilter('#tablaContactos');
    if (visitasBooted)  { adjustDT('#tablaVisitas');  hideNativeFilter('#tablaVisitas'); }
    if (personasBooted) { adjustDT('#tablaPersonas'); hideNativeFilter('#tablaPersonas'); }
  });
  window.addEventListener('resize', onResize);

  document.getElementById('btnNuevoContacto')?.addEventListener('click', (e)=>{
    e.preventDefault();
    try { prepararNuevo(); } catch {}
    getModalInstance('modalContacto')?.open();
  });

  listenersHooked = true;
}

/* ======================= Arranque ======================= */
document.addEventListener('DOMContentLoaded', () => {
  ensureGestionBoardModule();
  initContactosTab().catch(console.error);
});

/* ======================= Exponer helpers ======================= */
window.abrirDetalleContacto = abrirDetalleContacto;
window.abrirModalVisita = abrirModalVisita;
window.nukeStuckOverlays = nukeStuckOverlays;
