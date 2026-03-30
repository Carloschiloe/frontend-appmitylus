// /js/abastecimiento/planificacion/index.js
// Controller: orquesta estado + eventos; delega cálculos a calc.buildViewModel

import { apiGetCentros, apiContactosDisponibles } from '../../core/api.js';
import { initUI, planSetData, populateProveedoresYCentros } from './ui/view.js';
import { state, loadState, saveBlocks, saveParams, saveFiltros } from './state.js';
import { setVal, val, num, number, clampAnio,
         isoWeekString, fmtMonth, yearFromWeekStr, weekStrToDate } from './utils.js';
import { buildViewModel } from './calc.js';

// Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  await initUI();
  await init();
});

let _initialized = false;
async function init(){
  if (_initialized) return;

  await cargarCentros();
  loadState();
  prepararUI();

  // proveedores + centros en UI
  populateProveedoresYCentros({ proveedores: state.proveedores, centros: state.centros });

  setDefaultPeriodIfNeeded();
  render();
  _initialized = true;
}

/* ============================
   LOADERS
============================ */
async function cargarCentros(){
  try {
    const arr = await apiGetCentros();
    state.centros = Array.isArray(arr) ? arr : (arr.items || arr.data || []);
    state.centros.forEach(c => { if (!c.proveedor) c.proveedor = ''; });
    const setp = new Set(state.centros.map(c => (c.proveedor || '').trim()).filter(Boolean));
    state.proveedores = Array.from(setp).sort((a,b)=>a.localeCompare(b));
  } catch (e) {
    console.error('[plan] apiGetCentros error', e);
    state.centros = []; state.proveedores = [];
  }
}

