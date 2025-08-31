// js/abastecimiento/asignacion/inventario.js
import { apiGet } from "./api.js";
import {
  fmt, monthKey, monthLabel, isoWeekKey,
  calcularAlturaDisponible
} from "./utilidades.js";

/* ================== Estado ================== */
let tableInv = null;

const estado = {
  filasRaw: [],
  filasFull: [],
  asigMap: new Map(),
  monthTotals: new Map(),
  vista: "pivot" // "pivot" | "resumen"
};

/* ================== Helpers ================== */
const uniq = (a)=>[...new Set(a)];
const factorUnidad = (u)=> (u==="trucks" ? (1/10) : 1);

function aggSum(a){ return a.reduce((s,n)=> s+(Number(n)||0), 0); }

function prettyColTitle(dim, key){
  if(dim==="Mes") return monthLabel(key);
  if(dim==="Semana") return `Sem ${key}`;
  return key ?? "(vacío)";
}

/* ================== Datos ================== */
async function getOfertas(){
  const raw = await apiGet("/planificacion/ofertas");
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
  return arr.map(it=>{
    const base = it.fecha || it.fechaPlan || it.fch || it.mes || it.mesKey || "";
    return {
      FechaBase: base,
      Mes: monthKey(base),
      Semana: isoWeekKey(base),
      Proveedor: it.proveedorNombre || it.proveedor || "",
      Centro: it.centroCodigo || "",
      Área: it.areaCodigo || it.area || "",
      Comuna: it.comuna || it.centroComuna || "",
      Tons: Number(it.tons)||0,
      Fuente: it.fuente ? (it.fuente[0].toUpperCase()+it.fuente.slice(1)) : "Disponibilidad"
    };
  }).filter(r=> r.Tons>0);
}

async function getAsignacionesMap(){
  try{
    const raw = await apiGet((window.INV_ASIG_ENDPOINT || "/asignaciones/map"));
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
    const m = new Map();
    for(const it of arr){
      const key = it.key || it.mesKey ||
        (it.anio && it.mes ? `${it.anio}-${String(it.mes).padStart(2,"0")}` : monthKey(it.fecha || it.fechaPlan || it.fch));
      const val = Number(it.asignado ?? it.tons ?? it.total ?? it.valor ?? 0);
      if(key && Number.isFinite(val)) m.set(key, (m.get(key)||0) + val);
    }
    return m;
  }catch{
    return new Map();
  }
}

function calcMonthTotals(rows){
  const m = new Map();
  for(const r of rows){
    const k = r.Mes || "s/fecha";
    m.set(k, (m.get(k)||0) + (Number(r.Tons)||0));
  }
  return m;
}

/** agrega métricas prorrateadas por participación dentro del mes */
function enrichMetrics(rows, asigMap, monthTotals){
  return rows.map(r=>{
    const Tm = Number(monthTotals.get(r.Mes)||0);
    const Am = Number(asigMap.get(r.Mes)||0);
    const Sm = Tm - Am;
    const part = Tm>0 ? (Number(r.Tons)||0)/Tm : 0;
    return {
      ...r,
      Asignado: Am * part,
      Saldo: Sm * part,
    };
  });
}

