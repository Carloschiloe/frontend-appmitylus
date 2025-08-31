// js/abastecimiento/asignacion/principal.js
import { cargarInventario, getTablaInventario } from "./inventario.js";
import { initAsignacionUI, cargarAsignacion } from "./asignacion.js";
import { initProgramaSemanalUI, getTablaPrograma } from "./programa_semanal.js";
import { calcularAlturaDisponible } from "./utilidades.js";

function redimensionar() {
  const h = calcularAlturaDisponible(260);
  getTablaInventario()?.setHeight(h);
  getTablaInventario()?.redraw(true);
  getTablaPrograma()?.setHeight(h);
  getTablaPrograma()?.redraw(true);
}

document.addEventListener("DOMContentLoaded", async () => {
  // Materialize
  M.Tabs.init(document.querySelectorAll(".tabs"));
  M.Modal.init(document.querySelectorAll(".modal"));
  M.FormSelect.init(document.querySelectorAll("select"));

  // UIs
  await cargarInventario();
  initAsignacionUI();
  await cargarAsignacion();
  initProgramaSemanalUI();

  // Resize
  window.addEventListener("resize", redimensionar);

  // Cuando cambie la asignación, refresca inventario
  document.addEventListener("asignacion:cambio", async () => {
    await cargarInventario();
  });
});


