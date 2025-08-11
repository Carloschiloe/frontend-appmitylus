// /js/abastecimiento/index.js

import { initContactosTab } from './contactos/index.js';
import { initVisitasTab }   from './visitas/index.js';

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa las tabs de Materialize (si existen)
  const tabsEls = document.querySelectorAll('.tabs');
  if (tabsEls && tabsEls.length) {
    try { M.Tabs.init(tabsEls, {}); } catch (_) {}
  }

  // Carga inicial según hash (por defecto Contactos)
  const initial = (location.hash || '#tab-contactos');
  if (initial === '#tab-visitas') {
    initVisitasTab();
  } else {
    initContactosTab();
  }

  // Lazy init por pestaña
  const tabLinks = document.querySelectorAll('.tabs a[href^="#"]');
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('href');
      if (target === '#tab-contactos') {
        initContactosTab();       // tiene guard interno
      } else if (target === '#tab-visitas') {
        initVisitasTab();         // tiene guard interno
      }
    });
  });

  // Si se crea una visita desde Contactos, refresca la pestaña Visitas si ya existe
  window.addEventListener('visita:created', () => {
    initVisitasTab(true /* forceReload */);
  });
});


