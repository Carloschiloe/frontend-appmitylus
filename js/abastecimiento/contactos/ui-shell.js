// /js/abastecimiento/contactos/ui-shell.js

export function createUiShellModule({ activateTab, applyConsultaPreset }) {
  function normalizeHash(hash) {
    const h = String(hash || '').toLowerCase();
    if (!h || h === '#') return '#tab-gestion';
    if (h === '#contactos') return '#tab-contactos';
    if (h === '#visitas') return '#tab-visitas';
    if (h === '#personas') return '#tab-personas';
    if (h === '#muestreos') return '#tab-muestreos';
    if (h === '#tab-contactos' || h === '#tab-visitas' || h === '#tab-personas' || h === '#tab-muestreos' || h === '#tab-interacciones' || h === '#tab-resumen') {
      return '#tab-consulta';
    }
    return h;
  }

  function syncSideNavActive() {
    const nav = document.getElementById('sideNav');
    if (!nav) return;

    const activeHash = normalizeHash(location.hash || '#tab-gestion');
    nav.querySelectorAll('.menu-group').forEach((g) => g.classList.remove('has-active-link'));
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
      const g = nav.querySelector('.menu-group[data-group="gestion"]');
      g?.classList.add('is-open');
    }
  }

  function bindSideNav() {
    const nav = document.getElementById('sideNav');
    if (!nav || nav.dataset.bound === '1') return;
    nav.dataset.bound = '1';

    nav.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle-group]');
      if (toggle) {
        toggle.closest('.menu-group')?.classList.toggle('is-open');
        return;
      }

      const link = e.target.closest('a[data-tab-link]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      activateTab(href);
      location.hash = href;
      syncSideNavActive();
      applyConsultaPreset(href, '').catch(() => {});
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
