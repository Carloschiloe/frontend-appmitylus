// js/abastecimiento/asignacion/inventarios.js
import { apiGet, INV_ASIG_ENDPOINT } from "./api.js";
import { fmt, monthKey, monthLabel, isoWeekKey, calcularAlturaDisponible, prettyGroupLabel } from "./utilidades.js";

let tableInv = null;
let estado = {
  unidad: "tons",                // "tons" | "trucks"
  filas:   "Mes",
  sub1:    "Semana",
  sub2:    "Proveedor",

  rowsRaw: [],                   // ofertas crudas
  rowsFull: [],                  // con métricas prorrateadas
  monthTotals: new Map(),
  asigMap: new Map(),
};

export function getTablaInventario(){ return tableInv; }

function factorUnidad(){
  return (estado.unidad === "trucks") ? (1/10) : 1;
}
function fmtUnidad(v){
  return fmt(v * factorUnidad());
}

function calcularMesTotals(rows){
  const m=new Map();
  for(const r of rows){
    const k=r.Mes || 's/fecha';
    m.set(k, (m.get(k)||0) + (Number(r.Tons)||0));
  }
  return m;
}

function enriquecerMétricas(rows, asigMap, mTotals){
  return rows.map(r=>{
    const Tm = Number(mTotals.get(r.Mes)||0);
    const Am = Number(asigMap.get(r.Mes)||0);
    const Sm = Tm - Am;
    const factor = Tm>0 ? ((Number(r.Tons)||0)/Tm) : 0;
    const Asignado = Am*factor;
    const Saldo    = Sm*factor;
    return {...r, Asignado, Saldo, Disp: Number(r.Tons)||0};
  });
}

function buildToolbar(){
  const root = document.getElementById("invToolbar");
  root.innerHTML = `
    <div class="input-field">
      <select id="invFila">
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
        <option value="Semana" selected>Semana</option>
        <option value="Proveedor">Proveedor</option>
        <option value="Comuna">Comuna</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
        <option value="Fuente">Fuente</option>
        <option value="Mes">Mes</option>
      </select>
      <label>Subfila 1</label>
    </div>
    <div class="input-field">
      <select id="invSub2">
        <option value="">— Ninguna —</option>
        <option value="Proveedor" selected>Proveedor</option>
        <option value="Comuna">Comuna</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
        <option value="Fuente">Fuente</option>
        <option value="Semana">Semana</option>
        <option value="Mes">Mes</option>
      </select>
      <label>Subfila 2</label>
    </div>
    <div class="input-field">
      <select id="invUnidad">
        <option value="tons" selected>Toneladas</option>
        <option value="trucks">Camiones (10 t)</option>
      </select>
      <label>Unidad</label>
    </div>

    <div class="right-actions" style="display:flex;gap:8px;justify-content:flex-end;align-items:center">
      <a class="btn teal" id="invRefrescar"><i class="material-icons left">refresh</i>Actualizar</a>
      <span class="pill" id="invBadge">0 registros</span>
      <a class="btn grey darken-2" id="invCSV"><i class="material-icons left">download</i>CSV</a>
      <a class="btn grey darken-2" id="invXLSX"><i class="material-icons left">file_download</i>XLSX</a>
    </div>
  `;
  M.FormSelect.init(root.querySelectorAll("select"));

  root.querySelector("#invUnidad").addEventListener("change", ()=>{
    estado.unidad = root.querySelector("#invUnidad").value;
    document.getElementById("invNote").textContent =
      `Unidad actual: ${estado.unidad==='trucks'?'Camiones (10 t)':'Toneladas'}.`;
    tableInv?.redraw(true);
  });

  root.querySelector("#invFila").addEventListener("change", ()=>{ estado.filas = root.querySelector("#invFila").value; aplicarAgrupación(); });
  root.querySelector("#invSub1").addEventListener("change", ()=>{ estado.sub1  = root.querySelector("#invSub1").value; aplicarAgrupación(); });
  root.querySelector("#invSub2").addEventListener("change", ()=>{ estado.sub2  = root.querySelector("#invSub2").value; aplicarAgrupación(); });

  root.querySelector("#invRefrescar").addEventListener("click", ()=> cargarInventario());
  root.querySelector("#invCSV").addEventListener("click", ()=> tableInv?.download("csv","inventario.csv"));
  root.querySelector("#invXLSX").addEventListener("click", ()=> tableInv?.download("xlsx","inventario.xlsx",{sheetName:"Inventario"}));
}

