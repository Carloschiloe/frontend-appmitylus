// js/mapas/mapFilter.js

let centrosDataGlobal = [];
let filtroSidebar = '';

/**
 * Inicializa el input #filtroSidebar para filtrar centros.
 */
export function initMapFilter() {
  const input = document.getElementById('filtroSidebar');
  if (!input) {
    console.warn('[mapFilter] #filtroSidebar no encontrado');
    return;
  }
  input.addEventListener('input', () => {
    filtroSidebar = input.value.trim().toLowerCase();
    renderMapFilterList();
  });
  // render inicial
  renderMapFilterList();
}

/**
 * Actualiza los datos de centros a filtrar.
 * @param {Array<{comuna:string,proveedor:string}>} centros
 */
export function setFilterData(centros) {
  centrosDataGlobal = centros;
  renderMapFilterList();
}

function renderMapFilterList() {
  const overlay = document.getElementById('mapFilter');
  if (!overlay) return;

  // crea <ul> si no existe
  let ul = overlay.querySelector('ul.filter-list');
  if (!ul) {
    ul = document.createElement('ul');
    ul.className = 'filter-list';
    overlay.appendChild(ul);
  }

  // filtrar
  let mostrados = centrosDataGlobal;
  if (filtroSidebar) {
    mostrados = centrosDataGlobal.filter(c =>
      (c.proveedor || '').toLowerCase().includes(filtroSidebar) ||
      (c.comuna    || '').toLowerCase().includes(filtroSidebar)
    );
  }
  mostrados = mostrados.slice(0, 10);

  // renderizar
  if (mostrados.length === 0) {
    ul.innerHTML = `<li style="color:#888;">Sin coincidencias</li>`;
  } else {
    ul.innerHTML = mostrados.map(c => {
      const idx = centrosDataGlobal.indexOf(c);
      return `
        <li data-idx="${idx}">
          <b>${c.comuna||'-'}</b><br>
          <small>${c.proveedor||''}</small>
        </li>
      `;
    }).join('');
    // click para centrar
    ul.querySelectorAll('li[data-idx]').forEach(li => {
      li.onclick = () => {
        const idx = +li.dataset.idx;
        import('./mapDraw.js').then(m => m.focusCentroInMap(idx));
      };
    });
  }
}
