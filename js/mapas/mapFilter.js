// js/mapas/mapFilter.js

import { Estado } from '../core/estado.js';
import { focusCentroInMap } from './mapDraw.js';

let filtroSidebar = '';
let selectedCentroIdx = null;

/**
 * Inicializa el filtro y la lista flotante sobre el mapa.
 * Busca en proveedor o comuna y centra el mapa al hacer clic.
 */
export function initSidebarFiltro() {
  console.log('[mapFilter] initSidebarFiltro');
  const filtroInput    = document.getElementById('filtroSidebar');
  const listaSidebar   = document.getElementById('listaCentrosSidebar');
  const toggleBtn      = document.getElementById('toggleSidebar');
  const icon           = document.getElementById('toggleSidebarIcon');
  const sidebar        = document.getElementById('sidebarCentros');

  if (!filtroInput || !listaSidebar || !toggleBtn || !icon || !sidebar) {
    console.warn('[mapFilter] elementos del sidebar no encontrados');
    return;
  }

  // Al escribir en el input, actualiza la lista
  filtroInput.addEventListener('input', () => {
    filtroSidebar = filtroInput.value.trim().toLowerCase();
    renderListaSidebar();
  });

  // Toggle para colapsar/expandir sidebar
  toggleBtn.onclick = () => {
    sidebar.classList.toggle('minimized');
    if (sidebar.classList.contains('minimized')) {
      icon.textContent = 'chevron_right';
    } else {
      icon.textContent = 'chevron_left';
    }
    // Redibuja el mapa tras la animación
    setTimeout(() => {
      if (Estado.map && Estado.map.invalidateSize) {
        Estado.map.invalidateSize();
      }
    }, 350);
  };

  // Primer render
  renderListaSidebar();
}

/**
 * Construye y muestra el listado de hasta 10 centros filtrados.
 */
function renderListaSidebar() {
  const listaSidebar = document.getElementById('listaCentrosSidebar');
  if (!listaSidebar) return;

  let items = Array.isArray(Estado.centros) ? Estado.centros.slice() : [];
  if (filtroSidebar) {
    items = items.filter(c => {
      const prov  = (c.proveedor || '').toLowerCase();
      const comuna = (c.comuna   || '').toLowerCase();
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

  // Click y Enter para centrar el centro en el mapa
  Array.from(listaSidebar.querySelectorAll('li')).forEach(li => {
    li.onclick = () => {
      selectedCentroIdx = +li.dataset.idx;
      focusCentroInMap(selectedCentroIdx);
      renderListaSidebar();
    };
    li.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        selectedCentroIdx = +li.dataset.idx;
        focusCentroInMap(selectedCentroIdx);
        renderListaSidebar();
      }
    };
  });
}