function aplicarAgrupación(){
  const groups = [estado.filas].filter(Boolean);
  if(estado.sub1) groups.push(estado.sub1);
  if(estado.sub2) groups.push(estado.sub2);
  if(!tableInv) return;

  // setGroupBy después de tableBuilt
  if(tableInv.modules?.groupRows){
    tableInv.setGroupBy(groups);
  }else{
    tableInv.on("tableBuilt", ()=> tableInv.setGroupBy(groups));
  }
  tableInv.redraw(true);
}

function groupHeader(value, count, data, group){
  const f = factorUnidad();
  const sum = (field)=> data.reduce((s,r)=> s + (Number(r[field])||0), 0) * f;
  const disp = sum("Disp"), asig = sum("Asignado"), saldo = sum("Saldo");
  const field = group.getField();
  const label = prettyGroupLabel(field, value);
  return `<span><strong>${field}:</strong> ${label} — <strong>Disp:</strong> ${fmt(disp)} · <strong>Asig:</strong> ${fmt(asig)} · <strong>Saldo:</strong> ${fmt(saldo)}</span>`;
}

function construirTabla(){
  if(tableInv){
    tableInv.replaceData(estado.rowsFull);
    document.getElementById("invBadge").textContent = `${estado.rowsRaw.length} registros`;
    aplicarAgrupación();
    return;
  }
  tableInv = new Tabulator("#invTable", {
    data: estado.rowsFull,
    height: calcularAlturaDisponible(260),
    layout: "fitColumns",
    groupStartOpen: false,
    groupToggleElement: "header",
    groupHeader,
    columns: [
      // SOLO 3 COLUMNAS FIJAS
      { title:"Disponibles", field:"Disp", hozAlign:"right", headerHozAlign:"right",
        formatter:(c)=> fmtUnidad(c.getValue()), width:140 },
      { title:"Asignado",   field:"Asignado", hozAlign:"right", headerHozAlign:"right",
        formatter:(c)=> fmtUnidad(c.getValue()), width:140 },
      { title:"Saldo",      field:"Saldo", hozAlign:"right", headerHozAlign:"right",
        formatter:(c)=> fmtUnidad(c.getValue()), width:120 },
    ],
  });

  tableInv.on("tableBuilt", aplicarAgrupación);
  document.getElementById("invBadge").textContent = `${estado.rowsRaw.length} registros`;
}

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
      Fuente: it.fuente ? (it.fuente[0].toUpperCase()+it.fuente.slice(1)) : "Disponibilidad",
      Tipo: (it.tipo || it.bap)? "BAP" : "NORMAL",
    };
  }).filter(r=> r.Tons>0);
}

async function getAsignacionesMap(){
  try{
    const raw = await apiGet(INV_ASIG_ENDPOINT);
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items)? raw.items : []);
    const m = new Map();
    for(const it of arr){
      const key = it.key || it.mesKey || (it.anio && it.mes ? `${it.anio}-${String(it.mes).padStart(2,"0")}` : monthKey(it.fecha || it.fechaPlan || it.fch));
      const val = Number(it.asignado ?? it.tons ?? it.total ?? it.valor ?? 0);
      if(key && Number.isFinite(val)) m.set(key, (m.get(key)||0) + val);
    }
    return m;
  }catch{
    return new Map();
  }
}

export async function cargarInventario(){
  try{
    const [ofertas, asigMap] = await Promise.all([ getOfertas(), getAsignacionesMap() ]);
    estado.rowsRaw    = ofertas;
    estado.asigMap    = asigMap;
    estado.monthTotals= calcularMesTotals(ofertas);
    estado.rowsFull   = enriquecerMétricas(ofertas, asigMap, estado.monthTotals);
    construirTabla();
  }catch(e){
    console.error(e);
    M.toast({html:"No se pudo cargar Inventario", classes:"red"});
  }
}
