// mensual.js — versión simple y legible
// KPI arriba + 2 tablas: Resumen por proveedor y Detalle (editable)

import * as api from './api.js';
import * as estado from './estado.js';
import { fmt } from './utilidades.js';

/* ------------------ helpers básicos ------------------ */
const $  = (s, r=document)=>r.querySelector(s);
const pad2 = (n)=>String(n).padStart(2,'0');
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));

function toMesKey(v){
  if(!v) return '';
  if(/^\d{4}-\d{2}$/.test(v)) return v;
  const d=new Date(v); if(isNaN(d)) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}
function hoyMesKey(){
  const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}

/* ------------------ requerimiento planta ------------------ */
// buscamos primero api.getRequerimientoMes; si no existe, usamos /planificacion/mes
async function getRequerimientoMes(mesKey, tipo){
  if(typeof api.getRequerimientoMes==='function'){
    try{ const r=await api.getRequerimientoMes(mesKey, tipo); return Number(r?.tons)||0; }catch{}
  }
  // fallback al router que me mostraste
  try{
    const qs=new URLSearchParams({ from:mesKey, to:mesKey });
    const res=await fetch(`${api.API_URL}/planificacion/mes?${qs}`);
    const j=await res.json().catch(()=>({}));
    const items=Array.isArray(j?.items)?j.items:[];
    const row=items.find(x=>x.mesKey===mesKey);
    return Number(row?.tons)||0;
  }catch{ return 0; }
}

async function guardarRequerimientoMes(mesKey, tipo, tons){
  if(typeof api.guardarRequerimientoMes==='function'){
    await api.guardarRequerimientoMes({ mesKey, tipo, tons });
    return;
  }
  // fallback simple para no reventar: guardo local
  localStorage.setItem(`reqmes:${mesKey}|${(tipo||'ALL').toUpperCase()}`, String(tons));
}

/* ------------------ KPIs (usa estado.*) ------------------ */
async function calcularKPIs(mesKey, tipo){
  const invPT  = estado.totalesMesPorTipo();   // Map "YYYY-MM|TIPO"
  const asigPT = estado.asignadoMesPorTipo();  // Map "YYYY-MM|TIPO"

  let disponible=0, asignado=0;

  if((tipo||'ALL').toUpperCase()==='ALL'){
    for(const [k,v] of invPT.entries()) if(k.startsWith(`${mesKey}|`)) disponible+=v;
    let aTipos=0; for(const [k,v] of asigPT.entries()) if(k.startsWith(`${mesKey}|`)) aTipos+=v;
    const aCons=estado.datos.asignadoPorMes.get(mesKey)||0;
    asignado = aTipos>0 ? aTipos : aCons;
  }else{
    disponible = invPT.get(`${mesKey}|${tipo}`)||0;
    asignado   = asigPT.get(`${mesKey}|${tipo}`)||0;
  }

  const requerimiento = await getRequerimientoMes(mesKey, tipo);
  const saldo = disponible - asignado;

  return { disponible, asignado, requerimiento, saldo };
}

async function pintarKPIs(){
  const mesKey = toMesKey($('#mes_mes')?.value || hoyMesKey());
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  if(!mesKey) return;
  const { disponible, asignado, requerimiento, saldo } = await calcularKPIs(mesKey, tipo);
  ($('#mes_mes')||{}).value = mesKey;

  const set = (id, val)=>{ const el=document.getElementById(id); if(el) el.textContent = `${fmt(val)} t`; };
  set('kpiDisp',  disponible);
  set('kpiAsig',  asignado);
  set('kpiReq',   requerimiento);
  set('kpiSaldo', saldo);

  const reqInput = $('#mes_reqTons');
  if(reqInput && !reqInput.value) reqInput.value = String(requerimiento||'');
  const asigInput = $('#mes_asigTons');
  if(asigInput) asigInput.placeholder = `máx ${fmt(Math.max(0, saldo))} t`;

  // refresco tablas
  await cargarResumenProveedor();
  await cargarDetalleAsignaciones();
}

/* ------------------ RESUMEN POR PROVEEDOR (lectura) ------------------ */
let tablaProv=null;

