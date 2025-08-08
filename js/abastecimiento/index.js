// /js/abastecimiento/index.js

// Importa módulos de las pestañas (por ahora solo contactos, después agregas visitas, gestión, etc.)
import { initContactosTab } from './contactos/contactos.js';
// Si luego tienes: import { initVisitasTab } from './visitas/visitas.js';

document.addEventListener('DOMContentLoaded', function () {
  // Inicializa las tabs de Materialize
  const tabsEl = document.querySelectorAll('.tabs');
  M.Tabs.init(tabsEl, {});

  // Manejador de cambio de pestañas
  const tabLinks = document.querySelectorAll('.tabs a');
  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      // Opcional: puedes cargar el módulo solo al entrar por primera vez
      if (link.getAttribute('href') === '#tab-contactos') {
        initContactosTab();
      }
      // Si después tienes más pestañas:
      // else if (link.getAttribute('href') === '#tab-visitas') { initVisitasTab(); }
      // etc.
    });
  });

  // Carga la pestaña principal al inicio
  initContactosTab();
});
