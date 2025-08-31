// js/abastecimiento/asignacion/principal.js
import {cargarInventario, getTablaInventario} from "./inventario.js";
import {initAsignacionUI, cargarAsignacion} from "./asignacion.js";
import {initProgramaSemanalUI, getTablaPrograma} from "./programa_semanal.js";
import {calcAlturaDisponible} from "./utilidades.js";

function redimensionar(){
  const h = calcAlturaDisponible(260);
  getTablaInventario()?.setHeight(h);
  getTablaInventario()?.redraw(true);
  getTablaPrograma()?.setHeight(h);
  getTablaPrograma()?.redraw(true);
  // la tabla de asignación la construye el módulo en su contenedor y usa el mismo alto
  // si quieres: window.tableAsign?.setHeight(h); window.tableAsign?.redraw(true);
}

document.addEventListener("DOMContentLoaded", async ()=>{
  // Materialize
  M.Tabs.init(document.querySelectorAll(".tabs"));
  M.Modal.init(document.querySelectorAll(".modal"));
  M.FormSelect.init(document.querySelectorAll("select"));

  // UIs
  await cargarInventario();
  initAsignacionUI();
  await cargarAsignacion();
  initProgramaSemanalUI();

  // resize
  window.addEventListener("resize", redimensionar);

  // cuando cambie la asignación, refresca inventario
  document.addEventListener("asignacion:cambio", async ()=> {
    await cargarInventario();
  });
});


