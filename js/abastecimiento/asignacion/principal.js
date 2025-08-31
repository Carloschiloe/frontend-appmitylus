// js/abastecimiento/asignacion/principal.js
import * as api from './api.js';
import * as estado from './estado.js';
import * as inventario from './inventario.js';
import * as asignacion from './asignacion.js';
import * as programaSemanal from './programa_semanal.js';

function initMaterialize() {
  // Tabs y Modales
  M.Tabs.init(document.querySelectorAll('.tabs'));
  M.Modal.init(document.querySelectorAll('.modal'));

  // MUY IMPORTANTE: dibujar dropdowns de <select> en <body> para que
  // no queden ocultos detrás de Tabulator u otros contenedores.
  M.FormSelect.init(document.querySelectorAll('select'), {
    dropdownOptions: {
      container: document.body,
      coverTrigger: false,
      constrainWidth: false,
      closeOnClick: true,
    },
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initMaterialize();

  try {
    await estado.cargarTodo(api);
  } catch (e) {
    console.error(e);
    M.toast({ html: 'No se pudo cargar datos iniciales', classes: 'red' });
  }

  // Montar vistas
  inventario.montar();
  asignacion.montar();
  programaSemanal.montar();

  // Re-inicializa selects por si los módulos crearon nuevos dinámicamente
  M.FormSelect.init(document.querySelectorAll('select'), {
    dropdownOptions: {
      container: document.body,
      coverTrigger: false,
      constrainWidth: false,
    },
  });

  // Exponer utilidades (opcional)
  window.__api = api;
  window.__estado = estado;
});

// Hook opcional: si algún módulo agrega selects más tarde, dispara este evento
document.addEventListener('reinit:selects', () => {
  M.FormSelect.init(document.querySelectorAll('select'), {
    dropdownOptions: {
      container: document.body,
      coverTrigger: false,
      constrainWidth: false,
    },
  });
});

