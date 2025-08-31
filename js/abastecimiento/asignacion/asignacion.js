// js/abastecimiento/asignacion/asignacion.js
import { apiGet, apiPost, INV_ASIG_ENDPOINT } from "./api.js";
import { fmt, monthKey, isoWeekKey, monthLabel, calcularAlturaDisponible } from "./utilidades.js";

let tableAsign = null;

const estado = {
  rows: [],
  monthTotals: new Map(),
  asigMap: new Map(),
};

function factorUnidad(u){ return (u === "trucks") ? (1/10) : 1; }

function buildToolbar() {
  const t = document.getElementById("asiToolbar");
  if(!t) return;
  t.innerHTML = `
    <div class="row" style="margin:0;align-items:flex-end">
      <div class="input-field col s12 m6">
        <i class="material-icons prefix">search</i>
        <input id="asiBuscar" type="text" placeholder="Busca por mes, proveedor, comuna, centro..." />
        <label for="asiBuscar">Buscar</label>
      </div>
      <div class="input-field col s6 m3">
        <select id="asiGrp1">
          <option value="Mes" selected>Mes</option>
          <option value="Comuna">Comuna</option>
          <option value="Proveedor">Proveedor</option>
        </select>
        <label>Agrupar por</label>
      </div>
      <div class="input-field col s6 m3">
        <select id="asiGrp2">
          <option value="">— Ninguno —</option>
          <option value="Comuna" selected>Comuna</option>
          <option value="Proveedor">Proveedor</option>
        </select>
        <label>Subgrupo</label>
      </div>
    </div>
  `;
  M.FormSelect.init(t.querySelectorAll("select"));

  t.querySelector("#asiBuscar").addEventListener("input", aplicarFiltrosAgrupacion);
  t.querySelector("#asiGrp1").addEventListener("change", aplicarFiltrosAgrupacion);
  t.querySelector("#asiGrp2").addEventListener("change", aplicarFiltrosAgrupacion);

  const panel = document.getElementById("asiPanel");
  if(panel){
    panel.innerHTML = `
      <div class="card-soft" style="padding:12px;margin-bottom:12px">
        <div class="row" style="margin:0">
          <div class="input-field col s12">
            <input id="asig_mes" type="month">
            <label class="active" for="asig_mes">Mes a asignar</label>
          </div>
        </div>
        <div class="card-soft" style="padding:12px">
          <h6 style="margin:0 0 8px">Saldo del mes elegido</h6>
          <p class="grey-text"><span id="asiDisp">Disp: 0 t</span> · <span id="asiAsig">Asig: 0 t</span> · <span id="asiSaldo">Saldo: 0 t</span></p>
        </div>
      </div>

      <div class="card-soft" style="padding:12px;margin-bottom:12px">
        <h6 style="margin:0 0 8px">Selección actual</h6>
        <p class="grey-text" id="asiResumenSel">0 filas · 0,00 t (0 cam)</p>
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
          <a class="btn-flat teal-text" id="btnUsarSel"><i class="material-icons left">done_all</i>Usar total seleccionado</a>
          <a class="btn-flat teal-text" id="btnUsarSaldo"><i class="material-icons left">equalizer</i>Usar saldo del mes</a>
        </div>
      </div>

      <div class="card-soft" style="padding:12px">
        <a class="btn teal" id="btnAsignar"><i class="material-icons left">playlist_add</i>Asignar</a>
        <p class="grey-text" style="margin-top:8px">(1 camión = 10 t)</p>
      </div>
    `;
    M.FormSelect.init(panel.querySelectorAll("select"));

    panel.querySelector("#asig_mes").addEventListener("change", actualizarSaldoMes);
    panel.querySelector("#btnUsarSel").addEventListener("click", usarSeleccion);
    panel.querySelector("#btnUsarSaldo").addEventListener("click", usarSaldo);
    panel.querySelector("#btnAsignar").addEventListener("click", realizarAsignacion);
  }
}

function setKPIs(rows){
  const total = rows.reduce((s,x)=> s + (Number(x.Tons)||0), 0);

  const elFilas = document.getElementById("asiKpiFilas");
  if (elFilas) elFilas.innerText = rows.length.toLocaleString("es-CL");

  const elTons = document.getElementById("asiKpiTons");
  if (elTons) elTons.innerText = fmt(total);

  const elCam = document.getElementById("asiKpiCam");
  if (elCam) elCam.innerText = fmt(total/10);
}

