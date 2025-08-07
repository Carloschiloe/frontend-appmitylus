// js/mapas/mapFilter.js
// Filtro flotante sobre el mapa

let centrosDataGlobal = [];
let filtroSidebar      = '';

export function initMapFilter() {
  console.log('[mapFilter] initMapFilter()');
  const input = document.getElementById('filtroSidebar');
  if (!input) {
    console.warn('[mapFilter] no se encontró #filtroSidebar');
    return;
  }
  input.addEventListener('input', () => {
    filtroSidebar = input.value.trim().toLowerCase();
    console.log('[mapFilter] filtroSidebar =', filtroSidebar);
    renderMapFilterList();
  });
  renderMapFilterList();
}

export function setFilterData(centros) {
  console.log('[mapFilter] setFilterData →', centros.length, 'centros');
  centrosDataGlobal = centros;
  renderMapFilterList();
}

function renderMapFilterList() {
  console.log('[mapFilter] renderMapFilterList()');
  const overlay = document.getElementById('mapFilter');
  if (!overlay) {
    console.warn('[mapFilter] no existe #mapFilter');
    return;
  }

  let ul = overlay.querySelector('ul.filter-list');
  if (!ul) {
    ul = document.createElement('ul');
    ul.className = 'filter-list';
    overlay.appendChild(ul);
    console.log('[mapFilter] creado <ul.filter-list>');
  }

  let mostrados = centrosDataGlobal;
  if (filtroSidebar) {
    mostrados = centrosDataGlobal.filter(
      c => (c.proveedor||'').toLowerCase().includes(filtroSidebar) ||
           (c.comuna   ||'').toLowerCase().includes(filtroSidebar)
    );
  }
  mostrados = mostrados.slice(0, 10);
  console.log('[mapFilter] items a mostrar =', mostrados.length);

  if (mostrados.length === 0) {
    ul.innerHTML = `<li style="color:#888;">Sin coincidencias</li>`;
  } else {
    ul.innerHTML = mostrados.map(c => {
      const idx = centrosDataGlobal.indexOf(c);
      return `<li data-idx="${idx}">
        <b>${c.comuna||'-'}</b><br>
        <small>${c.proveedor||''}</small>
      </li>`;
    }).join('');
    ul.querySelectorAll('li[data-idx]').forEach(li => {
      li.onclick = () => {
        const idx = +li.dataset.idx;
        console.log('[mapFilter] click idx=', idx);
        import('./mapDraw.js').then(m => m.focusCentroInMap(idx));
      };
    });
  }
}
