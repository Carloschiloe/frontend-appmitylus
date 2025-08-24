// /js/abastecimiento/index.js
// Orquestador de pestañas (Contactos / Visitas)

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa Tabs de Materialize
  const tabsEls = document.querySelectorAll('.tabs');
  let tabsInstance = null;
  if (tabsEls && tabsEls.length) {
    try { tabsInstance = M.Tabs.init(tabsEls, {}); } catch (_) {}
    tabsInstance = Array.isArray(tabsInstance) ? tabsInstance[0] : tabsInstance;
  }

  const loadContactos = () =>
    import('./contactos/index.js').then(m => m.initContactosTab());
  const loadVisitas = (forceReload=false) =>
    import('./visitas/index.js').then(m => m.initVisitasTab(forceReload));

  // Normaliza hash y selecciona pestaña visible
  const currentHash = (location.hash === '#tab-visitas') ? '#tab-visitas' : '#tab-contactos';
  if (tabsInstance && tabsInstance.select) {
    tabsInstance.select(currentHash.replace('#', '')); // 'tab-visitas' | 'tab-contactos'
  }

  // Carga inicial (lazy)
  if (currentHash === '#tab-visitas') loadVisitas();
  else loadContactos();

  // Click en tabs (lazy, con guard interno del submódulo)
  document.querySelectorAll('.tabs a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('href');
      if (target === '#tab-contactos') loadContactos();
      else if (target === '#tab-visitas') loadVisitas();
    });
  });

  // Soporte back/forward (hashchange)
  window.addEventListener('hashchange', () => {
    const h = (location.hash === '#tab-visitas') ? '#tab-visitas' : '#tab-contactos';
    if (tabsInstance && tabsInstance.select) tabsInstance.select(h.replace('#',''));
    if (h === '#tab-visitas') loadVisitas(); else loadContactos();
  });

  // Evento cruzado: actualizar Visitas al crear una
  window.addEventListener('visita:created', () => loadVisitas(true));
});
