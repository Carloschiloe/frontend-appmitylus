// js/abastecimiento/asignacion/asignacion.js
import {apiGet, apiPost, endpoints} from "./api.js";
import {fmt, monthKey, monthLabel, calcAlturaDisponible, safeGroupBy} from "./utilidades.js";

let table = null;
let _rows = [];
let _monthTotals = new Map();
let _asigMap = new Map();

function monthTotals(rows){
  const m=new Map();
  for(const r of rows){ const k=r.Mes||'s/fecha'; m.set(k,(m.get(k)||0)+(Number(r.Tons)||0)); }
  return m;
}

async function getOfertas(){
  const raw = await apiGet(endpoints.ofertas);
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
  return arr.map(it=>{
    const mes = monthKey(it.fecha || it.fechaPlan || it.fch || it.mes || it.mesKey || '');
    return {
      Mes: mes,
      MesLabel: monthLabel(mes),
      Proveedor: it.proveedorNombre || it.proveedor || '(sin proveedor)',
      Comuna: it.comuna || it.centroComuna || '',
      Centro: it.centroCodigo || '',
      Área: it.areaCodigo || it.area || '',
      Tons: Number(it.tons)||0,
      Trucks: (Number(it.tons)||0)/10,
      Fuente: it.fuente ? it.fuente[0].toUpperCase()+it.fuente.slice(1) : 'Disponibilidad',
      Tipo: (String(it.tipo||"").toUpperCase()==="BAP" ? "BAP" : "NORMAL"),
    };
  }).filter(r=>r.Tons>0);
}
async function getAsignacionesMap(){
  try{
    const raw=await apiGet(endpoints.asignacionesMap);
    const arr=Array.isArray(raw)?raw:(Array.isArray(raw?.items)?raw.items:[]);
    const map=new Map();
    for(const it of arr){
      const key = it.key || it.mesKey || (it.anio && it.mes ? `${it.anio}-${String(it.mes).padStart(2,'0')}` : monthKey(it.fecha || it.fechaPlan || it.fch));
      const val = Number(it.asignado ?? it.tons ?? it.total ?? it.valor ?? 0);
      if(key && Number.isFinite(val)) map.set(key, (map.get(key)||0) + val);
    }
    return map;
  }catch{ return new Map(); }
}

