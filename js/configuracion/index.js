import { renderCriteriosClasificacion } from './configuracion_criterios.js';
import { initTablaProveedores } from './proveedores/tabla.js';
import { renderClientes } from './configuracion_clientes.js';
import { renderEmpresasTransporte } from './configuracion_transportes.js';

const tabMap = {
  'tab-criterios': renderCriteriosClasificacion,
  'tab-proveedores': initTablaProveedores,
  'tab-clientes': renderClientes,
  'tab-transporte': renderEmpresasTransporte,
};

const initializedTabs = new Set();

function loadTab(tabId) {
  document.querySelectorAll('.config-section').forEach((sec) => {
    sec.style.display = 'none';
  });

  const sec = document.getElementById(tabId);
  if (sec) sec.style.display = 'block';

  const renderTab = tabMap[tabId];
  if (renderTab && !initializedTabs.has(tabId)) {
    renderTab();
    initializedTabs.add(tabId);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tabs');
  M.Tabs.init(tabs);

  document.querySelectorAll('.tabs a').forEach((tab) => {
    tab.addEventListener('click', function onClickTab(e) {
      e.preventDefault();
      const id = this.getAttribute('href').replace('#', '');
      loadTab(id);
    });
  });

  loadTab('tab-criterios');
});
