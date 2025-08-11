// /js/abastecimiento/index.js

// Importa el orquestador de la pestaña "Contactos"
import { initContactosTab } from './contactos/index.js';
// (Más adelante)
// import { initVisitasTab } from './visitas/index.js';

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa las tabs de Materialize (si existen en la página)
  const tabsEl = document.querySelectorAll('.tabs');
  if (tabsEl && tabsEl.length) {
    M.Tabs.init(tabsEl, {});
  }

  // Carga la pestaña principal al inicio
  initContactosTab(); // tiene guard interno para evitar re-init

  // Manejador de cambio de pestañas
  const tabLinks = document.querySelectorAll('.tabs a[href^="#"]');
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('href');
      if (target === '#tab-contactos') {
        initContactosTab(); // seguro: no se re-inicializa por el guard
      }
      // Ejemplo futuro:
      // else if (target === '#tab-visitas') { initVisitasTab(); }
    });
  });
});
