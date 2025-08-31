// mensual.js — KPI + Resumen por proveedor + Detalle editable + Matriz anual editable

import * as api from './api.js';
import * as estado from './estado.js';
import { fmt } from './utilidades.js';

/* ------------------ helpers ------------------ */
const $  = (s, r=document)=>r.querySelector(s);
const pad2 = (n)=>String(n).padStart(2,'0');
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const num = (v)=> (Number(v) || 0);

function toMesKey(v){
  if(!v) return '';
  if(/^\d{4}-\d{2}$/.test(v)) return v;
  const d=new Date(v); if(isNaN(d)) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}
function hoyMesKey(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; }
function yearOfMesKey(mk){ return Number(String(mk).slice(0,4))||new Date().getFullYear(); }

/* ------------------ requerimiento planta ------------------ */
async function getRequerimientoMes(mesKey, tipo){
  if(typeof api.getRequerimientoMes==='function'){
    try{ const r=await api.getRequerimientoMes(mesKey, tipo); return num(r?.tons); }catch{}
  }
  try{
    const qs=new URLSearchParams({ from:mesKey, to:mesKey });
    const res=await fetch(`${api.API_URL}/planificacion/mes?${qs}`);
    const j=await res.json().catch(()=>({}));
    const row=(Array.isArray(j?.items)?j.items:[]).find(x=>x.mesKey===mesKey);
    return num(row?.tons);
  }catch{ return 0; }
}
async function guardarRequerimientoMes(mesKey, tipo, tons){
  if(typeof api.guardarRequerimientoMes==='function'){
    await api.guardarRequerimientoMes({ mesKey, tipo, tons });
    return;
  }
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

  await cargarResumenProveedor();
  await cargarDetalleAsignaciones();
  await cargarMatrizAnual();   // <- matriz anual
}

/* ------------------ RESUMEN POR PROVEEDOR (lectura) ------------------ */
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
  const data = await fetchSaldosMes(mesKey);

  const rows = data
    .filter(r=>r.mesKey===mesKey)
    .map(r=>({
      Proveedor: r.proveedorNombre||'',
      Disponible: num(r.disponible),
      Asignado:   num(r.asignado),
      Saldo:      num(r.saldo)
    }))
    .sort((a,b)=> a.Saldo-b.Saldo || a.Proveedor.localeCompare(b.Proveedor));

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
        const v=num(c.getValue()); const s=fmt(v);
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
      Toneladas: num(x.tons ?? x.asignado ?? x.total),
      Camiones: num(x.camiones),
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
          await cargarMatrizAnual();
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
          await cargarMatrizAnual();
          await pintarKPIs();
        }catch(e){
          console.error(e); M.toast?.({html:'No se pudo actualizar', classes:'orange'});
        }
      }
    });
  }
}

/* ------------------ MATRIZ ANUAL (editable por proveedor/mes) ------------------ */
let tablaMatriz=null;

// saldos por todo el año
async function fetchSaldosRango(anio){
  const from=`${anio}-01`, to=`${anio}-12`;
  try{
    const qs = new URLSearchParams({ from, to });
    const res = await fetch(`${api.API_URL}/planificacion/saldos?${qs}`);
    const j = await res.json().catch(()=>({}));
    return Array.isArray(j?.items)?j.items:[];
  }catch{ return []; }
}

function buildMatrizRows(items, anio){
  // items: [{mesKey, proveedorNombre, asignado, ...}, ...]
  const byProv = new Map();
  for(const it of items){
    if(!it?.mesKey || String(it.mesKey).slice(0,4)!=anio) continue;
    const p = it.proveedorNombre || '';
    const m = Number(String(it.mesKey).slice(5,7));
    const row = byProv.get(p) || {
      Proveedor:p, E:0,F:0,M:0,A:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0, Total:0
    };
    const asign = num(it.asignado);
    const map = {1:'E',2:'F',3:'M',4:'A',5:'May',6:'Jun',7:'Jul',8:'Ago',9:'Sep',10:'Oct',11:'Nov',12:'Dic'};
    const key = map[m];
    if(key){ row[key] = num(row[key]) + asign; row.Total += asign; }
    byProv.set(p, row);
  }
  return Array.from(byProv.values())
    .sort((a,b)=> b.Total-a.Total || a.Proveedor.localeCompare(b.Proveedor));
}