/* ============================
   UI WIRING
============================ */
function prepararUI(){
  // Params → inputs
  setVal('#p_objetivo', state.params.objetivo);
  setVal('#p_lead', state.params.lead);
  setVal('#p_buffer', state.params.buffer);

  const semana = document.querySelector('#f_semana');
  const mes    = document.querySelector('#f_mes');
  const anio   = document.querySelector('#f_anio');
  const vista  = document.querySelector('#f_vista');
  const escenario = document.querySelector('#f_escenario');
  const buscar = document.querySelector('#f_buscar');
  const soloConf = document.querySelector('#f_soloConfirmado');
  const ocCanc = document.querySelector('#f_ocultarCancelados');

  // Periodo
  semana?.addEventListener('change', () => { state.filtros.semana = semana.value || null; saveFiltros(); render(); });
  mes?.addEventListener('change',    () => { state.filtros.mes    = mes.value || null;    saveFiltros(); render(); });
  anio?.addEventListener('change',   () => { state.filtros.anio   = clampAnio(anio.value); setVal('#f_anio', state.filtros.anio); saveFiltros(); render(); });

  // Vista
  vista?.addEventListener('change', () => {
    state.filtros.vista = vista.value || 'semana';
    toggleVistaUI();
    setDefaultPeriodIfNeeded();
    saveFiltros();
    render();
  });

  // Navegación de periodo
  document.querySelector('#btnPrevPeriodo')?.addEventListener('click', () => navigatePeriodo(-1));
  document.querySelector('#btnNextPeriodo')?.addEventListener('click', () => navigatePeriodo(+1));
  document.querySelector('#btnHoy')?.addEventListener('click', (e)=>{ e.preventDefault(); setDefaultPeriodIfNeeded(); saveFiltros(); render(); });
  document.querySelector('#btnReset')?.addEventListener('click', (e)=>{
    e.preventDefault();
    state.filtros.texto=''; setVal('#f_buscar','');
    state.filtros.soloConfirmado=false; const sc=document.querySelector('#f_soloConfirmado'); if(sc) sc.checked=false;
    state.filtros.ocultarCancelados=true; const oc=document.querySelector('#f_ocultarCancelados'); if(oc) oc.checked=true;
    saveFiltros(); render();
  });

  // Escenario
  escenario?.addEventListener('change', () => { state.filtros.escenario = escenario.value || 'base'; saveFiltros(); render(); });

  // Búsqueda (cliente)
  let tmr = null;
  buscar?.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(()=>{ state.filtros.texto = (buscar.value||'').trim().toLowerCase(); render(); }, 160); });

  // Toggles
  soloConf?.addEventListener('change', () => { state.filtros.soloConfirmado = !!soloConf.checked; render(); });
  ocCanc?.addEventListener('change', () => { state.filtros.ocultarCancelados = !!ocCanc.checked; render(); });

  // Guardar parámetros
  document.querySelector('#btnGuardarParametros')?.addEventListener('click', () => {
    state.params.objetivo = num('#p_objetivo', 400);
    state.params.lead = num('#p_lead', 7);
    state.params.buffer = num('#p_buffer', 2);
    saveParams();
    M.toast?.({ html:'Parámetros guardados', classes:'teal', displayLength:1500 });
    render();
  });

  // *** Importar contactos → bloques ***
  document.getElementById('btnImportarContactos')?.addEventListener('click', async () => {
    try {
      const q = (state.filtros.texto || '').trim();
      await importarDesdeContactos({ minTons: 0, q }); // ← por defecto 0 para no filtrar contactos sin tons
    } catch (e) {
      console.error(e);
      M.toast?.({ html:'No se pudo importar', classes:'red' });
    }
  });

  // Modal CRUD
  const form = document.querySelector('#formBloque');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = leerFormBloque();
    if (!payload.fecha || !payload.proveedor || !isFinite(payload.tons)) {
      M.toast?.({ html:'Completa fecha, proveedor y toneladas', displayLength:1800 }); return;
    }

    if (state.editingId) {
      const idx = state.bloques.findIndex(b => b._id === state.editingId);
      if (idx >= 0) state.bloques[idx] = { ...state.bloques[idx], ...payload };
      state.editingId = null;
      M.toast?.({ html:'Bloque actualizado', classes:'teal' });
    } else {
      payload._id = (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
      state.bloques.push(payload);
      M.toast?.({ html:'Bloque agregado', classes:'teal' });
    }

    saveBlocks();
    cerrarModalBloque();
    form.reset();
    render();
  });

  // Tabla: delegación editar/eliminar
  const jq = window.jQuery || window.$;
  jq('#tablaProgramaSemanal tbody')
    .on('click', 'a.icon-action.editar', function(){
      const id = this.dataset.id || '';
      const b = state.bloques.find(x => String(x._id) === String(id));
      if (b) abrirModalEditar(b);
    })
    .on('click', 'a.icon-action.eliminar', function(){
      const id = this.dataset.id || '';
      if (!confirm('¿Eliminar este bloque?')) return;
      state.bloques = state.bloques.filter(x => String(x._id) !== String(id));
      saveBlocks();
      render();
      M.toast?.({ html:'Eliminado', displayLength:1200 });
    });

  toggleVistaUI();
}

function toggleVistaUI(){
  const v = state.filtros.vista || 'semana';
  document.querySelector('#wrap_semana')?.classList.toggle('hidden', v !== 'semana');
  document.querySelector('#wrap_mes')?.classList.toggle('hidden',    v !== 'mes');
  document.querySelector('#wrap_anio')?.classList.toggle('hidden',   v !== 'anio');
}

function navigatePeriodo(delta){
  const v = state.filtros.vista || 'semana';
  if (v === 'semana') {
    const curr = state.filtros.semana || isoWeekString(new Date());
    const d = weekStrToDate(curr); d.setDate(d.getDate() + delta*7);
    const next = isoWeekString(d); if (yearFromWeekStr(next) > 2027) return;
    state.filtros.semana = next; setVal('#f_semana', next);
  } else if (v === 'mes') {
    const base = state.filtros.mes || fmtMonth(new Date());
    const [y,m] = base.split('-').map(Number);
    const d = new Date(y, m-1, 1); d.setMonth(d.getMonth() + delta);
    const y2 = d.getFullYear(), m2 = d.getMonth()+1; if (y2 > 2027) return;
    const next = `${y2}-${String(m2).padStart(2,'0')}`; state.filtros.mes = next; setVal('#f_mes', next);
  } else {
    let y = Number(state.filtros.anio || new Date().getFullYear());
    y = clampAnio(String(y + delta)); state.filtros.anio = y; setVal('#f_anio', y);
  }
  saveFiltros(); render();
}

