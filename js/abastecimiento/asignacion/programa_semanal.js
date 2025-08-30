// js/abastecimiento/asignacion/programa_semanal.js
import {fmt, calcAlturaDisponible} from "./utilidades.js";

let table = null;
export function getTablaPrograma(){ return table; }

function semanaISOActual(){
  // devuelve "2025-W36" etc (input type week)
  const d = new Date();
  const jan4 = new Date(d.getFullYear(),0,4);
  const day = (d - jan4 + ((jan4.getDay()+6)%7)*86400000)/86400000;
  const week = 1 + Math.floor(day/7);
  return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
}

function buildToolbar(){
  const el = document.getElementById("progToolbar");
  el.innerHTML = `
    <div class="input-field">
      <input id="prog_week" type="week" value="${semanaISOActual()}">
      <label class="active" for="prog_week">Semana (ISO)</label>
    </div>
    <div class="input-field">
      <select id="prog_unit">
        <option value="tons" selected>Toneladas</option>
        <option value="trucks">Camiones (10 t)</option>
      </select>
      <label>Unidad</label>
    </div>
    <div class="input-field">
      <select id="prog_tipo">
        <option value="ALL" selected>Todos</option>
        <option value="NORMAL">Normal</option>
        <option value="BAP">BAP</option>
      </select>
      <label>Tipo MMPP</label>
    </div>
    <div class="right-actions" style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
      <a class="btn teal" id="prog_refresh"><i class="material-icons left">refresh</i>Actualizar</a>
      <a class="btn grey darken-2" id="prog_csv"><i class="material-icons left">download</i>CSV</a>
      <a class="btn grey darken-2" id="prog_xlsx"><i class="material-icons left">file_download</i>XLSX</a>
    </div>
  `;
  M.FormSelect.init(el.querySelectorAll("select"));

  document.getElementById("prog_refresh").addEventListener("click", ()=>render());
  document.getElementById("prog_csv").addEventListener("click", ()=> table?.download("csv","programa_semanal.csv"));
  document.getElementById("prog_xlsx").addEventListener("click", ()=> table?.download("xlsx","programa_semanal.xlsx",{sheetName:"Programa"}));
}

function buildTable(){
  table = new Tabulator("#progTable", {
    data: [],
    height: calcAlturaDisponible(260),
    layout: "fitColumns",
    columnMinWidth: 110,
    columns: [
      {title:"Proveedor", field:"Proveedor", width:220},
      {title:"Lun", field:"L", hozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Mar", field:"M",  hozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Mié", field:"X",  hozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Jue", field:"J",  hozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Vie", field:"V",  hozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Sáb", field:"S",  hozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Dom", field:"D",  hozAlign:"right", formatter:(c)=>fmt(c.getValue())},
      {title:"Total", field:"Total", hozAlign:"right", formatter:(c)=>fmt(c.getValue())},
    ],
  });
}

function ejemploDatos(){
  // datos mock para que puedas ver el layout (reemplázalo cuando tengas backend)
  return [
    {Proveedor:"(vacío)", L:0,M:0,X:0,J:0,V:0,S:0,D:0},
    {Proveedor:"Proveedor A", L:100,M:0,X:0,J:0,V:100,S:0,D:0},
    {Proveedor:"Proveedor B", L:0,M:50,X:0,J:0,V:0,S:0,D:0},
  ].map(r=>({...r, Total:(r.L+r.M+r.X+r.J+r.V+r.S+r.D)}));
}

function render(){
  const unit = document.getElementById("prog_unit").value;
  let data = ejemploDatos();
  const f = unit==='trucks' ? 1/10 : 1;
  data = data.map(r=>({
    ...r,
    L:r.L*f, M:r.M*f, X:r.X*f, J:r.J*f, V:r.V*f, S:r.S*f, D:r.D*f, Total:r.Total*f
  }));
  if(!table) buildTable();
  table.setData(data);
  document.getElementById("progNote").textContent = `Unidad actual: ${unit==='trucks'?'Camiones (10 t)':'Toneladas'}.`;
}

export function initProgramaSemanalUI(){
  buildToolbar();
  buildTable();
  render();
}