async function cargarMatrizAnual(){
  const mk = toMesKey($('#mes_mes')?.value||hoyMesKey());
  const anio = yearOfMesKey(mk);
  const data = await fetchSaldosRango(anio);
  const rows = buildMatrizRows(data, anio);

  let wrap=$('#mesMatrizWrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='mesMatrizWrap';
    wrap.className='card-soft';
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap">
        <h6 style="margin:6px 0">Total por proveedor (año) — editable</h6>
        <div style="display:flex;gap:8px;align-items:center">
          <span id="matYear" style="font-weight:600"></span>
          <a id="btnVerMatriz" class="btn grey darken-2"><i class="material-icons left" style="margin:0">refresh</i>Ver</a>
        </div>
      </div>
      <div id="mesMatrizTable"></div>
      <div class="grey-text" style="margin-top:6px">Edita un mes para subir/bajar el total asignado del proveedor en ese mes.</div>
    `;
    const host=$('#tabInventario');
    const anchor=$('#mesDetWrap')||$('#mesProvWrap')||host.querySelector('.card-soft');
    (anchor?.nextSibling ? host.insertBefore(wrap, anchor.nextSibling) : host.appendChild(wrap));
    $('#btnVerMatriz')?.addEventListener('click', cargarMatrizAnual);
  }
  const yearLabel=$('#matYear'); if(yearLabel) yearLabel.textContent=String(anio);

  const el = $('#mesMatrizTable');
  const cols = [
    { title:'Proveedor', field:'Proveedor', width:320, headerSort:true, frozen:true },
    { title:'Ene', field:'E', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Feb', field:'F', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Mar', field:'M', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Abr', field:'A', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'May', field:'May', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Jun', field:'Jun', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Jul', field:'Jul', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Ago', field:'Ago', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Sep', field:'Sep', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Oct', field:'Oct', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Nov', field:'Nov', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Dic', field:'Dic', editor:'number', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:90 },
    { title:'Total', field:'Total', hozAlign:'right', formatter:c=>fmt(num(c.getValue())), width:110 },
  ];

  if(tablaMatriz){
    tablaMatriz.setColumns(cols); tablaMatriz.setData(rows);
  }else{
    tablaMatriz=new Tabulator(el,{
      data: rows, layout:'fitColumns', columnMinWidth:90, height:'380px', columns: cols,
      cellEdited: async (cell)=>{
        // Aplica delta contra backend al editar MES
        const field = cell.getField();
        if(['Proveedor','Total'].includes(field)) return;

        const row = cell.getRow()?.getData();
        const proveedor = row?.Proveedor || '';
        const nuevo = num(cell.getValue());
        const anterior = num(cell.getOldValue());

        if(!proveedor || isNaN(nuevo)) return;

        const mesNumMap = {E:1,F:2,M:3,A:4,May:5,Jun:6,Jul:7,Ago:8,Sep:9,Oct:10,Nov:11,Dic:12};
        const mesNum = mesNumMap[field];
        if(!mesNum) return;

        const mk = `${yearOfMesKey($('#mes_mes')?.value||hoyMesKey())}-${pad2(mesNum)}`;

        const delta = nuevo - anterior;
        if(delta === 0) return;

        try{
          await aplicarDeltaAsignado({ proveedor, mesKey: mk, delta });
          M.toast?.({html:'Ajuste aplicado', classes:'teal'});
          await estado.refrescar(api);
          await cargarResumenProveedor();
          await cargarDetalleAsignaciones();
          await cargarMatrizAnual();
          await pintarKPIs();
        }catch(e){
          console.error(e);
          M.toast?.({html:'No se pudo aplicar el ajuste (revisa backend)', classes:'red'});
          // revertir visual si falló
          cell.setValue(anterior, true);
        }
      }
    });
  }
}

// Aplica el delta en un proveedor/mes: crea (delta>0) o reduce/borra (delta<0)
async function aplicarDeltaAsignado({ proveedor, mesKey, delta }){
  if(delta > 0){
    // crear una asignación de ajuste por la diferencia
    await api.crearAsignacion({
      mesKey,
      proveedorNombre: proveedor,
      tons: delta,
      tipo: 'NORMAL',
      fuente: 'ajuste-matriz'
    });
    return;
  }

  // delta < 0: bajar asignado → reducir/ borrar filas existentes
  let porReducir = Math.abs(delta);

  // lista del mes (ALL) y filtramos por proveedor
  let items = await listAsignMes(mesKey, 'ALL');
  items = items
    .filter(x => (x.proveedorNombre||'') === proveedor)
    // primero reducimos ajustes-matriz previos
    .sort((a,b)=>{
      const fa = (a.fuente||'') === 'ajuste-matriz' ? -1 : 0;
      const fb = (b.fuente||'') === 'ajuste-matriz' ? -1 : 0;
      return fa - fb;
    });

  for(const it of items){
    if(porReducir <= 0) break;
    const id = it._id || it.id;
    const actual = num(it.tons ?? it.asignado ?? it.total);
    if(actual <= 0) continue;

    if(actual <= porReducir){
      // borrar esta
      await delAsign(id);
      porReducir -= actual;
    }else{
      // reducir esta
      await patchAsign(id, { tons: actual - porReducir });
      porReducir = 0;
    }
  }

  if(porReducir > 0){
    throw new Error('No hay suficientes asignaciones para reducir esa cantidad');
  }
}

/* ------------------ acciones KPI ------------------ */
async function onGuardarReq(){
  const mesKey=toMesKey($('#mes_mes')?.value||hoyMesKey());
  const tipo  =($('#mes_tipo')?.value||'ALL').toUpperCase();
  const tons  =num($('#mes_reqTons')?.value||0);
  if(!mesKey || !(tons>=0)) return M.toast?.({html:'Mes y valor válidos', classes:'red'});
  await guardarRequerimientoMes(mesKey, tipo, tons);
  M.toast?.({html:'Requerimiento guardado', classes:'teal'});
  await pintarKPIs();
}
async function onAsignarMacro(){
  const mesKey=toMesKey($('#mes_mes')?.value||hoyMesKey());
  const tipo  =($('#mes_tipo')?.value||'ALL').toUpperCase();
  const prov  =($('#mes_asigProv')?.value||'').trim() || '(macro mensual)';
  let tons    =num($('#mes_asigTons')?.value||0);
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

  $('#mes_mes')?.addEventListener('change', pintarKPIs);
  $('#mes_tipo')?.addEventListener('change', pintarKPIs);
  $('#mes_btnActualizar')?.addEventListener('click', async ()=>{ try{ await estado.refrescar(api);}catch{} pintarKPIs(); });
  $('#mes_btnReset')?.addEventListener('click', ()=>{ const b=$('#mes_buscar'); if(b) b.value=''; const a=$('#mes_asigTons'); if(a) a.value=''; M.updateTextFields?.(); pintarKPIs(); });
  $('#mes_btnGuardarReq')?.addEventListener('click', onGuardarReq);
  $('#mes_btnAsignar')?.addEventListener('click', onAsignarMacro);
  $('#mes_btnBorrarAsig')?.addEventListener('click', onBorrarTodas);

  pintarKPIs();
}
