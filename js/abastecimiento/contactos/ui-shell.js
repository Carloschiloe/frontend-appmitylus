// /js/abastecimiento/contactos/ui-shell.js

export function createUiShellModule({ activateTab, applyConsultaPreset }) {
  function normalizeHash(hash) {
    const h = String(hash || '').toLowerCase();
    if (!h || h === '#') return '#tab-gestion';
    if (h === '#contactos' || h === '#tab-contactos') return '#tab-directorio';
    if (h === '#visitas' || h === '#tab-visitas') return '#tab-interacciones';
    if (h === '#personas' || h === '#tab-personas') return '#tab-directorio';
    if (h === '#calendario' || h === '#tab-calendario') return '#tab-calendario';
    // Legacy: "consulta/buscar" (pestaña removida)
    if (h === '#tab-consulta' || h === '#tab-buscar' || h === '#buscar') return '#tab-gestion';
    if (h === '#muestreos') return '#tab-muestreos';
    return h;
  }

  function syncSideNavActive() {
    const nav = document.getElementById('sideNav');
    if (!nav) return;

    const activeHash = normalizeHash(location.hash || '#tab-gestion');
    nav.querySelectorAll('.menu-group').forEach((g) => {
      g.classList.remove('has-active-link');
      // Mantener Configuración siempre visible (submenu "Maestros")
      if (g.dataset.group !== 'config') g.classList.remove('is-open');
    });
    nav.querySelectorAll('a[data-tab-link]').forEach((a) => a.classList.remove('is-active-link'));

    let found = false;
    nav.querySelectorAll('a[data-tab-link]').forEach((a) => {
      const href = normalizeHash(a.getAttribute('href'));
      if (href === activeHash) {
        a.classList.add('is-active-link');
        const group = a.closest('.menu-group');
        group?.classList.add('has-active-link', 'is-open');
        found = true;
      }
    });

    if (!found) {
      const g = nav.querySelector('.menu-group[data-group="contactos"]');
      g?.classList.add('is-open');
    }

    // Configuración siempre abierto para que "Maestros" no desaparezca.
    nav.querySelector('.menu-group[data-group="config"]')?.classList.add('is-open');
  }

  function bindSideNav() {
    const nav = document.getElementById('sideNav');
    if (!nav || nav.dataset.bound === '1') return;
    nav.dataset.bound = '1';

    nav.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle-group]');
      if (toggle) {
        const group = toggle.closest('.menu-group');
        if (!group) return;
        if (group.dataset.group === 'config') {
          group.classList.add('is-open');
          return;
        }
        const willOpen = !group.classList.contains('is-open');
        nav.querySelectorAll('.menu-group.is-open').forEach((g) => {
          if (g !== group && g.dataset.group !== 'config') g.classList.remove('is-open');
        });
        group.classList.toggle('is-open', willOpen);
        return;
      }

      const link = e.target.closest('a[data-tab-link]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      activateTab(href);
      syncSideNavActive();
    });

    window.addEventListener('hashchange', syncSideNavActive, { passive: true });
    syncSideNavActive();

    const saveSideBtn = document.getElementById('btnMuestreoSaveSide');
    if (saveSideBtn && saveSideBtn.dataset.bound !== '1') {
      saveSideBtn.dataset.bound = '1';
      saveSideBtn.addEventListener('click', () => {
        document.getElementById('btnMuestreoSave')?.click();
      });
    }
  }

  return {
    normalizeHash,
    bindSideNav
  };
}
