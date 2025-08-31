// js/abastecimiento/asignacion/programa_semanal.js
import { calcularAlturaDisponible } from "./utilidades.js";

let tableProg = null;
export function getTablaPrograma(){ return tableProg; }

export function initProgramaSemanalUI(){
  const t = document.getElementById("progToolbar");
  if(!t) return;
  t.innerHTML = `
    <div class="input-field">
      <input id="progWeek" type="week">
      <label class="active" for="progWeek">Semana (ISO)</label>
    </div>
    <div class="input-field">
      <select id="progUnidad">
        <option value="tons" selected>Toneladas</option>
        <option value="trucks">Camiones (10 t)</option>
      </select>
      <label>Unidad</label>
    </div>
    <div class="input-field">
      <select id="progTipo">
        <option value="TODOS" selected>Todos</option>
        <option value="BAP">BAP</option>
        <option value="NORMAL">Normal</option>
      </select>
      <label>Tipo MMPP</label>
    </div>
    <div class="right-actions" style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
      <a class="btn teal" id="progRefrescar"><i class="material-icons left">refresh</i>Actualizar</a>
      <a class="btn grey darken-2" id="progCSV"><i class="material-icons left">download</i>CSV</a>
      <a class="btn grey darken-2" id="progXLSX"><i class="material-icons left">file_download</i>XLSX</a>
    </div>
  `;
  M.FormSelect.init(t.querySelectorAll("select"));

  // tabla vacía por ahora (estructura)
  if(!tableProg){
    tableProg = new Tabulator("#progTable", {
      data: [],
      height: calcularAlturaDisponible(260),
      layout: "fitColumns",
      columns: [
        {title:"Proveedor", field:"Proveedor", width:220, frozen:true},
        {title:"Lun", field:"L", hozAlign:"right"},
        {title:"Mar", field:"M", hozAlign:"right"},
        {title:"Mié", field:"X", hozAlign:"right"},
        {title:"Jue", field:"J", hozAlign:"right"},
        {title:"Vie", field:"V", hozAlign:"right"},
        {title:"Sáb", field:"S", hozAlign:"right"},
        {title:"Dom", field:"D", hozAlign:"right"},
        {title:"Total", field:"Total", hozAlign:"right"},
      ],
    });
  }

  document.getElementById("progRefrescar").addEventListener("click", ()=> tableProg?.redraw(true));
  document.getElementById("progCSV").addEventListener("click", ()=> tableProg?.download("csv","programa_semanal.csv"));
  document.getElementById("progXLSX").addEventListener("click", ()=> tableProg?.download("xlsx","programa_semanal.xlsx",{sheetName:"Programa"}));
}
