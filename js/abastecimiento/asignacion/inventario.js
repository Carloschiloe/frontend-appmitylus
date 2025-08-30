// js/abastecimiento/asignacion/inventarios.js
import {apiGet, endpoints} from "./api.js";
import {fmt, monthKey, monthLabel, isoWeekKey, safeGroupBy, calcAlturaDisponible} from "./utilidades.js";

let _table = null;
let _raw = [], _full = [], _asigMap = new Map(), _monthTotals = new Map();
let _unit = "tons"; // tons | trucks

export function getTablaInventario(){ return _table; }

/* --------- Data --------- */
async function getOfertas(){
  const raw = await apiGet(endpoints.ofertas);
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
  return arr.map(it=>{
    const fechaBase = it.fecha || it.fechaPlan || it.fch || it.mes || it.mesKey || '';
    return {
      Mes: monthKey(fechaBase),
      Semana: isoWeekKey(fechaBase),
      Proveedor: it.proveedorNombre || it.proveedor || '',
      Centro: it.centroCodigo || '',
      Área: it.areaCodigo || it.area || '',
      Comuna: it.comuna || it.centroComuna || '',
      Tons: Number(it.tons)||0,
      Tipo: (String(it.tipo||"").toUpperCase()==="BAP" ? "BAP" : "NORMAL"),
      Fuente: it.fuente ? it.fuente[0].toUpperCase()+it.fuente.slice(1) : 'Disponibilidad'
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
function monthTotals(rows){
  const m=new Map();
  for(const r of rows){ const k=r.Mes||'s/fecha'; m.set(k,(m.get(k)||0)+(Number(r.Tons)||0)); }
  return m;
}
// prorrateo por participación del mes
function enrichMetrics(rows, asigMap, mTotals){
  return rows.map(r=>{
    const Tm = Number(mTotals.get(r.Mes)||0);
    const Am = Number(asigMap.get(r.Mes)||0);
    const Sm = Tm - Am;
    const f = Tm>0 ? ((Number(r.Tons)||0)/Tm) : 0;
    const Asignado = Am*f;
    const Saldo = Sm*f;
    return {...r, Asignado, Saldo};
  });
}
function factor(){ return _unit==='trucks' ? 1/10 : 1; }

/* --------- UI --------- */
function buildToolbar(){
  const el = document.getElementById("invToolbar");
  el.innerHTML = `
    <div class="input-field">
      <select id="inv_row">
        <option value="Mes" selected>Mes</option>
        <option value="Semana">Semana</option>
        <option value="Proveedor">Proveedor</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
        <option value="Comuna">Comuna</option>
        <option value="Fuente">Fuente</option>
      </select>
      <label>Fila (nivel 1)</label>
    </div>
    <div class="input-field">
      <select id="inv_sub1">
        <option value="">— Ninguna —</option>
        <option value="Semana">Semana</option>
        <option value="Proveedor" selected>Proveedor</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
        <option value="Comuna">Comuna</option>
        <option value="Mes">Mes</option>
        <option value="Fuente">Fuente</option>
      </select>
      <label>Subfila 1</label>
    </div>
    <div class="input-field">
      <select id="inv_sub2">
        <option value="">— Ninguna —</option>
        <option value="Proveedor">Proveedor</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
        <option value="Comuna">Comuna</option>
        <option value="Semana">Semana</option>
        <option value="Mes">Mes</option>
        <option value="Fuente">Fuente</option>
      </select>
      <label>Subfila 2</label>
    </div>
    <div class="input-field">
      <select id="inv_unit">
        <option value="tons" selected>Toneladas</option>
        <option value="trucks">Camiones (10 t)</option>
      </select>
      <label>Unidad</label>
    </div>
    <div class="right-actions" style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
      <a class="btn teal" id="inv_btnApply"><i class="material-icons left">refresh</i>Actualizar</a>
      <span class="pill" id="inv_badge">0 registros</span>
      <a class="btn grey darken-2" id="inv_btnCSV"><i class="material-icons left">download</i>CSV</a>
      <a class="btn grey darken-2" id="inv_btnXLSX"><i class="material-icons left">file_download</i>XLSX</a>
    </div>
  `;
  M.FormSelect.init(el.querySelectorAll("select"));
  document.getElementById("inv_btnApply").addEventListener("click", apply);
  document.getElementById("inv_btnCSV").addEventListener("click", ()=>{ _table?.download("csv","inventario.csv"); });
  document.getElementById("inv_btnXLSX").addEventListener("click", ()=>{ _table?.download("xlsx","inventario.xlsx",{sheetName:"Inventario"}); });
}
function aggregate(dims){
  const map = new Map();
  for(const r of _full){
    const keyObj = {}; dims.forEach(k=> keyObj[k] = r[k] || '(vacío)');
    const key = JSON.stringify(keyObj);
    if(!map.has(key)) map.set(key, { ...keyObj, Disponibles:0, Asignado:0, Saldo:0 });
    const t = map.get(key);
    t.Disponibles += (Number(r.Tons)||0);
    t.Asignado   += (Number(r.Asignado)||0);
    t.Saldo      += (Number(r.Saldo)||0);
  }
  const f = factor();
  return [...map.values()].map(x=>({
    ...x,
    Disponibles: x.Disponibles*f,
    Asignado: x.Asignado*f,
    Saldo: x.Saldo*f
  }));
}
function makeColumns(){
  return [
    {title:"Elemento", field:"Elemento", width:220, formatter:(c)=>{
      const d=c.getData(); // mostrar lo más específico disponible
      return d.Elemento || d.Proveedor || d.Comuna || d.Centro || d.Área || d.Semana || (d.Mes?monthLabel(d.Mes):"(grupo)");
    }},
    {title:"Disponibles", field:"Disponibles", hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue())},
    {title:"Asignado",   field:"Asignado",   hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue())},
    {title:"Saldo",      field:"Saldo",      hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue())},
  ];
}
function groupHeader(field){
  return function(value, count, data, group){
    const sum = (arr,f)=>arr.reduce((s,r)=>s+(Number(r[f])||0),0);
    const totDisp = sum(data,"Disponibles");
    const totAsig = sum(data,"Asignado");
    const totSaldo= sum(data,"Saldo");
    const label   = (field==='Mes')?monthLabel(value):value;
    return `<span><strong>${field}:</strong> ${label} <span class="grey-text">(${count} ítem)</span> — <strong>Disp:</strong> ${fmt(totDisp)} · <strong>Asig:</strong> ${fmt(totAsig)} · <strong>Saldo:</strong> ${fmt(totSaldo)}</span>`;
  }
}
function apply(){
  if(!_table) return; // aún no creada (loadAll la creará y luego setea datos)
  _unit = document.getElementById("inv_unit").value;
  const row = document.getElementById("inv_row").value;
  const s1  = document.getElementById("inv_sub1").value;
  const s2  = document.getElementById("inv_sub2").value;
  const dims = [row, ...(s1? [s1]:[]), ...(s2? [s2]:[])];

  const data = aggregate(dims).map(x=>{
    const last = dims[dims.length-1] || row;
    return { ...x, Elemento: x[last] };
  });

  _table.setData(data);
  _table.setColumns(makeColumns());
  // agrupación segura
  safeGroupBy(_table, dims);
  document.getElementById("invNote").textContent = `Unidad actual: ${_unit==='trucks'?'Camiones (10 t)':'Toneladas'}.`;
  document.getElementById("inv_badge").textContent = `${_raw.length.toLocaleString('es-CL')} registros`;
}
export async function cargarInventario(){
  const [ofertas, asigMap] = await Promise.all([ getOfertas(), getAsignacionesMap() ]);
  _raw = ofertas;
  _asigMap = asigMap;
  _monthTotals = monthTotals(ofertas);
  _full = enrichMetrics(ofertas, asigMap, _monthTotals);

  // si no existe tabla, créala
  if(!_table){
    _table = new Tabulator("#invTable", {
      data: [],
      columns: makeColumns(),
      height: calcAlturaDisponible(260),
      layout: "fitColumns",
      columnMinWidth: 110,
      movableColumns: true,
      groupBy: [], // se actualizará en apply()
      groupStartOpen: false,
      groupToggleElement: "header",
      groupHeader: group => groupHeader(group.getField()),
    });
  }
  apply(); // pinta según selecciones actuales
}
