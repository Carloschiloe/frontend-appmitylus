// Gestión mensual (macro): KPIs + detalle editable + resumen anual
// Requiere: Materialize, Tabulator, api.js, estado.js, utilidades.js

import * as api from './api.js';
import * as estado from './estado.js';
import { fmt } from './utilidades.js';

/* ========= Helpers DOM ========= */
const $ = (sel, root = document) => root.querySelector(sel);
const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

const toMesKey = (val /* "YYYY-MM" o Date o "" */) => {
  if (!val) return '';
  if (/^\d{4}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ========= Contenedores creados dinámicamente ========= */
function ensureCards() {
  const host = $('#tabInventario');
  if (!host) return {};

  // 1) Card de detalle asignaciones
  let detalleWrap = $('#mesDetalleWrap');
  if (!detalleWrap) {
    detalleWrap = document.createElement('div');
    detalleWrap.id = 'mesDetalleWrap';
    detalleWrap.className = 'card-soft';
    detalleWrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap">
        <h6 style="margin:6px 0">Detalle de asignaciones del mes</h6>
        <div style="display:flex;gap:8px">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px">
            <input type="checkbox" id="mes_soloMacro" class="filled-in"/><span>Mostrar solo “macro mensual”</span>
          </label>
        </div>
      </div>
      <div id="mesDetalle"></div>
      <div class="grey-text" style="margin-top:6px">Haz doble clic en <b>Proveedor</b> o <b>Toneladas</b> para editar. Usa el ícono 🗑 para borrar una asignación.</div>
    `;
    // Insertar inmediatamente DESPUÉS del primer card (el de KPI)
    const firstCard = host.querySelector('.card-soft');
    (firstCard?.nextSibling ? host.insertBefore(detalleWrap, firstCard.nextSibling) : host.appendChild(detalleWrap));
  }

  // 2) Card de resumen anual
  let anualWrap = $('#mesAnualWrap');
  if (!anualWrap) {
    anualWrap = document.createElement('div');
    anualWrap.id = 'mesAnualWrap';
    anualWrap.className = 'card-soft';
    anualWrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap">
        <h6 style="margin:6px 0">Resumen anual</h6>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="mes_anio" type="number" min="2000" max="2100" style="max-width:120px" />
          <a id="mes_btnAnio" class="btn grey darken-2"><i class="material-icons left" style="margin:0">refresh</i>Ver año</a>
        </div>
      </div>
      <div id="mesAnual"></div>
      <div class="grey-text" style="margin-top:6px">Clic en un mes del resumen para saltar al KPI y detalle de ese mes.</div>
    `;
    host.appendChild(anualWrap);
  }

  return { detalleWrap, anualWrap };
}

/* ========= Requerimientos (con fallback) =========
   Usa endpoints si existen:
   - api.getRequerimientoMes(mesKey, tipo?) -> { tons }
   - api.guardarRequerimientoMes({mesKey, tipo, tons})
   Fallback a localStorage si no están implementados.
*/
const REQ_LS_PREFIX = 'reqmes:'; // clave localStorage: reqmes:YYYY-MM|TIPO
const keyReq = (mesKey, tipo) => `${REQ_LS_PREFIX}${mesKey}|${(tipo || 'ALL').toUpperCase()}`;

async function getRequerimiento(mesKey, tipo) {
  try {
    if (typeof api.getRequerimientoMes === 'function') {
      const r = await api.getRequerimientoMes(mesKey, tipo);
      return Number(r?.tons) || 0;
    }
  } catch (e) {
    console.warn('[mensual] getRequerimientoMes backend falló; uso localStorage', e);
  }
  const raw = localStorage.getItem(keyReq(mesKey, tipo));
  return raw ? Number(raw) || 0 : 0;
}
async function guardarRequerimiento(mesKey, tipo, tons) {
  try {
    if (typeof api.guardarRequerimientoMes === 'function') {
      await api.guardarRequerimientoMes({ mesKey, tipo, tons });
      return 'server';
    }
  } catch (e) {
    console.warn('[mensual] guardarRequerimientoMes backend falló; guardo local', e);
  }
  localStorage.setItem(keyReq(mesKey, tipo), String(tons));
  return 'local';
}

/* ========= KPIs ========= */
async function calcularKPIs(mesKey, tipo) {
  // Requiere estado.cargarTodo(api) antes (se hace en principal.js)
  const invPorTipo = estado.totalesMesPorTipo();   // Map "YYYY-MM|TIPO" -> tons
  const asigPorTipo = estado.asignadoMesPorTipo(); // Map "YYYY-MM|TIPO" -> tons

  let disponible = 0;
  let asignado = 0;

  if (tipo === 'ALL') {
    // Sumar por todos los tipos para ese mes
    for (const [k, v] of invPorTipo.entries()) if (k.startsWith(`${mesKey}|`)) disponible += v;
    let asigPorTipos = 0;
    for (const [k, v] of asigPorTipo.entries()) if (k.startsWith(`${mesKey}|`)) asigPorTipos += v;
    const asigMesConsolidado = estado.datos.asignadoPorMes.get(mesKey) || 0;
    asignado = asigPorTipos > 0 ? asigPorTipos : asigMesConsolidado;
  } else {
    disponible = invPorTipo.get(`${mesKey}|${tipo}`) || 0;
    asignado   = asigPorTipo.get(`${mesKey}|${tipo}`) || 0;
  }

  const requerimiento = await getRequerimiento(mesKey, tipo);
  const saldo = disponible - asignado;

  return { disponible, requerimiento, asignado, saldo };
}

async function actualizarKPIs() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  if (!mesKey) return;

  const { disponible, requerimiento, asignado, saldo } = await calcularKPIs(mesKey, tipo);
  setText('kpiDisp',  `${fmt(disponible)} t`);
  setText('kpiReq',   `${fmt(requerimiento)} t`);
  setText('kpiAsig',  `${fmt(asignado)} t`);
  setText('kpiSaldo', `${fmt(saldo)} t`);

  const reqInput  = $('#mes_reqTons');
  const asigInput = $('#mes_asigTons');
  if (reqInput && !reqInput.value) reqInput.value = requerimiento || '';
  if (asigInput) asigInput.placeholder = `máx ${fmt(Math.max(0, saldo))} t`;

  // refrescar tablas
  await cargarDetalleAsignaciones();
  await cargarResumenAnual();
  M.updateTextFields?.();
}

/* ========= Acciones KPI ========= */
async function onGuardarRequerimiento() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  const tons   = Number($('#mes_reqTons')?.value || 0);
  if (!mesKey || tons < 0) return M.toast?.({ html: 'Mes y valor válidos', classes: 'red' });

  const where = await guardarRequerimiento(mesKey, tipo, tons);
  M.toast?.({ html: where === 'server' ? 'Requerimiento guardado' : 'Requerimiento guardado localmente (sin backend)', classes: 'teal' });
  actualizarKPIs();
}

