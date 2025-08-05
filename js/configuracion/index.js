import { renderCriteriosClasificacion } from './configuracion_criterios.js';
// Importa la tabla de proveedores directamente desde la carpeta correcta
import { initTablaProveedores } from './Proveedores/tabla.js';
// Cuando tengas listos los otros módulos, los agregas igual:
/// import { renderClientes } from './configuracion_clientes.js';
/// import { renderEmpresasTransporte } from './configuracion_transportes.js';

// Tabla de funciones por tab
const tabMap = {
  'tab-criterios': renderCriteriosClasificacion,
  'tab-proveedores': initTablaProveedores,
  // 'tab-clientes': renderClientes,
  // 'tab-transporte': renderEmpresasTransporte,
};

function loadTab(tabId) {
  document.querySelectorAll('.config-section').forEach(sec => sec.style.display = 'none');
  const sec = document.getElementById(tabId);
  if (sec) sec.style.display = 'block';
  if (tabMap[tabId]) tabMap[tabId]();
}

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tabs');
  M.Tabs.init(tabs);

  document.querySelectorAll('.tabs a').forEach(tab => {
    tab.addEventListener('click', function (e) {
      e.preventDefault();
      let id = this.getAttribute('href').replace('#', '');
      loadTab(id);
    });
  });

  // Mostrar por defecto la primera pestaña
  loadTab('tab-criterios');
});