/* ---- UI ---- */
function buildToolbar(){
  const el = document.getElementById("asiToolbar");
  el.innerHTML = `
    <div class="row" style="margin:0;align-items:flex-end">
      <div class="input-field col s12 m6">
        <i class="material-icons prefix">search</i>
        <input id="asiSearch" type="text" placeholder="Buscar (mes, proveedor, comuna, centro, área, fuente)">
        <label for="asiSearch">Buscar</label>
      </div>
      <div class="input-field col s6 m3">
        <select id="asiGrp1">
          <option value="Mes" selected>Mes</option>
          <option value="Comuna">Comuna</option>
          <option value="Proveedor">Proveedor</option>
          <option value="Tipo">Tipo (BAP/Normal)</option>
        </select>
        <label>Agrupar por</label>
      </div>
      <div class="input-field col s6 m3">
        <select id="asiGrp2">
          <option value="">— Ninguno —</option>
          <option value="Comuna" selected>Comuna</option>
          <option value="Proveedor">Proveedor</option>
          <option value="Tipo">Tipo</option>
        </select>
        <label>Subgrupo</label>
      </div>
    </div>
  `;
  M.FormSelect.init(el.querySelectorAll("select"));

  el.querySelector("#asiSearch").addEventListener("input", applyFilterGroup);
  el.querySelector("#asiGrp1").addEventListener("change", applyFilterGroup);
  el.querySelector("#asiGrp2").addEventListener("change", applyFilterGroup);
}
function buildPanel(){
  const el = document.getElementById("asiPanel");
  el.innerHTML = `
    <div class="card-soft" style="padding:12px;margin-bottom:12px">
      <div class="row" style="margin:0">
        <div class="input-field col s12">
          <input id="asig_mes" type="month">
          <label class="active" for="asig_mes">Mes a asignar</label>
        </div>
      </div>
      <div class="kpi" style="grid-template-columns:repeat(1,1fr)">
        <div class="card-soft">
          <h6>Saldo del mes elegido</h6>
          <p><span id="kpiMesDisp">Disp: 0 t</span> · <span id="kpiMesAsig">Asig: 0 t</span> · <span id="kpiMesSaldo">Saldo: 0 t</span></p>
        </div>
      </div>
    </div>

    <div class="card-soft" style="padding:12px;margin-bottom:12px">
      <h6 style="margin:0 0 8px">Selección actual</h6>
      <p class="grey-text" id="selResumen">0 filas · 0,00 t (0 cam)</p>
      <div class="row" style="margin:0">
        <div class="input-field col s7">
          <input id="montoAsignar" type="number" min="0" step="0.01" />
          <label class="active" for="montoAsignar">Monto a asignar</label>
        </div>
        <div class="input-field col s5">
          <select id="unidadMonto">
            <option value="tons" selected>Toneladas</option>
            <option value="trucks">Camiones (10 t)</option>
          </select>
          <label>Unidad</label>
        </div>
      </div>
      <div class="row" style="margin:0;gap:8px">
        <a class="btn-flat teal-text" id="btnUsarSeleccion"><i class="material-icons left">done_all</i>Usar total seleccionado</a>
        <a class="btn-flat teal-text" id="btnUsarSaldo"><i class="material-icons left">equalizer</i>Usar saldo del mes</a>
      </div>
    </div>

    <div class="card-soft" style="padding:12px">
      <a class="btn teal" id="btnAsignar"><i class="material-icons left">playlist_add</i>Asignar</a>
      <p class="grey-text" style="margin-top:8px">
        Se asigna <b>proporcional</b> a los proveedores de las filas seleccionadas. (1 camión = 10 t)
      </p>
    </div>
  `;
  M.FormSelect.init(el.querySelectorAll("select"));
  el.querySelector("#asig_mes").addEventListener("change", updateMesSaldo);
  el.querySelector("#btnUsarSeleccion").addEventListener("click", ()=>{
    const t = _selTotals().totalTons;
    const u = document.getElementById('unidadMonto').value;
    document.getElementById('montoAsignar').value = Math.round((u==='trucks'? t/10 : t)*100)/100;
    M.updateTextFields();
  });
  el.querySelector("#btnUsarSaldo").addEventListener("click", ()=>{
    const {saldo} = updateMesSaldo();
    const u = document.getElementById('unidadMonto').value;
    document.getElementById('montoAsignar').value = Math.max(0, Math.round((u==='trucks'? saldo/10 : saldo)*100)/100);
    M.updateTextFields();
  });
  el.querySelector("#btnAsignar").addEventListener("click", doAsignar);
}
function buildTable(){
  table = new Tabulator("#asiTable", {
    data: _rows,
    height: calcAlturaDisponible(260),
    layout: "fitColumns",
    columnMinWidth: 110,
    selectable: true,
    selectableRangeMode: "click",
    groupBy: [], // dinámico
    groupStartOpen: false,
    groupToggleElement: "header",
    groupHeader: (value, count, data, group)=>{
      const total = data.reduce((s,r)=>s+(Number(r.Tons)||0),0);
      const field = group.getField();
      const label = (field==='Mes')?monthLabel(value):value;
      return `<span><strong>${field}:</strong> ${label} <span class="grey-text">(${count} ítem)</span> — <strong>Total:</strong> ${fmt(total)} t</span>`;
    },
    columns: [
      {formatter:"rowSelection", title:"Sel", hozAlign:"center", width:60, headerSort:false, cellClick:(e, cell)=>cell.getRow().toggleSelect()},
      {title:"Mes", field:"MesLabel", width:120, headerSort:true},
      {title:"Proveedor", field:"Proveedor", headerSort:true},
      {title:"Tipo", field:"Tipo", width:90},
      {title:"Comuna", field:"Comuna"},
      {title:"Centro", field:"Centro"},
      {title:"Área", field:"Área"},
      {title:"Tons", field:"Tons", hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Camiones", field:"Trucks", hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Fuente", field:"Fuente", width:120},
    ],
    rowSelectionChanged: _selTotals,
    dataFiltered: (_, rows)=>{
      const visibles = rows.map(r=>r.getData());
      const t = visibles.reduce((s,x)=>s+(Number(x.Tons)||0),0);
      document.getElementById("asiKpiFilas").textContent = visibles.length.toLocaleString('es-CL');
      document.getElementById("asiKpiTons").textContent  = fmt(t);
      document.getElementById("asiKpiCam").textContent   = fmt(t/10);
    }
  });
}
function _selTotals(){
  const sel = table.getSelectedData();
  const totalTons = sel.reduce((s,x)=>s+(Number(x.Tons)||0),0);
  const cam = totalTons/10;
  document.getElementById('selResumen').textContent = `${sel.length} filas · ${fmt(totalTons)} t (${fmt(cam)} cam)`;
  return {sel, totalTons, cam};
}
function applyFilterGroup(){
  if(!table) return;
  const g1 = document.getElementById("asiGrp1").value;
  const g2 = document.getElementById("asiGrp2").value || null;
  const search = (document.getElementById("asiSearch").value||'').toLowerCase();

  // filtro
  table.clearFilter(true);
  if(search){
    table.setFilter([
      [
        {field:"MesLabel", type:"like", value:search},
        {field:"Proveedor", type:"like", value:search},
        {field:"Comuna", type:"like", value:search},
        {field:"Centro", type:"like", value:search},
        {field:"Área", type:"like", value:search},
        {field:"Fuente", type:"like", value:search},
        {field:"Tipo", type:"like", value:search},
      ]
    ], "or");
  }

  // groupBy seguro
  if(g1 && g2) safeGroupBy(table, [g1, g2]);
  else if(g1)  safeGroupBy(table, [g1]);
  else         safeGroupBy(table, []);
}