async function onAsignarMacro() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  let tons     = Number($('#mes_asigTons')?.value || 0);
  const proveedor = ($('#mes_asigProv')?.value || '').trim();

  if (!mesKey || tons <= 0) return M.toast?.({ html: 'Ingresa mes y toneladas > 0', classes: 'red' });

  // Valida contra saldo mensual (por tipo)
  const saldo = estado.saldoMes({ mesKey, tipo });
  const asignable = clamp(tons, 0, Math.max(0, saldo));
  if (asignable <= 0) return M.toast?.({ html: 'No hay saldo disponible en el mes/tipo seleccionado', classes: 'orange' });
  if (asignable < tons) { M.toast?.({ html: `Se ajustó a ${fmt(asignable)} t por saldo`, classes: 'orange' }); tons = asignable; }

  try {
    await api.crearAsignacion({
      mesKey,
      proveedorNombre: proveedor || '(macro mensual)',
      tons,
      tipo: tipo === 'ALL' ? 'NORMAL' : tipo,
      fuente: 'ui-mensual'
    });

    M.toast?.({ html: 'Asignación registrada', classes: 'teal' });
    await estado.refrescar(api);
    const asigInput = $('#mes_asigTons'); if (asigInput) asigInput.value = '';
    actualizarKPIs();
  } catch (e) {
    console.error(e);
    M.toast?.({ html: 'Error guardando asignación', classes: 'red' });
  }
}