/* ================== Toolbar ================== */
function buildToolbar(){
  const el = document.getElementById("invToolbar");
  if(!el) return;

  el.innerHTML = `
    <div class="input-field">
      <select id="invRow">
        <option value="Mes" selected>Mes</option>
        <option value="Semana">Semana</option>
        <option value="Proveedor">Proveedor</option>
        <option value="Comuna">Comuna</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
        <option value="Fuente">Fuente</option>
      </select>
      <label>Fila (nivel 1)</label>
    </div>

    <div class="input-field">
      <select id="invSub1">
        <option value="">— Ninguna —</option>
        <option value="Semana">Semana</option>
        <option value="Proveedor" selected>Proveedor</option>
        <option value="Comuna">Comuna</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
        <option value="Fuente">Fuente</option>
      </select>
      <label>Subfila 1</label>
    </div>

    <div class="input-field">
      <select id="invSub2">
        <option value="">— Ninguna —</option>
        <option value="Semana">Semana</option>
        <option value="Proveedor">Proveedor</option>
        <option value="Comuna">Comuna</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
        <option value="Fuente">Fuente</option>
      </select>
      <label>Subfila 2</label>
    </div>

    <div class="input-field">
      <select id="invCol">
        <option value="Mes" selected>Mes</option>
        <option value="Semana">Semana</option>
        <option value="Proveedor">Proveedor</option>
        <option value="Comuna">Comuna</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
        <option value="Fuente">Fuente</option>
      </select>
      <label>Columna</label>
    </div>

    <div class="input-field">
      <select id="invMetric">
        <option value="Tons" selected>Tons</option>
        <option value="Asignado">Asignado</option>
        <option value="Saldo">Saldo</option>
      </select>
      <label>Métrica (celdas)</label>
    </div>

    <div class="input-field">
      <select id="invUnit">
        <option value="tons" selected>Toneladas</option>
        <option value="trucks">Camiones (10 t)</option>
      </select>
      <label>Unidad</label>
    </div>

    <div class="input-field">
      <select id="invVista">
        <option value="pivot" selected>Pivot</option>
        <option value="resumen">Resumen (3 columnas)</option>
      </select>
      <label>Vista</label>
    </div>

    <div class="right-actions" style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
      <a class="btn teal" id="invApply"><i class="material-icons left">refresh</i>Actualizar</a>
      <span class="pill" id="invBadge">0 registros</span>
      <a class="btn grey darken-2" id="invCSV"><i class="material-icons left">download</i>CSV</a>
      <a class="btn grey darken-2" id="invXLSX"><i class="material-icons left">file_download</i>XLSX</a>
    </div>
  `;

  M.FormSelect.init(el.querySelectorAll("select"));

  el.querySelector("#invApply").addEventListener("click", renderInventario);
  el.querySelector("#invVista").addEventListener("change", (e)=>{
    estado.vista = e.target.value || "pivot";
    renderInventario(true); // recrea tabla para evitar warnings
  });
  el.querySelector("#invCSV").addEventListener("click", ()=> tableInv?.download("csv","inventario.csv"));
  el.querySelector("#invXLSX").addEventListener("click", ()=> tableInv?.download("xlsx","inventario.xlsx",{sheetName:"Inventario"}));
}

/* ================== PIVOT ================== */
function pivotData(rows, rowDim, sub1, sub2, colDim, metric, unit){
  const cellFactor = factorUnidad(unit);

  const rowKeys = uniq(rows.map(r => r[rowDim] || "(vacío)"));
  const colKeys = uniq(rows.map(r => r[colDim] || "(vacío)")).sort();

  const matrix = [];
  const labelField = sub2 || sub1 || rowDim;

  const emitRow = (scopeObj, scopeArr)=>{
    const rowObj = {...scopeObj};
    for(const ck of colKeys){
      const slice = scopeArr.filter(x => (x[colDim]||"(vacío)")===ck)
                            .map(x => (Number(x[metric])||0) * cellFactor);
      rowObj[ck] = aggSum(slice);
    }
    rowObj["Total"] = aggSum(colKeys.map(ck => rowObj[ck]));

    // fijos (sumas en tons -> convierto si camiones)
    const sumField = (arr,f)=>arr.reduce((s,x)=> s+(Number(x[f])||0),0);
    const totalsFactor = factorUnidad(unit);
    rowObj["Disponibles"] = sumField(scopeArr,"Tons")     * totalsFactor;
    rowObj["AsignadoF"]  = sumField(scopeArr,"Asignado") * totalsFactor;
    rowObj["SaldoF"]     = sumField(scopeArr,"Saldo")    * totalsFactor;

    matrix.push(rowObj);
  };

  for(const rk of rowKeys){
    const subsetR = rows.filter(r => (r[rowDim]||"(vacío)")===(rk||"(vacío)"));
    if(sub1){
      const s1Keys = uniq(subsetR.map(r => r[sub1] || "(vacío)"));
      for(const s1 of s1Keys){
        const subsetS1 = subsetR.filter(r => (r[sub1]||"(vacío)")===(s1||"(vacío)"));
        if(sub2){
          const s2Keys = uniq(subsetS1.map(r => r[sub2] || "(vacío)"));
          for(const s2 of s2Keys){
            emitRow({[rowDim]:rk, [sub1]:s1, [labelField]:s2},
                    subsetS1.filter(x => (x[sub2]||"(vacío)")===(s2||"(vacío)")));
          }
        }else{
          emitRow({[rowDim]:rk, [labelField]:s1}, subsetS1);
        }
      }
    }else{
      emitRow({[rowDim]:rk, [labelField]:rk}, subsetR);
    }
  }

  // total general
  const tot = {[rowDim]:"Total",[labelField]:"Total"};
  for(const ck of colKeys){
    tot[ck] = aggSum(matrix.map(r => r[ck]));
  }
  tot["Total"]       = aggSum(matrix.map(r => r["Total"]));
  tot["Disponibles"] = aggSum(matrix.map(r => r["Disponibles"]));
  tot["AsignadoF"]   = aggSum(matrix.map(r => r["AsignadoF"]));
  tot["SaldoF"]      = aggSum(matrix.map(r => r["SaldoF"]));
  matrix.push(tot);

  return {matrix, colKeys, labelField};
}

