// js/abastecimiento/asignacion/mensual.js
// Gestión mensual (macro) + detalle filtrado por mes, con “saldo post” por proveedor.

import * as api from './api.js';
import * as estado from './estado.js';
import { fmt } from './utilidades.js';

/* ========== helpers DOM seguros ========== */
const $ = (sel, root = document) => root.querySelector(sel);
const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
const pad2 = n => String(n).padStart(2,'0');

const toMesKey = (val) => {
  if (!val) return '';
  if (/^\d{4}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ========== backend fallbacks ========== */
// Requerimiento mensual
async function fetchRequerimiento(mesKey, tipo){
  // 1) api.getPlanMes (recomendado)
  if (typeof api.getPlanMes === 'function') {
    try{
      // acepta string 'YYYY-MM' o {mesKey}
      const r = await api.getPlanMes(mesKey);
      // puede venir {ok:true,item:{mesKey,tons}} o {items:[{mesKey,tons}]}
      if (r?.item) return Number(r.item.tons)||0;
      if (Array.isArray(r?.items)){
        const it = r.items.find(x=>x?.mesKey===mesKey);
        return Number(it?.tons)||0;
      }
      // si vino plano
      return Number(r?.tons)||0;
    }catch(e){ /* continúa al fallback */ }
  }
  // 2) api.getRequerimientoMes(mesKey,tipo)
  if (typeof api.getRequerimientoMes === 'function'){
    try{
      const r = await api.getRequerimientoMes(mesKey, tipo);
      return Number(r?.tons)||0;
    }catch(e){ /* continúa */ }
  }
  // 3) Llamada directa al backend /planificacion/mes?mesKey=YYYY-MM
  try{
    const r = await fetch(`${api.API_URL}/planificacion/mes?mesKey=${encodeURIComponent(mesKey)}`, {headers:{'Accept':'application/json'}});
    if(!r.ok) throw new Error();
    const j = await r.json();
    if (j?.item) return Number(j.item.tons)||0;
    if (Array.isArray(j?.items)){
      const it = j.items.find(x=>x?.mesKey===mesKey);
      return Number(it?.tons)||0;
    }
    return Number(j?.tons)||0;
  }catch(_){ return 0; }
}

async function guardarRequerimiento(mesKey, tipo, tons){
  // 1) api.guardarPlanMes
  if (typeof api.guardarPlanMes === 'function'){
    const r = await api.guardarPlanMes({mesKey, tons});
    return r?.ok ? 'server' : 'local';
  }
  // 2) api.guardarRequerimientoMes
  if (typeof api.guardarRequerimientoMes === 'function'){
    const r = await api.guardarRequerimientoMes({mesKey, tipo, tons});
    return r ? 'server' : 'local';
  }
  // Fallback localStorage
  localStorage.setItem(`reqmes:${mesKey}|${(tipo||'ALL').toUpperCase()}`, String(tons));
  return 'local';
}

async function leerRequerimientoGuardado(mesKey, tipo){
  // server
  const t = await fetchRequerimiento(mesKey, tipo);
  if (t>0) return t;
  // local fallback
  const raw = localStorage.getItem(`reqmes:${mesKey}|${(tipo||'ALL').toUpperCase()}`);
  return raw ? Number(raw)||0 : 0;
}

// Detalle de asignaciones del mes
async function leerAsignacionesMes(mesKey, tipo){
  // 1) api.getAsignacionesMes?
  if (typeof api.getAsignacionesMes === 'function'){
    try{
      const r = await api.getAsignacionesMes({mesKey, tipo});
      return Array.isArray(r?.items) ? r.items : (Array.isArray(r)?r:[]);
    }catch(e){ /* sigue */ }
  }
  // 2) GET directo /asignaciones?mesKey=...
  try{
    const qs = new URLSearchParams({ mesKey });
    if (tipo && tipo!=='ALL') qs.set('tipo', tipo);
    const r = await fetch(`${api.API_URL}/asignaciones?${qs}`, {headers:{'Accept':'application/json'}});
    if(!r.ok) throw new Error();
    const j = await r.json();
    return Array.isArray(j?.items) ? j.items : (Array.isArray(j)?j:[]);
  }catch(_){ return []; }
}

/* ========== KPIs ========== */
async function calcularKPIs(mesKey, tipo){
  const invPorTipo  = estado.totalesMesPorTipo();   // Map "YYYY-MM|TIPO" -> tons
  const asigPorTipo = estado.asignadoMesPorTipo();  // Map "YYYY-MM|TIPO" -> tons

  let disponible = 0;
  if (tipo==='ALL'){
    for(const [k,v] of invPorTipo.entries()) if (k.startsWith(`${mesKey}|`)) disponible+=v;
  }else{
    disponible = invPorTipo.get(`${mesKey}|${tipo}`)||0;
  }

  let asignado = 0;
  if (tipo==='ALL'){
    let porTipos = 0;
    for(const [k,v] of asigPorTipo.entries()) if (k.startsWith(`${mesKey}|`)) porTipos+=v;
    const consol = estado.datos.asignadoPorMes.get(mesKey)||0;
    asignado = porTipos>0 ? porTipos : consol;
  }else{
    asignado = asigPorTipo.get(`${mesKey}|${tipo}`)||0;
  }

  const requerimiento = await leerRequerimientoGuardado(mesKey, tipo);
  const saldo = disponible - asignado;
  return { disponible, requerimiento, asignado, saldo };
}

async function pintarKPIs(){
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  if (!mesKey) return;

  const {disponible,requerimiento,asignado,saldo} = await calcularKPIs(mesKey, tipo);
  setText('kpiDisp',  `${fmt(disponible)} t`);
  setText('kpiReq',   `${fmt(requerimiento)} t`);
  setText('kpiAsig',  `${fmt(asignado)} t`);
  setText('kpiSaldo', `${fmt(saldo)} t`);

  const reqInput  = $('#mes_reqTons');
  const asigInput = $('#mes_asigTons');
  if (reqInput && !reqInput.value) reqInput.value = requerimiento>0 ? String(requerimiento) : '';
  if (asigInput) asigInput.placeholder = `máx ${fmt(Math.max(0,saldo))} t`;
  M.updateTextFields?.();
}

/* ========== Detalle del mes (Tabulator) ========== */
let tablaDetalle = null;

function disponibilidadPorProveedor(mesKey){
  // usamos filasEnriquecidas que ya tenías en tu app
  const rows = (estado.filasEnriquecidas?.({tipo:'ALL'})||[])
    .filter(r => r.Mes === mesKey);
  const map = new Map();
  for (const r of rows){
    const prov = r.Proveedor || '';
    map.set(prov, (map.get(prov)||0) + (Number(r.Tons)||0));
  }
  return map; // prov -> disponible en ese mes
}

function construirTablaDetalle(){
  const wrap = $('#mesDetalleTable');
  if (!wrap) return; // si tu HTML no la tiene, no rompemos
  if (tablaDetalle) return;

  tablaDetalle = new Tabulator(wrap, {
    height: '380px',
    layout: 'fitColumns',
    columnMinWidth: 110,
    movableColumns: true,
    reactiveData: true,
    columns: [
      {title:'Proveedor', field:'proveedorNombre', width:280, editor:'input'},
      {title:'Tipo', field:'tipo', width:110, hozAlign:'center'},
      {title:'Toneladas', field:'tons', hozAlign:'right', headerHozAlign:'right',
        editor:(cell)=>({type:'number', min:0, step:0.01}),
        formatter:(c)=>fmt(Number(c.getValue()||0))
      },
      {title:'Camiones', field:'camiones', hozAlign:'right', headerHozAlign:'right',
        formatter:(c)=>fmt(Number(c.getValue()||0))
      },
      {title:'Notas', field:'notas', width:220, editor:'input'},
      {title:'Saldo post', field:'saldoPost', hozAlign:'right', headerHozAlign:'right',
        formatter:(c)=>fmt(Number(c.getValue()||0))
      },
      {title:'Acciones', field:'_actions', width:90, headerSort:false, hozAlign:'center',
        formatter:()=>{
          return `<a class="btn-flat" title="Eliminar">
                    <i class="material-icons red-text">delete</i>
                  </a>`;
        },
        cellClick: async (_e, cell)=>{
          const row = cell.getRow().getData();
          if (!row?.id && !row?._id) return;
          if(!confirm(`¿Eliminar asignación de ${row.proveedorNombre||''}?`)) return;
          try{
            // 1) función de API si existe
            if (typeof api.borrarAsignacion === 'function'){
              await api.borrarAsignacion(row.id || row._id);
            }else{
              // 2) DELETE directo
              const id = row.id || row._id;
              const r = await fetch(`${api.API_URL}/asignaciones/${id}`, {method:'DELETE'});
              if (!r.ok) throw new Error('DELETE falló');
            }
            M.toast?.({html:'Asignación eliminada', classes:'teal'});
            await estado.refrescar(api);
            await recargarTablaDetalle();
            await pintarKPIs();
          }catch(e){
            console.warn(e);
            M.toast?.({html:'No se pudo eliminar (falta endpoint)', classes:'orange'});
          }
        }
      }
    ],
    cellEdited: async (cell)=>{
      // Solo reaccionamos si se editó toneladas o proveedor o notas
      const f = cell.getField();
      if(!['tons','proveedorNombre','notas'].includes(f)) return;
      const row = cell.getRow().getData();
      try{
        if (typeof api.editarAsignacion === 'function'){
          await api.editarAsignacion(row.id || row._id, { tons: Number(row.tons)||0, proveedorNombre: row.proveedorNombre||'', notas: row.notas||'' });
        }else{
          const id = row.id || row._id;
          await fetch(`${api.API_URL}/asignaciones/${id}`, {
            method:'PATCH',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ tons: Number(row.tons)||0, proveedorNombre: row.proveedorNombre||'', notas: row.notas||'' })
          }).then(r=>{ if(!r.ok) throw new Error('PATCH falló'); });
        }
        M.toast?.({html:'Asignación actualizada', classes:'teal'});
        await estado.refrescar(api);
        await recargarTablaDetalle();
        await pintarKPIs();
      }catch(e){
        console.error(e);
        M.toast?.({html:'No se pudo actualizar (falta endpoint)', classes:'orange'});
      }
    }
  });
}