async function onBorrarAsignacionesMes() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  if (!mesKey) return;

  if (!confirm(`Borrar asignaciones del mes ${mesKey}${tipo !== 'ALL' ? ' (' + tipo + ')' : ''}?`)) return;

  try {
    if (typeof api.borrarAsignacionesMes === 'function') {
      await api.borrarAsignacionesMes({ mesKey, tipo });
    } else {
      // fallback: endpoint genérico si existe
      await fetch(`${api.API_URL}/asignaciones?mesKey=${encodeURIComponent(mesKey)}&tipo=${encodeURIComponent(tipo)}`, { method: 'DELETE' });
    }
    M.toast?.({ html: 'Asignaciones del mes borradas', classes: 'teal' });
    await estado.refrescar(api);
    actualizarKPIs();
  } catch (e) {
    console.warn(e);
    M.toast?.({ html: 'No hay endpoint de borrado masivo en backend.', classes: 'orange' });
  }
}

/* ========= DETALLE DE ASIGNACIONES (tabla editable) ========= */
let tablaDetalle = null;

// Helpers de backend genéricos para detalle
async function backendListAsignaciones(mesKey, tipo) {
  // Prioriza api.getAsignacionesMes si existe
  if (typeof api.getAsignacionesMes === 'function') {
    const r = await api.getAsignacionesMes(mesKey, tipo);
    return Array.isArray(r?.items) ? r.items : (Array.isArray(r) ? r : []);
  }
  // fallback GET
  const qs = new URLSearchParams({ mesKey, tipo });
  const resp = await fetch(`${api.API_URL}/asignaciones?${qs}`);
  if (!resp.ok) return [];
  const json = await resp.json().catch(()=> ({}));
  return Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
}
async function backendPatchAsignacion(id, patch) {
  if (typeof api.actualizarAsignacion === 'function') return api.actualizarAsignacion(id, patch);
  const resp = await fetch(`${api.API_URL}/asignaciones/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: {'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify(patch)
  });
  if (!resp.ok) throw new Error('PATCH asignación falló');
  return resp.json().catch(()=> ({}));
}
async function backendDeleteAsignacion(id) {
  if (typeof api.borrarAsignacion === 'function') return api.borrarAsignacion(id);
  const resp = await fetch(`${api.API_URL}/asignaciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error('DELETE asignación falló');
  return resp.json().catch(()=> ({}));
}

async function cargarDetalleAsignaciones() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  if (!mesKey) return;

  let rows = await backendListAsignaciones(mesKey, tipo);
  // Normaliza campos mínimos
  rows = rows.map(x => ({
    _id:            x._id || x.id || `${mesKey}-${x.proveedorNombre||''}-${x.tipo||'NORMAL'}`,
    mesKey:         x.mesKey || mesKey,
    proveedorNombre:x.proveedorNombre || '',
    tipo:           (x.tipo || 'NORMAL').toUpperCase(),
    tons:           Number(x.tons ?? x.asignado ?? x.total ?? 0) || 0,
    camiones:       Number(x.camiones || 0) || 0,
    fuente:         x.fuente || '',
    notas:          x.notas || ''
  }));

  // filtro “solo macro”
  const soloMacro = $('#mes_soloMacro')?.checked;
  if (soloMacro) rows = rows.filter(r => r.fuente === 'ui-mensual' || r.proveedorNombre === '(macro mensual)');

  // Construcción/actualización de Tabulator
  const el = $('#mesDetalle');
  if (!el) return;

  const cols = [
    { title: 'Proveedor', field:'proveedorNombre', editor:'input', width:280, headerSort:true },
    { title: 'Tipo', field:'tipo', width:100, hozAlign:'center',
      editor: 'select', editorParams:{ values:['NORMAL','BAP'] } },
    { title: 'Toneladas', field:'tons', width:130, hozAlign:'right',
      formatter: c => fmt(Number(c.getValue()||0)), editor: 'number', validator: ['min:0'] },
    { title: 'Camiones', field:'camiones', width:120, hozAlign:'right', editor:'number', validator:['min:0'] },
    { title: 'Fuente', field:'fuente', width:140, hozAlign:'left' },
    { title: 'Notas', field:'notas', editor:'input' },
    { title: 'Acciones', field:'_actions', width:110, hozAlign:'center', headerSort:false,
      formatter: () => '🗑',
      cellClick: async (_e, cell) => {
        const row = cell.getRow()?.getData();
        if (!row?._id) return;
        if (!confirm('¿Borrar esta asignación?')) return;
        try {
          await backendDeleteAsignacion(row._id);
          M.toast?.({ html:'Asignación borrada', classes:'teal' });
          await estado.refrescar(api);
          actualizarKPIs();
        } catch (e) {
          console.error(e);
          M.toast?.({ html:'Error al borrar', classes:'red' });
        }
      }
    }
  ];

  if (tablaDetalle) {
    tablaDetalle.setColumns(cols);
    tablaDetalle.setData(rows);
  } else {
    tablaDetalle = new Tabulator(el, {
      data: rows,
      layout: 'fitColumns',
      reactiveData: true,
      columnMinWidth: 110,
      height: '330px',
      columns: cols,
      // actualiza en backend al editar
      cellEdited: async (cell) => {
        const row = cell.getRow()?.getData();
        if (!row?._id) return;
        const patch = {};
        const field = cell.getField();
        patch[field] = row[field];
        try {
          await backendPatchAsignacion(row._id, patch);
          M.toast?.({ html:'Asignación actualizada', classes:'teal' });
          await estado.refrescar(api);
          actualizarKPIs();
        } catch (e) {
          console.error(e);
          M.toast?.({ html:'No se pudo actualizar (ver backend)', classes:'orange' });
        }
      }
    });
    // re-render al togglear filtro macro
    $('#mes_soloMacro')?.addEventListener('change', cargarDetalleAsignaciones);
  }
}

