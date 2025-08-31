// mensual.js — KPI + Resumen mes + Detalle editable + MATRIZ anual editable por proveedor

import * as api from './api.js';
import * as estado from './estado.js';
import { fmt } from './utilidades.js';

/* ------------------ helpers ------------------ */
const $  = (s, r=document)=>r.querySelector(s);
const pad2 = (n)=>String(n).padStart(2,'0');
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const nz = (v)=>Number(v||0);

function toMesKey(v){
  if(!v) return '';
  if(/^\d{4}-\d{2}$/.test(v)) return v;
  const d=new Date(v); if(isNaN(d)) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}
function hoyMesKey(){
  const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}
function fechaISO(x){
  const f = x?.fecha || x?.dia || x?.createdAt;
  const d = f ? new Date(f) : null;
  if(d && !isNaN(d)) return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const mk = x?.mesKey || '';
  return /^\d{4}-\d{2}$/.test(mk) ? `${mk}-01` : '';
}

/* ------------------ requerimiento (planificacionmes) ------------------ */
async function getRequerimientoMes(mesKey, tipo){
  if(typeof api.getRequerimientoMes==='function'){
    try{ const r=await api.getRequerimientoMes(mesKey, tipo); return nz(r?.tons); }catch{}
  }
  try{
    const qs=new URLSearchParams({ from:mesKey, to:mesKey });
    const res=await fetch(`${api.API_URL}/planificacion/mes?${qs}`);
    const j=await res.json().catch(()=>({}));
    const row=(Array.isArray(j?.items)?j.items:[]).find(x=>x.mesKey===mesKey);
    return nz(row?.tons);
  }catch{}
  const raw = localStorage.getItem(`reqmes:${mesKey}|${(tipo||'ALL').toUpperCase()}`);
  return raw? Number(raw)||0 : 0;
}
async function guardarRequerimientoMes(mesKey, tipo, tons){
  if(typeof api.guardarRequerimientoMes==='function'){
    await api.guardarRequerimientoMes({ mesKey, tipo, tons }); return;
  }
  try{
    await fetch(`${api.API_URL}/planificacion/mes`,{
      method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({ mesKey, tons })
    });
    return;
  }catch{}
  localStorage.setItem(`reqmes:${mesKey}|${(tipo||'ALL').toUpperCase()}`, String(tons));
}

/* ------------------ KPIs ------------------ */
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
  return { disponible, asignado, requerimiento, saldo: disponible - asignado };
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

  await cargarResumenProveedor();
  await cargarDetalleAsignaciones();
  await cargarMatrizAnual(); // nueva
}