async function recargarTablaDetalle(){
  if (!tablaDetalle) return;
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  const q      = ($('#mes_buscar')?.value || '').toLowerCase();
  const onlyMacro = !!$('#mes_onlyMacro')?.checked;

  // datos crudos del backend
  let rows = await leerAsignacionesMes(mesKey, tipo);

  // filtro por fuente si piden “macro”
  if (onlyMacro){
    rows = rows.filter(x=>{
      const s = String(x.fuente||'').toLowerCase();
      return s.includes('mensual') || s.includes('macro');
    });
  }

  // filtro rápido por texto
  if (q){
    rows = rows.filter(x =>
      String(x.proveedorNombre||'').toLowerCase().includes(q) ||
      String(x.notas||'').toLowerCase().includes(q)
    );
  }

  // normalización
  rows = rows.map(x=>({
    id     : x.id || x._id,
    _id    : x._id || x.id,
    proveedorNombre: x.proveedorNombre || '',
    tipo   : (x.tipo || 'NORMAL').toUpperCase(),
    tons   : Number(x.tons || x.asignado || x.total || 0) || 0,
    camiones: Number(x.camiones || 0) || (Number(x.tons||0)/10),
    notas  : x.notas || '',
    createdAt: x.createdAt ? new Date(x.createdAt) : null,
  }));

  // saldo post por proveedor (disponible prov en ese mes - acumulado)
  const dispMap = disponibilidadPorProveedor(mesKey);
  // orden estable: prov asc, luego fecha asc (o índice)
  rows.sort((a,b)=> (a.proveedorNombre||'').localeCompare(b.proveedorNombre||'') ||
                    ((a.createdAt?.getTime()||0) - (b.createdAt?.getTime()||0)));

  const running = new Map(); // prov -> saldo en curso
  for (const r of rows){
    const prov = r.proveedorNombre||'';
    if (!running.has(prov)) running.set(prov, dispMap.get(prov)||0);
    const nuevoSaldo = (running.get(prov)||0) - (Number(r.tons)||0);
    r.saldoPost = nuevoSaldo;
    running.set(prov, nuevoSaldo);
  }

  tablaDetalle.replaceData(rows);
}