function updateMesSaldo(){
  const key = document.getElementById("asig_mes").value;
  const disp = Number(_monthTotals.get(key)||0);
  const asig = Number(_asigMap.get(key)||0);
  const saldo = disp - asig;
  document.getElementById('kpiMesDisp').textContent = `Disp: ${fmt(disp)} t`;
  document.getElementById('kpiMesAsig').textContent = `Asig: ${fmt(asig)} t`;
  document.getElementById('kpiMesSaldo').textContent = `Saldo: ${fmt(saldo)} t`;
  return {disp, asig, saldo};
}

async function doAsignar(){
  const mesKey = document.getElementById("asig_mes").value;
  if(!mesKey){ M.toast({html:'Elige un mes a asignar', classes:'red'}); return; }

  const {sel} = _selTotals();
  if(sel.length===0){ M.toast({html:'Selecciona al menos una fila', classes:'red'}); return; }

  const unit = document.getElementById("unidadMonto").value;
  let monto = Number(document.getElementById("montoAsignar").value||0);
  if(monto<=0){ M.toast({html:'Monto a asignar inválido', classes:'red'}); return; }
  if(unit==='trucks') monto = monto*10;

  const {saldo} = updateMesSaldo();
  const asignable = Math.max(0, Math.min(monto, saldo));
  if(asignable<=0){ M.toast({html:'No hay saldo disponible en ese mes', classes:'red'}); return; }

  const byProv = new Map();
  for(const r of sel){
    const p = r.Proveedor || '(sin proveedor)';
    byProv.set(p, (byProv.get(p)||0) + (Number(r.Tons)||0));
  }
  const totalSel = [...byProv.values()].reduce((s,n)=>s+n,0);
  if(totalSel<=0){ M.toast({html:'Selección sin toneladas', classes:'red'}); return; }

  const payload = [];
  let acumulado = 0;
  const provs = [...byProv.keys()];
  provs.forEach((prov, idx)=>{
    let parte = asignable * (byProv.get(prov)/totalSel);
    parte = Math.round(parte*100)/100;
    if(idx===provs.length-1){ parte = Math.round((asignable - acumulado)*100)/100; }
    else{ acumulado += parte; }
    if(parte>0) payload.push({mesKey: mesKey, proveedorNombre: prov, tons: parte, fuente:'ui-asignador'});
  });

  if(payload.length===0){ M.toast({html:'Nada que asignar', classes:'red'}); return; }

  const btn = document.getElementById("btnAsignar");
  btn.disabled = true;
  try{
    await Promise.all(payload.map(p=> apiPost(endpoints.asignaciones, p)));
    M.toast({html:'Asignación registrada', classes:'teal'});
    await cargarAsignacion(); // recarga mi tabla
    document.dispatchEvent(new CustomEvent("asignacion:cambio")); // para que inventario refresque si quieres
  }catch(e){
    console.error(e);
    M.toast({html:'Error guardando asignación', classes:'red'});
  }finally{
    btn.disabled=false;
  }
}

/* ---- ciclo ---- */
export async function cargarAsignacion(){
  const [rows, asigMap] = await Promise.all([ getOfertas(), getAsignacionesMap() ]);
  _rows = rows;
  _monthTotals = monthTotals(rows);
  _asigMap = asigMap;

  if(!table) buildTable();
  table.setData(_rows);
  applyFilterGroup();
  // KPIs iniciales
  const t = _rows.reduce((s,x)=>s+(Number(x.Tons)||0),0);
  document.getElementById("asiKpiFilas").textContent = _rows.length.toLocaleString('es-CL');
  document.getElementById("asiKpiTons").textContent  = fmt(t);
  document.getElementById("asiKpiCam").textContent   = fmt(t/10);
}

/* init de contenedores UI */
export function initAsignacionUI(){
  buildToolbar();
  buildPanel();
}
