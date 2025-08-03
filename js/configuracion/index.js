// /js/configuracion/index.js
import { renderCriteriosClasificacion } from './configuracion_criterios.js';
import { renderProveedoresMMPP } from './configuracion_proveedores.js';
import { renderClientes } from './configuracion_clientes.js';
import { renderEmpresasTransporte } from './configuracion_transportes.js';

// Mapeo de IDs de pestañas a sus funciones de renderizado
const tabMap = {
  'tab-criterios': renderCriteriosClasificacion,
  'tab-proveedores': renderProveedoresMMPP,
  'tab-clientes': renderClientes,
  'tab-transporte': renderEmpresasTransporte,
};

// Función para mostrar la pestaña y renderizar contenido
function loadTab(tabId) {
  document.querySelectorAll('.config-section').forEach(sec => sec.style.display = 'none');
  const sec = document.getElementById(tabId);
  if (sec) sec.style.display = '';
  if (tabMap[tabId]) tabMap[tabId]();
}

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa tabs de Materialize
  const tabsElem = document.querySelector('.tabs');
  if (tabsElem) M.Tabs.init(tabsElem);

  // Eventos de los tabs
  document.querySelectorAll('.tab a').forEach(tabA => {
    tabA.addEventListener('click', e => {
      e.preventDefault();
      const tabId = tabA.getAttribute('href').replace('#', '');
      loadTab(tabId);
    });
  });

  // Carga el tab inicial
  if (window.location.hash && document.getElementById(window.location.hash.replace('#', ''))) {
    loadTab(window.location.hash.replace('#', ''));
  } else {
    loadTab('tab-criterios');
  }
});