function aplicarFiltrosAgrupacion(){
  if(!tableAsign) return;
  const g1 = document.getElementById("asiGrp1")?.value || "";
  const g2 = document.getElementById("asiGrp2")?.value || "";
  const search = (document.getElementById("asiBuscar")?.value || "").toLowerCase();

  tableAsign.clearFilter(true);
  if(search){
    tableAsign.setFilter([
      [
        {field:"MesLabel", type:"like", value:search},
        {field:"Proveedor", type:"like", value:search},
        {field:"Comuna", type:"like", value:search},
        {field:"Centro", type:"like", value:search},
        {field:"Área", type:"like", value:search},
        {field:"Fuente", type:"like", value:search},
      ]
    ], "or");
  }

  const groups = g1 ? [g1] : [];
  if(g2) groups.push(g2);
  tableAsign.setGroupBy(groups);
  setKPIs(tableAsign.getData("active"));
}

function actualizarResumenSel(){
  const sel = tableAsign?.getSelectedData() || [];
  const t = sel.reduce((s,x)=> s + (Number(x.Tons)||0), 0);
  const cam = t/10;

  const el = document.getElementById("asiResumenSel");
  if (el) el.innerText = `${sel.length} filas · ${fmt(t)} t (${fmt(cam)} cam)`;

  return { sel, totalTons: t, cam };
}

function actualizarSaldoMes(){
  const key = document.getElementById("asig_mes")?.value || "";
  const disp = Number(estado.monthTotals.get(key)||0);
  const asig = Number(estado.asigMap.get(key)||0);
  const saldo = disp - asig;

  const d = document.getElementById("asiDisp");
  if (d) d.innerText = `Disp: ${fmt(disp)} t`;
  const a = document.getElementById("asiAsig");
  if (a) a.innerText = `Asig: ${fmt(asig)} t`;
  const s = document.getElementById("asiSaldo");
  if (s) s.innerText = `Saldo: ${fmt(saldo)} t`;

  return { disp, asig, saldo };
}

function usarSeleccion(){
  const { totalTons } = actualizarResumenSel();
  const unidad = document.getElementById("unidadMonto")?.value || "tons";
  const input = document.getElementById("montoAsignar");
  if (input) {
    input.value = Math.round((unidad==="trucks" ? totalTons/10 : totalTons)*100)/100;
    M.updateTextFields();
  }
}

function usarSaldo(){
  const { saldo } = actualizarSaldoMes();
  const unidad = document.getElementById("unidadMonto")?.value || "tons";
  const input = document.getElementById("montoAsignar");
  if (input) {
    input.value = Math.max(0, Math.round((unidad==="trucks" ? saldo/10 : saldo)*100)/100);
    M.updateTextFields();
  }
}

async function realizarAsignacion(){
  const mesKey = document.getElementById("asig_mes")?.value;
  if(!mesKey){ M.toast({html:"Elige un mes a asignar", classes:"red"}); return; }

  const { sel } = actualizarResumenSel();
  if(sel.length===0){ M.toast({html:"Selecciona al menos una fila", classes:"red"}); return; }

  let monto = Number(document.getElementById("montoAsignar").value||0);
  if(monto<=0){ M.toast({html:"Monto inválido", classes:"red"}); return; }
  if((document.getElementById("unidadMonto")?.value || "tons") === "trucks") monto *= 10;

  const { saldo } = actualizarSaldoMes();
  const asignable = Math.max(0, Math.min(monto, saldo));
  if(asignable<=0){ M.toast({html:"No hay saldo disponible", classes:"red"}); return; }

  // Proporcional por proveedor dentro de la selección
  const byProv = new Map();
  for(const r of sel){
    const p = r.Proveedor || "(sin proveedor)";
    byProv.set(p, (byProv.get(p)||0) + (Number(r.Tons)||0));
  }
  const totalSel = [...byProv.values()].reduce((s,n)=> s+n, 0);
  if(totalSel<=0){ M.toast({html:"Selección sin toneladas", classes:"red"}); return; }

  const payload = [];
  let acumulado = 0;
  const provs = [...byProv.keys()];
  provs.forEach((prov, idx)=>{
    let parte = asignable * (byProv.get(prov)/totalSel);
    parte = Math.round(parte*100)/100;
    if(idx===provs.length-1){
      parte = Math.round((asignable - acumulado)*100)/100;
    }else{
      acumulado += parte;
    }
    if(parte>0) payload.push({mesKey, proveedorNombre: prov, tons: parte, fuente: "ui-asignador"});
  });

  try{
    await Promise.all(payload.map(p => apiPost("/asignaciones", p)));
    M.toast({html:"Asignación registrada", classes:"teal"});

    // refrescar mapas locales
    await cargarAsignacion();

    // notificar a otros módulos
    document.dispatchEvent(new Event("asignacion:cambio"));
  }catch(e){
    console.error(e);
    M.toast({html:"Error guardando asignación", classes:"red"});
  }
}

