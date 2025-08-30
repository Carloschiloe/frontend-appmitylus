// principal.js
import * as api from './api.js';
import * as estado from './estado.js';
import * as inventario from './inventario.js';
import * as asignacion from './asignacion.js';
import * as programaSemanal from './programa_semanal.js';

document.addEventListener('DOMContentLoaded', async () => {
  M.Tabs.init(document.querySelectorAll('.tabs'));
  M.FormSelect.init(document.querySelectorAll('select'));
  try{ await estado.cargarTodo(api); }
  catch(e){ console.error(e); M.toast({html:'No se pudo cargar datos iniciales', classes:'red'}); }
  inventario.montar();
  asignacion.montar();
  programaSemanal.montar();
  window.__api = api; window.__estado = estado;
});