/* ========= RESUMEN ANUAL ========= */
let tablaAnual = null;

async function cargarResumenAnual() {
  const mesKeySel = toMesKey($('#mes_mes')?.value);
  if (!mesKeySel) return;
  const anio = Number(mesKeySel.slice(0,4));
  const tipo = ($('#mes_tipo')?.value || 'ALL').toUpperCase();

  // 1) Requerido del backend para todo el año
  let reqByMes = new Map();
  try {
    if (typeof api.getRequerimientoRango === 'function') {
      const items = await api.getRequerimientoRango({ from:`${anio}-01`, to:`${anio}-12` });
      for (const it of (items?.items || items || [])) reqByMes.set(it.mesKey, Number(it.tons)||0);
    } else {
      // fallback: endpoint general del router /planificacion/mes?anio=YYYY
      const resp = await fetch(`${api.API_URL}/planificacion/mes?anio=${anio}`);
      const json = await resp.json().catch(()=> ({}));
      const arr = Array.isArray(json?.items) ? json.items : [];
      for (const it of arr) reqByMes.set(it.mesKey, Number(it.tons)||0);
    }
  } catch (e) {
    console.warn('[mensual] No pude leer plan anual', e);
  }

  // 2) Disponible y Asignado desde estado.* (por tipo o ALL)
  const invPorTipo  = estado.totalesMesPorTipo();   // Map "YYYY-MM|TIPO"
  const asigPorTipo = estado.asignadoMesPorTipo();  // Map "YYYY-MM|TIPO"
  const months = Array.from({length:12}, (_,i)=> `${anio}-${String(i+1).padStart(2,'0')}`);

  const rows = months.map(mk=>{
    let disp = 0, asig = 0;
    if (tipo === 'ALL') {
      for (const [k,v] of invPorTipo.entries())  if (k.startsWith(`${mk}|`)) disp += v;
      let aPT=0; for (const [k,v] of asigPorTipo.entries()) if (k.startsWith(`${mk}|`)) aPT += v;
      const aCons = estado.datos.asignadoPorMes.get(mk) || 0;
      asig = aPT>0?aPT:aCons;
    } else {
      disp = invPorTipo.get(`${mk}|${tipo}`) || 0;
      asig = asigPorTipo.get(`${mk}|${tipo}`) || 0;
    }
    const req  = reqByMes.get(mk) || 0;
    const saldo= disp - asig;
    return { Mes: mk, Requerido: req, Disponible: disp, Asignado: asig, Saldo: saldo };
  });

  const el = $('#mesAnual');
  if (!el) return;

  const cols = [
    { title:'Mes', field:'Mes', width:110 },
    { title:'Requerido', field:'Requerido', hozAlign:'right', formatter:c=>fmt(c.getValue()||0) },
    { title:'Disponible', field:'Disponible', hozAlign:'right', formatter:c=>fmt(c.getValue()||0) },
    { title:'Asignado', field:'Asignado', hozAlign:'right', formatter:c=>fmt(c.getValue()||0) },
    { title:'Saldo', field:'Saldo', hozAlign:'right',
      formatter:c=>{
        const v = Number(c.getValue()||0);
        const s = fmt(v);
        return v<0 ? `<span style="color:#c62828;font-weight:600">${s}</span>` : s;
      }
    }
  ];

  if (tablaAnual) {
    tablaAnual.setColumns(cols);
    tablaAnual.setData(rows);
  } else {
    tablaAnual = new Tabulator(el, {
      data: rows,
      layout: 'fitColumns',
      columnMinWidth: 110,
      height: '380px',
      columns: cols,
      rowClick: (_e, row) => {
        const mk = row.getData()?.Mes;
        const inp = $('#mes_mes');
        if (mk && inp) {
          inp.value = mk;
          M.updateTextFields?.();
          actualizarKPIs();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    });
    // Año actual por defecto en el input
    const anioInp = $('#mes_anio');
    if (anioInp) anioInp.value = anio;
    $('#mes_btnAnio')?.addEventListener('click', ()=>{
      const y = Number($('#mes_anio')?.value || anio);
      if (!Number.isFinite(y) || y<2000 || y>2100) return;
      const setMonth = `${y}-${String(Math.min(12, Math.max(1, Number(toMesKey($('#mes_mes')?.value).slice(5,7))||1))).padStart(2,'0')}`;
      if ($('#mes_mes')) { $('#mes_mes').value = setMonth; M.updateTextFields?.(); }
      actualizarKPIs();
    });
  }
}

/* ========= Montaje ========= */
export function montar() {
  // Asegurar tarjetas nuevas (detalle + anual)
  ensureCards();

  // Inicializa selects Materialize
  M.FormSelect.init(document.querySelectorAll('select'));

  // Defaults (si falta valor de mes)
  const mesInp = $('#mes_mes');
  if (mesInp && !mesInp.value) {
    const d = new Date();
    mesInp.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  M.updateTextFields?.();

  // Listeners KPI
  $('#mes_mes')?.addEventListener('change', actualizarKPIs);
  $('#mes_tipo')?.addEventListener('change', actualizarKPIs);
  $('#mes_btnActualizar')?.addEventListener('click', async ()=>{
    try{ await estado.refrescar(api); }catch(e){ console.error(e); }
    actualizarKPIs();
  });
  $('#mes_btnReset')?.addEventListener('click', ()=>{
    const buscar = $('#mes_buscar'); if (buscar) buscar.value = '';
    const asig = $('#mes_asigTons'); if (asig) asig.value = '';
    M.updateTextFields?.();
    actualizarKPIs();
  });
  $('#mes_btnGuardarReq')?.addEventListener('click', onGuardarRequerimiento);
  $('#mes_btnAsignar')?.addEventListener('click', onAsignarMacro);
  $('#mes_btnBorrarAsig')?.addEventListener('click', onBorrarAsignacionesMes);

  // Primer render
  actualizarKPIs();
}