/* ------------------ Resumen por proveedor (mes actual) ------------------ */
let tablaProv=null;

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
  const data  = await fetchSaldosMes(mesKey);

  const rows = data
    .filter(r=>r.mesKey===mesKey)
    .map(r=>({ Proveedor:r.proveedorNombre||'', Disponible:nz(r.disponible), Asignado:nz(r.asignado), Saldo:nz(r.saldo) }))
    .sort((a,b)=> a.Saldo-b.Saldo || a.Proveedor.localeCompare(b.Proveedor));

  let wrap = $('#mesProvWrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id='mesProvWrap';
    wrap.className='card-soft';
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <h6 style="margin:6px 0">Resumen por proveedor (mes actual)</h6>
        <small class="grey-text">Clic en un proveedor para filtrar el detalle</small>
      </div>
      <div id="mesProvTable"></div>
    `;
    const host = $('#tabInventario');
    const first = host.querySelector('.card-soft');
    (first?.nextSibling ? host.insertBefore(wrap, first.nextSibling) : host.appendChild(wrap));
  }

  const el = $('#mesProvTable');
  const cols = [
    { title:'Proveedor', field:'Proveedor', width:320, headerSort:true },
    { title:'Disponible', field:'Disponible', hozAlign:'right', formatter:c=>fmt(c.getValue()||0) },
    { title:'Asignado',   field:'Asignado',   hozAlign:'right', formatter:c=>fmt(c.getValue()||0) },
    { title:'Saldo',      field:'Saldo',      hozAlign:'right',
      formatter:c=>{ const v=nz(c.getValue()); const s=fmt(v); return v<0?`<span style="color:#c62828;font-weight:600">${s}</span>`:s; } },
  ];

  if(tablaProv){
    tablaProv.setColumns(cols);
    tablaProv.setData(rows);
  }else{
    tablaProv = new Tabulator(el, {
      data: rows, layout:'fitColumns', columnMinWidth:120, height:'320px', columns: cols,
      rowClick: (_e, row)=>{
        const prov = row?.getData()?.Proveedor || '';
        filtroProveedor = prov || null;
        cargarDetalleAsignaciones();
      }
    });
  }
}

/* ------------------ Detalle de asignaciones (mes) ------------------ */
let tablaDet=null;
let filtroProveedor = null;

async function listAsignMes(mesKey, tipo){
  if(typeof api.getAsignacionesMes==='function'){
    const r=await api.getAsignacionesMes(mesKey,tipo);
    return Array.isArray(r?.items)?r.items:(Array.isArray(r)?r:[]);
  }
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
async function fetchDisponiblesPorProveedor(mesKey){
  try{
    const qs = new URLSearchParams({ from:mesKey, to:mesKey });
    const res = await fetch(`${api.API_URL}/planificacion/disponibilidad?${qs}`);
    const j = await res.json().catch(()=>({}));
    const items = Array.isArray(j?.items)?j.items:[]; 
    const arr = Array.isArray(items)?items:(Array.isArray(j)?j:[]);
    const map=new Map();
    for(const it of arr){
      if((it?.mesKey||'')!==mesKey) continue;
      const prov = it.proveedorNombre || '';
      const tons = nz(it.tonsDisponible ?? it.tons);
      map.set(prov, nz(map.get(prov))+tons);
    }
    return map;
  }catch{ return new Map(); }
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
      Toneladas: nz(x.tons ?? x.asignado ?? x.total),
      Camiones: nz(x.camiones),
      Notas: x.notas||'',
      Fecha: fechaISO(x)
    }));

  if(filtroProveedor) rows = rows.filter(r=> (r.Proveedor||'')===filtroProveedor);

  const dispMap = await fetchDisponiblesPorProveedor(mesKey);
  const groups = new Map();
  rows.sort((a,b)=> (a.Proveedor||'').localeCompare(b.Proveedor||'') || (a.Fecha||'').localeCompare(b.Fecha||''));
  for(const r of rows){
    const key = r.Proveedor||'';
    if(!groups.has(key)) groups.set(key, { saldo: nz(dispMap.get(key)) });
    const g = groups.get(key);
    g.saldo -= nz(r.Toneladas);
    r.SaldoDespues = g.saldo;
  }

  let wrap=$('#mesDetWrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='mesDetWrap';
    wrap.className='card-soft';
    wrap.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <h6 style="margin:6px 0">Detalle de asignaciones del mes</h6>
        <div id="mesDetFiltroInfo" class="grey-text" style="display:flex;align-items:center;gap:8px"></div>
      </div>
      <div id="mesDetTable"></div>
      <div class="grey-text" style="margin-top:6px">Doble clic para editar. 🗑 borra.</div>
    `;
    const host=$('#tabInventario');
    const anchor=$('#mesProvWrap')||host.querySelector('.card-soft');
    (anchor?.nextSibling ? host.insertBefore(wrap, anchor.nextSibling) : host.appendChild(wrap));
  }

  const info = $('#mesDetFiltroInfo');
  if(info){
    if(filtroProveedor){
      info.innerHTML = `
        <span>Filtrando por: <b>${filtroProveedor}</b></span>
        <a class="chip" id="btnQuitarFiltro">Quitar filtro</a>
      `;
      $('#btnQuitarFiltro')?.addEventListener('click', ()=>{ filtroProveedor=null; cargarDetalleAsignaciones(); });
    }else{
      info.innerHTML = '';
    }
  }

  const el = $('#mesDetTable');
  const cols = [
    { title:'Fecha',     field:'Fecha', width:120 },
    { title:'Proveedor', field:'Proveedor', editor:'input', width:300 },
    { title:'Tipo',      field:'Tipo', editor:'select', editorParams:{values:['NORMAL','BAP']}, width:110, hozAlign:'center' },
    { title:'Toneladas', field:'Toneladas', editor:'number', validator:['min:0'], hozAlign:'right', formatter:c=>fmt(c.getValue()||0), width:130 },
    { title:'Camiones',  field:'Camiones', editor:'number', validator:['min:0'], hozAlign:'right', width:120 },
    { title:'Saldo después', field:'SaldoDespues', hozAlign:'right',
      formatter:c=>{ const v=nz(c.getValue()); const s=fmt(v); return v<0?`<span style="color:#c62828;font-weight:600">${s}</span>`:s; },
      width:140 },
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
      data:rows, layout:'fitColumns', columnMinWidth:110, height:'360px', columns:cols,
      cellEdited: async (cell)=>{
        const r=cell.getRow()?.getData(); if(!r?._id) return;
        const field=cell.getField();
        const patch={};
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
          await cargarDetalleAsignaciones();
          await pintarKPIs();
        }catch(e){
          console.error(e); M.toast?.({html:'No se pudo actualizar', classes:'orange'});
        }
      }
    });
  }
}

