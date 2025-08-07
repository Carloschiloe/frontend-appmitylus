// js/mapas/mapFilter.js

import { Estado } from '../core/estado.js';
import { drawCentrosInMap } from './mapDraw.js';

let filtroSidebar = '';
let selectedCentroIdx = null;

export function initSidebarFiltro() {
  const filtroInput    = document.getElementById('filtroSidebar');
  const listaSidebar   = document.getElementById('listaCentrosSidebar');
  const toggleBtn      = document.getElementById('toggleSidebar');
  const icon           = document.getElementById('toggleSidebarIcon');
  const sidebar        = document.getElementById('sidebarCentros');
  if (!filtroInput || !listaSidebar || !toggleBtn || !icon || !sidebar) {
    console.warn('[mapFilter] elementos del sidebar no encontrados');
    return;
  }

  filtroInput.addEventListener('input', () => {
    filtroSidebar = filtroInput.value.trim().toLowerCase();
    renderListaSidebar();
  });
  toggleBtn.onclick = () => {
    sidebar.classList.toggle('minimized');
    icon.textContent = sidebar.classList.contains('minimized') ? 'chevron_right' : 'chevron_left';
    setTimeout(() => Estado.map.invalidateSize(), 350);
  };
  renderListaSidebar();
}

function renderListaSidebar() {
  const listaSidebar = document.getElementById('listaCentrosSidebar');
  if (!listaSidebar) return;
  let items = Array.isArray(Estado.centros) ? Estado.centros.slice() : [];
  if (filtroSidebar) {
    items = items.filter(c => {
      const prov = (c.proveedor || '').toLowerCase();
      const comuna = (c.comuna || '').toLowerCase();
      return prov.includes(filtroSidebar) || comuna.includes(filtroSidebar);
    });
  }
  items = items.slice(0, 10);

  if (items.length === 0) {
    listaSidebar.innerHTML = `<li style="color:#888;">Sin coincidencias</li>`;
    return;
  }
  listaSidebar.innerHTML = items.map(c => {
    const idx = Estado.centros.indexOf(c);
    const sel = idx === selectedCentroIdx ? 'selected' : '';
    return `
      <li data-idx="${idx}" class="${sel}" tabindex="0">
        <b>${c.proveedor || '-'}</b><br/>
        <span class="proveedor">${c.comuna || ''}</span>
      </li>
    `.trim();
  }).join('');
  Array.from(listaSidebar.querySelectorAll('li')).forEach(li => {
    li.onclick = () => {
      selectedCentroIdx = +li.dataset.idx;
      drawCentrosInMap(Estado.centros, i => selectedCentroIdx = i);
      renderListaSidebar();
    };
    li.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        selectedCentroIdx = +li.dataset.idx;
        drawCentrosInMap(Estado.centros, i => selectedCentroIdx = i);
        renderListaSidebar();
      }
    };
  });
}