function construirTabla(rows){
  const datos = rows.map(r=>({
    Mes: r.Mes,
    MesLabel: monthLabel(r.Mes),
    Proveedor: r.Proveedor || "(sin proveedor)",
    Comuna: r.Comuna || "",
    Centro: r.Centro || "",
    Área: r.Área || "",
    Tons: Number(r.Tons)||0,
    Trucks: (Number(r.Tons)||0)/10,
    Fuente: r.Fuente || "",
  }));

  if(tableAsign){
    tableAsign.replaceData(datos);
    aplicarFiltrosAgrupacion();
    return;
  }

  tableAsign = new Tabulator("#asiTable", {
    data: datos,
    height: calcularAlturaDisponible(260),
    layout: "fitColumns",
    columnMinWidth: 110,
    selectable: true,
    selectableRangeMode: "click",
    groupStartOpen: false,
    groupToggleElement: "header",
    columns: [
      {formatter:"rowSelection", title:"Sel", hozAlign:"center", width:60, headerSort:false,
       cellClick:(e, cell)=>cell.getRow().toggleSelect()},
      {title:"Mes", field:"MesLabel", width:120, headerSort:true},
      {title:"Proveedor", field:"Proveedor", headerSort:true},
      {title:"Comuna", field:"Comuna"},
      {title:"Centro", field:"Centro"},
      {title:"Área", field:"Área"},
      {title:"Tons", field:"Tons", hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Camiones", field:"Trucks", hozAlign:"right", headerHozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Fuente", field:"Fuente", width:120},
    ],
    rowSelectionChanged: ()=> actualizarResumenSel(),
    dataFiltered: (_, rows)=>{
      const visibles = rows.map(r=>r.getData());
      setKPIs(visibles);
    }
  });

  aplicarFiltrosAgrupacion();
  setKPIs(datos);
  actualizarResumenSel();
}

async function getOfertas(){
  const raw = await apiGet("/planificacion/ofertas");
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
  return arr.map(it=>{
    const base = it.fecha || it.fechaPlan || it.fch || it.mes || it.mesKey || "";
    return {
      Mes: monthKey(base),
      Semana: isoWeekKey(base),
      Proveedor: it.proveedorNombre || it.proveedor || "",
      Centro: it.centroCodigo || "",
      Área: it.areaCodigo || it.area || "",
      Comuna: it.comuna || it.centroComuna || "",
      Tons: Number(it.tons)||0,
      Fuente: it.fuente ? (it.fuente[0].toUpperCase()+it.fuente.slice(1)) : "Disponibilidad",
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

function calcularMesTotals(rows){
  const m=new Map();
  for(const r of rows){
    const k=r.Mes || "s/fecha";
    m.set(k, (m.get(k)||0) + (Number(r.Tons)||0));
  }
  return m;
}

export function initAsignacionUI(){
  buildToolbar();
}

export async function cargarAsignacion(){
  const [ofertas, asigMap] = await Promise.all([ getOfertas(), getAsignacionesMap() ]);
  estado.rows = ofertas;
  estado.asigMap = asigMap;
  estado.monthTotals = calcularMesTotals(ofertas);
  construirTabla(ofertas);
  actualizarSaldoMes();
}