/* ------------------ MATRIZ ANUAL (TOTAL por proveedor, editable) ------------------ */
let tablaMatriz=null;
let matrizYear=null;

function monthsOf(year){ return Array.from({length:12},(_,i)=>`${year}-${pad2(i+1)}`); }

async function fetchSaldosRango(year){
  try{
    const qs = new URLSearchParams({ from:`${year}-01`, to:`${year}-12` });
    const res = await fetch(`${api.API_URL}/planificacion/saldos?${qs}`);
    const j = await res.json().catch(()=>({}));
    return Array.isArray(j?.items)?j.items:[];
  }catch{return [];}
}

async function aplicarAjusteAsignado(proveedor, mesKey, delta){
  // +delta => creo asignación; -delta => reduzco/borró asignaciones existentes
  if(delta>0){
    await api.crearAsignacion({ mesKey, proveedorNombre: proveedor, tons: delta, tipo:'NORMAL', fuente:'ajuste-matriz' });
    return;
  }
  // reducir
  let restante = Math.abs(delta);
  const lista = await listAsignMes(mesKey,'ALL');
  const filas = lista
    .filter(a => (a.proveedorNombre||'')===proveedor)
    .sort((a,b)=> new Date(b.updatedAt||b.createdAt||0) - new Date(a.updatedAt||a.createdAt||0));
  for(const a of filas){
    let t = nz(a.tons ?? a.asignado ?? a.total);
    if(t<=0) continue;
    const reducible = Math.min(t, restante);
    const nuevo = t - reducible;
    if(nuevo>0){ await patchAsign(a._id, { tons: nuevo }); }
    else { await delAsign(a._id); }
    restante -= reducible;
    if(restante<=0) break;
  }
  if(restante>0) throw new Error('No hay suficientes asignaciones para bajar ese monto. Ajusta en el detalle.');
}

