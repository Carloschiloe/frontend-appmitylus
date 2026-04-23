/**
 * js/dashboard/events.js
 * Registro de manejadores de eventos para el Dashboard.
 */

import { state } from './state.js';
import { ui } from './ui.js';
import { renderBiomasaKpis, renderAll } from './render.js';
import { fetchAllDashboardData } from './api.js';

export function bindEvents() {
  // Filtros Globales
  ui.fResp?.addEventListener('change', () => {
    state.filters.responsable = ui.fResp.value;
    renderAll();
  });

  ui.fComuna?.addEventListener('change', () => {
    state.filters.comuna = ui.fComuna.value;
    renderAll();
  });

  ui.fPeriodo?.addEventListener('change', () => {
    state.filters.periodoDias = Number(ui.fPeriodo.value);
    renderAll(); // En el original esto disparaba renderAll
  });

  ui.fTexto?.addEventListener('input', () => {
    state.filters.texto = ui.fTexto.value.trim();
    renderAll();
  });

  ui.fClear?.addEventListener('click', () => {
    state.filters = { responsable: '', comuna: '', periodoDias: 30, texto: '' };
    if (ui.fResp) ui.fResp.value = '';
    if (ui.fComuna) ui.fComuna.value = '';
    if (ui.fPeriodo) ui.fPeriodo.value = '30';
    if (ui.fTexto) ui.fTexto.value = '';
    renderAll();
  });

  // Controles de Biomasa
  ui.bioScaleWeek?.addEventListener('click', () => { state.bio.scale = 'week'; state.bio.offset = 0; renderBiomasaKpis(); });
  ui.bioScaleMonth?.addEventListener('click', () => { state.bio.scale = 'month'; state.bio.offset = 0; renderBiomasaKpis(); });
  ui.bioScaleYear?.addEventListener('click', () => { state.bio.scale = 'year'; state.bio.offset = 0; renderBiomasaKpis(); });

  ui.bioPrev?.addEventListener('click', () => { state.bio.offset -= 1; renderBiomasaKpis(); });
  ui.bioNext?.addEventListener('click', () => { state.bio.offset += 1; renderBiomasaKpis(); });

  // Sidebar y Navegación
  refreshActiveNav();
  window.addEventListener('hashchange', refreshActiveNav);

  ui.nav?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle-group]');
    if (btn) {
      const group = btn.closest('.menu-group');
      if (!group) return;
      if (group.dataset.group === 'config') return; 
      const willOpen = !group.classList.contains('is-open');
      ui.nav.querySelectorAll('.menu-group.is-open').forEach(g => {
        if (g !== group && g.dataset.group !== 'config') g.classList.remove('is-open');
      });
      group.classList.toggle('is-open', willOpen);
    }
  });

  // Global Reset al hacer clic fuera del área de biomasa
  document.addEventListener('click', (e) => {
    const insideBio = ui.bioSection?.contains(e.target);
    if (!insideBio) {
      state.bio.focusStatus = null;
      renderBiomasaKpis();
    }
  });
}

function refreshActiveNav() {
  if (!ui.nav) return;
  const href = window.location.href;
  ui.nav.querySelectorAll('.submenu a').forEach(a => {
    const h = a.getAttribute('href');
    const active = h && (h.startsWith('#') ? (window.location.hash === h) : href.includes(h));
    a.classList.toggle('is-active-link', active);
    if (active) a.closest('.menu-group')?.classList.add('is-open', 'has-active-link');
  });
}