// intenta usar tu endpoint /planificacion/saldos?from=mk&to=mk
async function fetchSaldosMes(mesKey){
  try{
    const qs = new URLSearchParams({ from:mesKey, to:mesKey });
    const res = await fetch(`${api.API_URL}/planificacion/saldos?${qs}`);
    const j = await res.json().catch(()=>({}));
    return Array.isArray(j?.items)?j.items:[];
  }catch{ return []; }
}

async function cargarResumenProveedor(){
  const mesKey=toMesKey($('#mes_mes')?.value||hoyMesKey());
  const data = await fetchSaldosMes(mesKey);

  // shape: {mesKey, proveedorNombre, disponible, asignado, saldo}
  const rows = data
    .filter(r=>r.mesKey===mesKey)
    .map(r=>({
      Proveedor: r.proveedorNombre||'',
      Disponible: Number(r.disponible)||0,
      Asignado:   Number(r.asignado)||0,
      Saldo:      Number(r.saldo)||0
    }))
    .sort((a,b)=> a.Saldo-b.Saldo || a.Proveedor.localeCompare(b.Proveedor));

  // contenedor: creo una sola vez, simple
  let wrap = $('#mesProvWrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id='mesProvWrap';
    wrap.className='card-soft';
    wrap.innerHTML = `
      <h6 style="margin:6px 0 10px">Resumen por proveedor (mes actual)</h6>
      <div id="mesProvTable"></div>
    `;
    const host = $('#tabInventario');
    const first = host.querySelector('.card-soft'); // KPI card
    (first?.nextSibling ? host.insertBefore(wrap, first.nextSibling) : host.appendChild(wrap));
  }

  const el = $('#mesProvTable');
  const cols = [
    { title:'Proveedor', field:'Proveedor', width:320, headerSort:true },
    { title:'Disponible', field:'Disponible', hozAlign:'right', formatter:c=>fmt(c.getValue()||0) },
    { title:'Asignado',   field:'Asignado',   hozAlign:'right', formatter:c=>fmt(c.getValue()||0) },
    { title:'Saldo',      field:'Saldo',      hozAlign:'right',
      formatter:c=>{
        const v=Number(c.getValue()||0), s=fmt(v);
        return v<0?`<span style="color:#c62828;font-weight:600">${s}</span>`:s;
      }
    },
  ];

  if(tablaProv){ tablaProv.setColumns(cols); tablaProv.setData(rows); }
  else{
    tablaProv = new Tabulator(el, {
      data: rows, layout:'fitColumns', columnMinWidth:120, height:'320px', columns: cols
    });
  }
}

/* ------------------ DETALLE ASIGNACIONES (editable) ------------------ */
let tablaDet=null;

async function listAsignMes(mesKey, tipo){
  if(typeof api.getAsignacionesMes==='function'){
    const r=await api.getAsignacionesMes(mesKey,tipo);
    return Array.isArray(r?.items)?r.items:(Array.isArray(r)?r:[]);
  }
  // fallback GET genérico
  const qs=new URLSearchParams({ mesKey, tipo });
  const res=await fetch(`${api.API_URL}/asignaciones?${qs}`);
  const j=await res.json().catch(()=> ({}));
  return Array.isArray(j?.items)?j.items:(Array.isArray(j)?j:[]);
}
async function patchAsign(id, patch){
  if(typeof api.actualizarAsignacion==='function') return api.actualizarAsignacion(id, patch);
  const r=await fetch(`${api.API_URL}/asignaciones/${encodeURIComponent(id)}`,{
    method:'PATCH', headers:{'Content-Type':'application/json','Accept':'application/json'}, body:JSON.stringify(patch)
  });
  if(!r.ok) throw new Error('PATCH asignación falló');
}
async function delAsign(id){
  if(typeof api.borrarAsignacion==='function') return api.borrarAsignacion(id);
  const r=await fetch(`${api.API_URL}/asignaciones/${encodeURIComponent(id)}`,{method:'DELETE'});
  if(!r.ok) throw new Error('DELETE asignación falló');
}