/* ========== acciones UI ========== */
async function onGuardarRequerimiento(){
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  const tons   = Number($('#mes_reqTons')?.value || 0);
  if (!mesKey || tons<0) return M.toast?.({html:'Mes y valor válidos', classes:'red'});
  const where = await guardarRequerimiento(mesKey, tipo, tons);
  M.toast?.({html: where==='server' ? 'Requerimiento guardado' : 'Requerimiento guardado localmente', classes:'teal'});
  pintarKPIs();
}

async function onAsignarMacro(){
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  let tons     = Number($('#mes_asigTons')?.value || 0);
  const prov   = ($('#mes_asigProv')?.value || '').trim();
  if (!mesKey || tons<=0) return M.toast?.({html:'Ingresa mes y toneladas > 0', classes:'red'});

  const saldo = estado.saldoMes({mesKey, tipo});
  const asignable = clamp(tons, 0, Math.max(0,saldo));
  if (asignable<=0) return M.toast?.({html:'No hay saldo disponible', classes:'orange'});
  if (asignable<tons) { M.toast?.({html:`Se ajustó a ${fmt(asignable)} t por saldo`, classes:'orange'}); tons = asignable; }

  try{
    await api.crearAsignacion({
      mesKey,
      proveedorNombre: prov || '(macro mensual)',
      tons,
      tipo: tipo==='ALL' ? 'NORMAL' : tipo,
      fuente: 'ui-mensual'
    });
    M.toast?.({html:'Asignación registrada', classes:'teal'});
    $('#mes_asigTons') && ($('#mes_asigTons').value='');
    await estado.refrescar(api);
    await pintarKPIs();
    await recargarTablaDetalle();
  }catch(e){
    console.error(e);
    M.toast?.({html:'Error guardando asignación', classes:'red'});
  }
}