function setDefaultPeriodIfNeeded(){
  const v = state.filtros.vista || 'semana';
  if (v === 'semana') { if (!state.filtros.semana) state.filtros.semana = isoWeekString(new Date()); setVal('#f_semana', state.filtros.semana); }
  else if (v === 'mes') { if (!state.filtros.mes) state.filtros.mes = fmtMonth(new Date()); setVal('#f_mes', state.filtros.mes); }
  else { if (!state.filtros.anio) state.filtros.anio = String(new Date().getFullYear()); setVal('#f_anio', state.filtros.anio); }
}

function render(){
  planSetData(buildViewModel(state));
}

/* ===== Modal helpers ===== */
function leerFormBloque(){
  return {
    fecha: val('#b_fecha').slice(0,10),
    proveedor: val('#b_proveedor').trim(),
    centro: val('#b_centro') || '',
    tons: number(val('#b_tons')),
    estado: val('#b_estado') || 'Planificado',
    prioridad: val('#b_prioridad') || 'Media',
    origen: 'Manual',
    notas: val('#b_notas') || '',
    escenario: state.filtros.escenario || 'base',
  };
}
function abrirModalEditar(b){
  state.editingId = b._id;
  setVal('#b_fecha', b.fecha?.slice(0,10) || '');
  setVal('#b_proveedor', b.proveedor || '');
  setVal('#b_centro', b.centro || '');
  setVal('#b_tons', b.tons ?? '');
  setVal('#b_estado', b.estado || 'Planificado');
  setVal('#b_prioridad', b.prioridad || 'Media');
  setVal('#b_notas', b.notas || '');
  M.updateTextFields?.();
  const el = document.getElementById('modalBloque');
  const modal = M.Modal.getInstance(el) || M.Modal.init(el);
  modal.open();
}
function cerrarModalBloque(){
  const modal = M.Modal.getInstance(document.getElementById('modalBloque'));
  modal?.close();
}

/* ===== Importar contactos → bloques ===== */
async function importarDesdeContactos({ minTons = 0, q = '' } = {}) {
  const btn = document.getElementById('btnImportarContactos');
  const prevText = btn?.textContent;
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }

    // 1) pedir contactos disponibles al backend (con filtro opcional de búsqueda)
    const items = await apiContactosDisponibles({ q, minTons });

    if (!items.length) {
      M.toast?.({ html:'No hay contactos con disponibilidad', displayLength: 1800 });
      return;
    }

    // 2) mapear a bloques planificados (evitando duplicados simples)
    const hoy = new Date().toISOString().slice(0,10);
    let creados = 0;

    items.forEach(c => {
      const fecha = c.fechaDisp || hoy;
      const proveedor = c.proveedorNombre || '(sin nombre)';
      const centro = c.centroCodigo || '';
      const tons = Number(c.tonsAprox) || 0;

      const dup = state.bloques.some(b =>
        b.proveedor === proveedor && b.fecha === fecha && Number(b.tons) === tons
      );
      if (dup) return;

      state.bloques.push({
        _id: (Date.now().toString(36) + Math.random().toString(36).slice(2,8)),
        fecha,
        proveedor,
        centro,
        tons,
        estado: 'Planificado',
        prioridad: 'Media',
        origen: 'Contactos',
        notas: c.observaciones || '',
        escenario: state.filtros.escenario || 'base',
      });
      creados++;
    });

    if (creados > 0) {
      saveBlocks();
      render();
    }
    M.toast?.({ html:`Importados ${creados} contactos`, classes:'teal' });

  } catch (e) {
    console.error('[plan] importarDesdeContactos', e);
    M.toast?.({ html:'API no disponible (configura /api/contactos/disponibles)', classes:'red' });
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = prevText || 'Importar contactos'; }
  }
}