async function cargarDetalleAsignaciones(){
  const mesKey=toMesKey($('#mes_mes')?.value||hoyMesKey());
  const tipo  =($('#mes_tipo')?.value||'ALL').toUpperCase();

  let rows = await listAsignMes(mesKey, tipo);
  rows = rows
    .filter(x=> (x.mesKey||mesKey)===mesKey && (tipo==='ALL' || String(x.tipo||'NORMAL').toUpperCase()===tipo))
    .map(x=>({
      _id: x._id||x.id||`${mesKey}-${x.proveedorNombre||''}-${x.tipo||'NORMAL'}`,
      Proveedor: x.proveedorNombre||'',
      Tipo: (x.tipo||'NORMAL').toUpperCase(),
      Toneladas: Number(x.tons ?? x.asignado ?? x.total ?? 0) || 0,
      Camiones: Number(x.camiones||0)||0,
      Notas: x.notas||''
    }));

  let wrap=$('#mesDetWrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='mesDetWrap';
    wrap.className='card-soft';
    wrap.innerHTML=`
      <h6 style="margin:6px 0 10px">Detalle de asignaciones del mes</h6>
      <div id="mesDetTable"></div>
      <div class="grey-text" style="margin-top:6px">Doble clic para editar. 🗑 borra.</div>
    `;
    const host=$('#tabInventario');
    const anchor=$('#mesProvWrap')||host.querySelector('.card-soft');
    (anchor?.nextSibling ? host.insertBefore(wrap, anchor.nextSibling) : host.appendChild(wrap));
  }

  const el = $('#mesDetTable');
  const cols = [
    { title:'Proveedor', field:'Proveedor', editor:'input', width:300 },
    { title:'Tipo',      field:'Tipo', editor:'select', editorParams:{values:['NORMAL','BAP']}, width:110, hozAlign:'center' },
    { title:'Toneladas', field:'Toneladas', editor:'number', validator:['min:0'],
      hozAlign:'right', formatter:c=>fmt(c.getValue()||0), width:130 },
    { title:'Camiones',  field:'Camiones', editor:'number', validator:['min:0'],
      hozAlign:'right', width:120 },
    { title:'Notas',     field:'Notas', editor:'input' },
    { title:'', field:'__a', width:70, hozAlign:'center', headerSort:false,
      formatter:()=> '🗑',
      cellClick: async (_e, cell)=>{
        const r=cell.getRow()?.getData(); if(!r?._id) return;
        if(!confirm('¿Borrar esta asignación?')) return;
        try{
          await delAsign(r._id);
          M.toast?.({html:'Asignación borrada', classes:'teal'});
          await estado.refrescar(api);
          await cargarResumenProveedor();
          await cargarDetalleAsignaciones();
          await pintarKPIs();
        }catch(e){
          console.error(e); M.toast?.({html:'No se pudo borrar', classes:'red'});
        }
      }
    }
  ];

  if(tablaDet){
    tablaDet.setColumns(cols); tablaDet.setData(rows);
  }else{
    tablaDet=new Tabulator(el,{
      data:rows, layout:'fitColumns', columnMinWidth:110, height:'330px', columns:cols,
      cellEdited: async (cell)=>{
        const r=cell.getRow()?.getData(); if(!r?._id) return;
        const field=cell.getField();
        const patch={};
        // map campos UI -> backend
        if(field==='Proveedor') patch.proveedorNombre=r.Proveedor;
        else if(field==='Tipo') patch.tipo=r.Tipo;
        else if(field==='Toneladas') patch.tons=r.Toneladas;
        else if(field==='Camiones') patch.camiones=r.Camiones;
        else if(field==='Notas') patch.notas=r.Notas;
        try{
          await patchAsign(r._id, patch);
          M.toast?.({html:'Actualizado', classes:'teal'});
          await estado.refrescar(api);
          await cargarResumenProveedor();
          await pintarKPIs();
        }catch(e){
          console.error(e); M.toast?.({html:'No se pudo actualizar', classes:'orange'});
        }
      }
    });
  }
}