async function onBorrarAsignacionesMes(){
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  if (!mesKey) return;
  if(!confirm(`Borrar asignaciones del mes ${mesKey}${tipo!=='ALL'?' ('+tipo+')':''}?`)) return;

  try{
    if (typeof api.borrarAsignacionesMes === 'function'){
      await api.borrarAsignacionesMes({mesKey, tipo});
    }else{
      // endpoint opcional: si no existe, avisamos
      throw new Error('missing endpoint');
    }
    M.toast?.({html:'Asignaciones del mes borradas', classes:'teal'});
    await estado.refrescar(api);
    await pintarKPIs();
    await recargarTablaDetalle();
  }catch(e){
    M.toast?.({html:'Falta endpoint de borrado en backend', classes:'orange'});
  }
}

async function onActualizar(){
  try{ await estado.refrescar(api); }catch(e){ console.warn(e); }
  await pintarKPIs();
  await recargarTablaDetalle();
}

function onReset(){
  $('#mes_buscar') && ($('#mes_buscar').value='');
  $('#mes_asigTons') && ($('#mes_asigTons').value='');
  $('#mes_onlyMacro') && ($('#mes_onlyMacro').checked=false);
  M.updateTextFields?.();
  recargarTablaDetalle();
}

/* ========== montar ========== */
export function montar(){
  // deja por defecto el mes actual si está vacío
  const inp = $('#mes_mes');
  if (inp && !inp.value){
    const d = new Date();
    inp.value = `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  }

  // listeners suaves (no fallan si falta algún input)
  $('#mes_mes')?.addEventListener('change', async()=>{ await pintarKPIs(); await recargarTablaDetalle(); });
  $('#mes_tipo')?.addEventListener('change', async()=>{ await pintarKPIs(); await recargarTablaDetalle(); });
  $('#mes_buscar')?.addEventListener('input', recargarTablaDetalle);
  $('#mes_onlyMacro')?.addEventListener('change', recargarTablaDetalle);

  $('#mes_btnActualizar')?.addEventListener('click', onActualizar);
  $('#mes_btnReset')?.addEventListener('click', onReset);
  $('#mes_btnGuardarReq')?.addEventListener('click', onGuardarRequerimiento);
  $('#mes_btnAsignar')?.addEventListener('click', onAsignarMacro);
  $('#mes_btnBorrarAsig')?.addEventListener('click', onBorrarAsignacionesMes);

  // tabla detalle (si existe el contenedor)
  construirTablaDetalle();

  // primer render
  pintarKPIs().then(recargarTablaDetalle).catch(()=>{ /* silencioso */ });
  // al redimensionar, ajustar altura
  window.addEventListener('resize', ()=>{ if (tablaDetalle){ /* Tabulator se auto-ajusta, nada que hacer */ } });
}