function makePivotColumns(labelField, colKeys, colDim){
  const cols = [
    {title: labelField, field: labelField, frozen:true, width: 220, headerSort:true}
  ];
  for(const ck of colKeys){
    cols.push({
      title: prettyColTitle(colDim, ck),
      field: ck,
      hozAlign:"right", headerHozAlign:"right",
      formatter:(c)=>fmt(c.getValue()),
      width:120
    });
  }
  cols.push({title:"Total (métrica)", field:"Total", hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue()), width:140});
  cols.push({title:"Disponibles",    field:"Disponibles", hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue()), width:130});
  cols.push({title:"Asignado",       field:"AsignadoF",   hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue()), width:120});
  cols.push({title:"Saldo",          field:"SaldoF",      hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue()), width:110});
  return cols;
}

/* ================== RESUMEN (3 columnas) ================== */
function resumenData(rows, rowDim, sub1, sub2, unit){
  const factor = factorUnidad(unit);
  const rowsOut = [];

  const pushScope = (scope) =>{
    const disp = aggSum(scope.map(x=>Number(x.Tons)||0)) * factor;
    const asig = aggSum(scope.map(x=>Number(x.Asignado)||0)) * factor;
    const saldo = aggSum(scope.map(x=>Number(x.Saldo)||0)) * factor;
    rowsOut.push({Disponibles:disp, Asignado:asig, Saldo:saldo});
  };

  const rowKeys = uniq(rows.map(r => r[rowDim] || "(vacío)"));
  for(const rk of rowKeys){
    const subsetR = rows.filter(r => (r[rowDim]||"(vacío)")===(rk||"(vacío)"));
    if(sub1){
      const s1Keys = uniq(subsetR.map(r => r[sub1] || "(vacío)"));
      for(const s1 of s1Keys){
        const subsetS1 = subsetR.filter(r => (r[sub1]||"(vacío)")===(s1||"(vacío)"));
        if(sub2){
          const s2Keys = uniq(subsetS1.map(r => r[sub2] || "(vacío)"));
          for(const s2 of s2Keys){
            pushScope(subsetS1.filter(x => (x[sub2]||"(vacío)")===(s2||"(vacío)")));
          }
        }else{
          pushScope(subsetS1);
        }
      }
    }else{
      pushScope(subsetR);
    }
  }
  return rowsOut;
}

function makeResumenColumns(){
  return [
    {title:"Disponibles", field:"Disponibles", hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue()), width:140},
    {title:"Asignado", field:"Asignado", hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue()), width:140},
    {title:"Saldo", field:"Saldo", hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue()), width:140},
  ];
}