/* ------------------ acciones de los botones KPI ------------------ */
async function onGuardarReq(){
  const mesKey=toMesKey($('#mes_mes')?.value||hoyMesKey());
  const tipo  =($('#mes_tipo')?.value||'ALL').toUpperCase();
  const tons  =Number($('#mes_reqTons')?.value||0);
  if(!mesKey || !(tons>=0)) return M.toast?.({html:'Mes y valor válidos', classes:'red'});
  await guardarRequerimientoMes(mesKey, tipo, tons);
  M.toast?.({html:'Requerimiento guardado', classes:'teal'});
  await pintarKPIs();
}
async function onAsignarMacro(){
  const mesKey=toMesKey($('#mes_mes')?.value||hoyMesKey());
  const tipo  =($('#mes_tipo')?.value||'ALL').toUpperCase();
  const prov  =($('#mes_asigProv')?.value||'').trim() || '(macro mensual)';
  let tons    =Number($('#mes_asigTons')?.value||0);
  if(!mesKey || tons<=0) return M.toast?.({html:'Ingresa toneladas > 0', classes:'red'});

  const saldo = estado.saldoMes({ mesKey, tipo });
  const asignable = clamp(tons, 0, Math.max(0, saldo));
  if(asignable<=0) return M.toast?.({html:'Sin saldo disponible', classes:'orange'});
  if(asignable<tons){ M.toast?.({html:`Ajustado a ${fmt(asignable)} t por saldo`, classes:'orange'}); tons=asignable; }

  await api.crearAsignacion({ mesKey, proveedorNombre:prov, tons, tipo: tipo==='ALL'?'NORMAL':tipo, fuente:'ui-mensual' });
  M.toast?.({html:'Asignación registrada', classes:'teal'});
  ($('#mes_asigTons')||{}).value='';
  await estado.refrescar(api);
  await cargarResumenProveedor();
  await cargarDetalleAsignaciones();
  await pintarKPIs();
}
async function onBorrarTodas(){
  const mesKey=toMesKey($('#mes_mes')?.value||hoyMesKey());
  const tipo  =($('#mes_tipo')?.value||'ALL').toUpperCase();
  if(!confirm(`Borrar asignaciones de ${mesKey}${tipo!=='ALL'?' ('+tipo+')':''}?`)) return;
  try{
    if(typeof api.borrarAsignacionesMes==='function'){
      await api.borrarAsignacionesMes({ mesKey, tipo });
    }else{
      await fetch(`${api.API_URL}/asignaciones?mesKey=${encodeURIComponent(mesKey)}&tipo=${encodeURIComponent(tipo)}`,{method:'DELETE'});
    }
    M.toast?.({html:'Asignaciones borradas', classes:'teal'});
    await estado.refrescar(api);
    await cargarResumenProveedor();
    await cargarDetalleAsignaciones();
    await pintarKPIs();
  }catch(e){
    console.warn(e); M.toast?.({html:'Falta endpoint de borrado masivo', classes:'orange'});
  }
}

/* ------------------ montaje ------------------ */
export function montar(){
  // defaults
  const mesInp=$('#mes_mes'); if(mesInp && !mesInp.value) mesInp.value=hoyMesKey();
  M.FormSelect.init(document.querySelectorAll('select')); M.updateTextFields?.();

  // listeners
  $('#mes_mes')?.addEventListener('change', pintarKPIs);
  $('#mes_tipo')?.addEventListener('change', pintarKPIs);
  $('#mes_btnActualizar')?.addEventListener('click', async ()=>{ try{ await estado.refrescar(api);}catch{} pintarKPIs(); });
  $('#mes_btnReset')?.addEventListener('click', ()=>{ const b=$('#mes_buscar'); if(b) b.value=''; const a=$('#mes_asigTons'); if(a) a.value=''; M.updateTextFields?.(); pintarKPIs(); });
  $('#mes_btnGuardarReq')?.addEventListener('click', onGuardarReq);
  $('#mes_btnAsignar')?.addEventListener('click', onAsignarMacro);
  $('#mes_btnBorrarAsig')?.addEventListener('click', onBorrarTodas);

  // primer render
  pintarKPIs();
}
