// /js/configuracion/index.js
import { renderCriteriosClasificacion } from './configuracion_criterios.js';
import { renderProveedoresMMPP } from './configuracion_proveedores.js';
import { renderClientes } from './configuracion_clientes.js';
import { renderEmpresasTransporte } from './configuracion_transportes.js';

// Mapeo de pestañas a renderizadores
const tabMap = {
  'tab-criterios': renderCriteriosClasificacion,
  'tab-proveedores': renderProveedoresMMPP,
  'tab-clientes': renderClientes,
  'tab-transportes': renderEmpresasTransporte,
};

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa pestañas (Materialize)
  const tabsElem = document.querySelector('.tabs');
  if (tabsElem) M.Tabs.init(tabsElem);

  // Renderiza la vista inicial
  loadTab('tab-criterios');

  // Maneja clicks en las pestañas
  document.querySelectorAll('.tab a').forEach(tabA => {
    tabA.addEventListener('click', e => {
      e.preventDefault();
      const tabId = tabA.getAttribute('href').replace('#', '');
      loadTab(tabId);
    });
  });
});

function loadTab(tabId) {
  // Llama el renderizador de la pestaña, si existe
  if (tabMap[tabId]) tabMap[tabId]();
}