/* ================== Render ================== */
function destroyTable(){
  try{ tableInv?.destroy(); }catch{}
  tableInv = null;
}

function readToolbar(){
  const g = id => document.getElementById(id)?.value || "";
  return {
    row: g("invRow"),
    sub1: g("invSub1"),
    sub2: g("invSub2"),
    col:  g("invCol"),
    metric: g("invMetric"),
    unit: g("invUnit"),
    vista: g("invVista") || estado.vista,
  };
}

export function getTablaInventario(){ return tableInv; }

export async function cargarInventario(){
  const [rows, asigMap] = await Promise.all([ getOfertas(), getAsignacionesMap() ]);
  estado.filasRaw = rows;
  estado.asigMap = asigMap;
  estado.monthTotals = calcMonthTotals(rows);
  estado.filasFull = enrichMetrics(rows, asigMap, estado.monthTotals);

  // badge
  const b = document.getElementById("invBadge");
  if (b) b.textContent = `${rows.length.toLocaleString("es-CL")} registros`;

  renderInventario(true); // primera vez, recrea tabla
}

export function renderInventario(recreate=false){
  const {row, sub1, sub2, col, metric, unit, vista} = readToolbar();
  estado.vista = vista;

  const h = calcularAlturaDisponible(260);
  if(recreate) destroyTable();

  if(vista === "pivot"){
    const {matrix, colKeys, labelField} =
      pivotData(estado.filasFull, row, sub1, sub2, col, metric, unit);
    const columns = makePivotColumns(labelField, colKeys, col);

    if(!tableInv){
      tableInv = new Tabulator("#invTable", {
        data: matrix,
        columns,
        height: h,
        layout: "fitColumns",
        columnMinWidth: 110,
        movableColumns: true,
        resizableColumnFit: true,
      });
    }else{
      tableInv.setColumns(columns);
      tableInv.replaceData(matrix);
      tableInv.setHeight(h);
      tableInv.redraw(true);
    }
    const note = document.getElementById("invNote");
    if(note) note.textContent = `Unidad actual: ${unit==="trucks" ? "Camiones (10 t)" : "Toneladas"}.`;

  }else{ // resumen 3 columnas
    const columns = makeResumenColumns();
    const data = resumenData(estado.filasFull, row, sub1, sub2, unit);

    if(!tableInv){
      tableInv = new Tabulator("#invTable", {
        data, columns, height: h, layout:"fitColumns", columnMinWidth: 110,
        groupStartOpen: false, groupToggleElement:"header",
        groupHeader: (value, count, data, group)=>{
          const f = group.getField();
          const label = (f==="Mes")? monthLabel(value) : value;
          const totDisp = data.reduce((s,r)=> s+(Number(r.Disponibles)||0),0);
          const totAsig = data.reduce((s,r)=> s+(Number(r.Asignado)||0),0);
          const totSaldo= data.reduce((s,r)=> s+(Number(r.Saldo)||0),0);
          return `<span><strong>${f}:</strong> ${label} — Disp: ${fmt(totDisp)} · Asig: ${fmt(totAsig)} · Saldo: ${fmt(totSaldo)}</span>`;
        },
      });
    }else{
      tableInv.setColumns(columns);
      tableInv.replaceData(data);
      tableInv.setHeight(h);
      tableInv.redraw(true);
    }

    // agrupar ahora que existe la tabla (evita warnings)
    const groups = [row].concat(sub1? [sub1]:[]).concat(sub2? [sub2]:[]);
    tableInv.setGroupBy(groups);

    const note = document.getElementById("invNote");
    if(note) note.textContent = `Unidad actual: ${unit==="trucks" ? "Camiones (10 t)" : "Toneladas"}.`;
  }
}

/* ================== Init ================== */
export function initInventarioUI(){
  buildToolbar();
  // badge inicial
  const b = document.getElementById("invBadge");
  if (b) b.textContent = `0 registros`;
}