async function cargarMatrizAnual(){
  const mkSel = toMesKey($('#mes_mes')?.value||hoyMesKey());
  const y = Number(mkSel.slice(0,4));
  matrizYear = y;

  // card UI
  let wrap=$('#mesMatrizWrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='mesMatrizWrap';
    wrap.className='card-soft';
    wrap.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px">
        <h6 style="margin:6px 0">Total por proveedor (año) — editable</h6>
        <div style="display:flex;align-items:center;gap:8px">
          <input id="mat_year" type="number" min="2000" max="2100" style="max-width:110px" />
          <a id="mat_btn" class="btn grey darken-2"><i class="material-icons left" style="margin:0">refresh</i>Ver año</a>
        </div>
      </div>
      <div id="mesMatrizTable"></div>
      <div class="grey-text" style="margin-top:6px">Edita un mes para subir/bajar el total asignado del proveedor en ese mes.</div>
    `;
    $('#tabInventario').appendChild(wrap);
    $('#mat_btn')?.addEventListener('click', ()=>{ 
      const y2=Number($('#mat_year')?.value||matrizYear);
      if(y2 && y2>=2000 && y2<=2100){
        // fijamos mes seleccionado al mismo mes numérico pero año y2
        const m = Number(toMesKey($('#mes_mes')?.value||hoyMesKey()).slice(5,7));
        const setMonth = `${y2}-${pad2(m)}`;
        const inp=$('#mes_mes'); if(inp){ inp.value=setMonth; M.updateTextFields?.(); }
        pintarKPIs();
      }
    });
  }
  const inYear = $('#mat_year'); if(inYear) inYear.value = y;

  // datos
  const items = await fetchSaldosRango(y); // {mesKey, proveedorNombre, asignado}
  const months = monthsOf(y);
  const byProv = new Map();
  for(const it of items){
    const p = it.proveedorNombre || '';
    const mk = it.mesKey || '';
    const as = nz(it.asignado);
    if(!months.includes(mk)) continue;
    const key = `m_${mk.slice(5,7)}`; // m_01..m_12
    const row = byProv.get(p) || { Proveedor:p, Total:0 };
    row[key] = nz(row[key]) + as;
    row.Total += as;
    byProv.set(p, row);
  }
  const rows = Array.from(byProv.values())
    .map(r=>({ 
      Proveedor:r.Proveedor,
      m_01:nz(r.m_01), m_02:nz(r.m_02), m_03:nz(r.m_03), m_04:nz(r.m_04), m_05:nz(r.m_05), m_06:nz(r.m_06),
      m_07:nz(r.m_07), m_08:nz(r.m_08), m_09:nz(r.m_09), m_10:nz(r.m_10), m_11:nz(r.m_11), m_12:nz(r.m_12),
      Total:nz(r.Total)
    }))
    .sort((a,b)=> b.Total-a.Total || a.Proveedor.localeCompare(b.Proveedor));

  const el = $('#mesMatrizTable');
  const monthCol = (label, idx)=>({
    title:label, field:`m_${pad2(idx)}`, width:110, hozAlign:'right',
    editor:'number', validator:['min:0'], formatter:c=>fmt(c.getValue()||0)
  });
  const cols = [
    { title:'Proveedor', field:'Proveedor', width:300, headerSort:true },
    monthCol('Ene',1), monthCol('Feb',2), monthCol('Mar',3), monthCol('Abr',4), monthCol('May',5), monthCol('Jun',6),
    monthCol('Jul',7), monthCol('Ago',8), monthCol('Sep',9), monthCol('Oct',10), monthCol('Nov',11), monthCol('Dic',12),
    { title:'Total', field:'Total', hozAlign:'right', formatter:c=>fmt(c.getValue()||0), width:120 }
  ];

  const recalcTotal = (row)=>{
    const d=row.getData();
    let t=0; for(let i=1;i<=12;i++) t+= nz(d[`m_${pad2(i)}`]);
    row.update({ Total:t }, true);
  };

  if(tablaMatriz){
    tablaMatriz.setColumns(cols);
    tablaMatriz.setData(rows);
  }else{
    tablaMatriz = new Tabulator(el,{
      data:rows, layout:'fitColumns', columnMinWidth:90, height:'420px', columns:cols,
      cellEdited: async (cell)=>{
        const field = cell.getField();
        if(!/^m_\d{2}$/.test(field)) return;
        const row = cell.getRow();
        const prov = row.getData()?.Proveedor || '';
        const oldVal = nz(cell.getOldValue());
        const newVal = nz(cell.getValue());
        if(newVal===oldVal) return;

        const mesNum = field.slice(2); // '01'..'12'
        const mk = `${matrizYear}-${mesNum}`;
        const delta = newVal - oldVal;

        try{
          await aplicarAjusteAsignado(prov, mk, delta);
          M.toast?.({html:'Ajuste aplicado', classes:'teal'});
          await estado.refrescar(api);
          await cargarResumenProveedor();
          await cargarDetalleAsignaciones();
          recalcTotal(row);
        }catch(e){
          console.error(e);
          M.toast?.({html:'No se pudo aplicar el ajuste. Corrige en el detalle.', classes:'orange'});
          // revertir valor
          cell.setValue(oldVal, true);
        }
      }
    });
  }
}

/* ------------------ acciones KPI ------------------ */
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
  await cargarMatrizAnual();
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
    await cargarMatrizAnual();
    await pintarKPIs();
  }catch(e){
    console.warn(e); M.toast?.({html:'Falta endpoint de borrado masivo', classes:'orange'});
  }
}

/* ------------------ montaje ------------------ */
export function montar(){
  const mesInp=$('#mes_mes'); if(mesInp && !mesInp.value) mesInp.value=hoyMesKey();
  M.FormSelect.init(document.querySelectorAll('select')); M.updateTextFields?.();

  $('#mes_mes')?.addEventListener('change', ()=>{ filtroProveedor=null; pintarKPIs(); });
  $('#mes_tipo')?.addEventListener('change', ()=>{ filtroProveedor=null; pintarKPIs(); });
  $('#mes_btnActualizar')?.addEventListener('click', async ()=>{ try{ await estado.refrescar(api);}catch{} filtroProveedor=null; pintarKPIs(); });
  $('#mes_btnReset')?.addEventListener('click', ()=>{
    const b=$('#mes_buscar'); if(b) b.value='';
    const a=$('#mes_asigTons'); if(a) a.value='';
    filtroProveedor=null; M.updateTextFields?.(); pintarKPIs();
  });
  $('#mes_btnGuardarReq')?.addEventListener('click', onGuardarReq);
  $('#mes_btnAsignar')?.addEventListener('click', onAsignarMacro);
  $('#mes_btnBorrarAsig')?.addEventListener('click', onBorrarTodas);

  pintarKPIs();
}
