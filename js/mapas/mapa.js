// mapa.js - gestión completa del mapa y sidebar de centros (sidebar minimalista, filtro extendido + colapsable)

let map;
let puntosIngresoGroup;
let centrosGroup;
let currentPoly = null;
let centroPolys = {};
let windowCentrosDebug = [];

const LOG = true;
const log = (...a) => LOG && console.log('[MAP]', ...a);

const parseNum = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const baseLayersDefs = {
  esri: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 20, attribution: 'Imagery © Esri' }
  )
};

let currentBaseKey = 'esri';

// Datos globales para sidebar y filtro
let centrosDataGlobal = [];
let filtroSidebar = '';
let selectedCentroIdx = null;

/* =========================
   SIDEBAR ULTRA MINIMALISTA
   ========================= */
// Inicializar filtro minimalista y toggle
export function initSidebarFiltro() {
  const filtroInput = document.getElementById('filtroSidebar');
  const listaSidebar = document.getElementById('listaCentrosSidebar');
  const sidebar = document.getElementById('sidebarCentros');
  const toggleBtn = document.getElementById('toggleSidebar');

  if (!filtroInput || !listaSidebar || !sidebar || !toggleBtn) {
    log('No se encontró filtro o sidebar');
    return;
  }

  // Filtro (nombre o proveedor)
  filtroInput.addEventListener('input', () => {
    filtroSidebar = filtroInput.value.trim().toLowerCase();
    renderListaSidebar();
  });

  // Toggle para colapsar/expandir sidebar
  toggleBtn.onclick = () => {
    sidebar.classList.toggle('minimized');
    // Ajustar el mapa al expandir/collapse (timeout para animación)
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 350);

    if (sidebar.classList.contains('minimized')) {
      toggleBtn.title = "Expandir sidebar";
      toggleBtn.innerHTML = "&#x25B6;";
    } else {
      toggleBtn.title = "Colapsar sidebar";
      toggleBtn.innerHTML = "&#x25C0;";
    }
  };

  // Refresco inicial
  renderListaSidebar();
}

// Render lista minimalista en UL (máx 10)
function renderListaSidebar() {
  const listaSidebar = document.getElementById('listaCentrosSidebar');
  if (!listaSidebar) return;

  let filtrados = centrosDataGlobal;
  if (filtroSidebar.length > 0) {
    filtrados = centrosDataGlobal.filter(c =>
      (c.proveedor || '').toLowerCase().includes(filtroSidebar) ||
      (c.name || '').toLowerCase().includes(filtroSidebar)
    );
  }
  filtrados = filtrados.slice(0, 10);

  if (filtrados.length === 0) {
    listaSidebar.innerHTML = `<li style="color:#888;">Sin coincidencias</li>`;
    return;
  }

  listaSidebar.innerHTML = filtrados.map((c, i) => {
    // idx real para centrar en el mapa
    const idx = centrosDataGlobal.indexOf(c);
    return `
      <li data-idx="${idx}" class="${selectedCentroIdx === idx ? 'selected' : ''}" tabindex="0">
        <b>${c.name}</b>
        <span class="proveedor">${c.proveedor ? c.proveedor : ''}</span>
      </li>
    `;
  }).join('');

  // Click y teclado para centrar mapa
  Array.from(listaSidebar.querySelectorAll('li')).forEach(li => {
    li.onclick = () => {
      const idx = +li.getAttribute('data-idx');
      selectedCentroIdx = idx;
      focusCentroInMap(idx);
      renderListaSidebar();
    };
    li.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const idx = +li.getAttribute('data-idx');
        selectedCentroIdx = idx;
        focusCentroInMap(idx);
        renderListaSidebar();
      }
    };
  });
}

// Cargar centros y refrescar mapa + sidebar
export function cargarYRenderizarCentros(centros) {
  centrosDataGlobal = centros;
  drawCentrosInMap(centros);
  renderListaSidebar();
}

// Crear mapa Leaflet
export function crearMapa(defaultLatLng = [-42.48, -73.77]) {
  if (map) return map;

  const el = document.getElementById('map');
  if (!el) {
    console.error('[MAP] #map no encontrado');
    return null;
  }
  if (el.clientHeight < 50) el.style.minHeight = '400px';

  map = L.map(el, {
    zoomControl: true,
    center: defaultLatLng,
    zoom: 10,
    layers: [baseLayersDefs.esri]
  });
  window.__mapLeaflet = map;

  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup = L.layerGroup().addTo(map);

  // Recalcular tamaño al mostrar tab mapa
  document.querySelectorAll('a[href="#tab-mapa"]').forEach(a =>
    a.addEventListener('click', () => {
      setTimeout(() => map.invalidateSize(), 120);
      setTimeout(() => map.invalidateSize(), 400);
    })
  );
  if (location.hash === '#tab-mapa') {
    setTimeout(() => map.invalidateSize(), 150);
    setTimeout(() => map.invalidateSize(), 450);
  }

  log('Mapa creado');
  return map;
}

// Cambiar capa base
export function setBaseLayer(key) {
  if (!map || !baseLayersDefs[key] || currentBaseKey === key) return;
  map.removeLayer(baseLayersDefs[currentBaseKey]);
  map.addLayer(baseLayersDefs[key]);
  currentBaseKey = key;
  log('Base layer ->', key);
}

/* ---------- Puntos manuales ---------- */
export function clearMapPoints() {
  if (!puntosIngresoGroup) return;
  puntosIngresoGroup.clearLayers();
  currentPoly = null;
}
export function addPointMarker(lat, lng) {
  if (!puntosIngresoGroup) return;
  L.marker([lat, lng]).addTo(puntosIngresoGroup);
}
export function redrawPolygon(currentPoints = []) {
  if (currentPoly) {
    puntosIngresoGroup.removeLayer(currentPoly);
    currentPoly = null;
  }
  if (currentPoints.length >= 3) {
    currentPoly = L.polygon(currentPoints.map(p => [p.lat, p.lng]), { color: 'crimson' })
      .addTo(puntosIngresoGroup);
  }
}

/* ---------- Centros ---------- */
export function drawCentrosInMap(centros = [], defaultLatLng = [-42.48, -73.77], onPolyClick = null) {
  if (!map) crearMapa(defaultLatLng);
  if (!centrosGroup) return;

  windowCentrosDebug = centros.slice();
  centrosGroup.clearLayers();
  centroPolys = {};

  let dib = 0;
  centros.forEach((c, idx) => {
    const coords = (c.coords || [])
      .map(p => [parseNum(p.lat), parseNum(p.lng)])
      .filter(([la, ln]) => la !== null && ln !== null);
    if (coords.length < 3) return;

    const hect       = +c.hectareas || 0;
    const cantLineas = Array.isArray(c.lines) ? c.lines.length : 0;
    const totalBoyas = Array.isArray(c.lines) ? c.lines.reduce((a,l)=>a+(+l.buoys||0),0) : 0;

    const popupHTML = `
      <div style="min-width:150px;font-size:12.5px;line-height:1.25">
        <div style="font-weight:600;margin-bottom:4px;">${c.name}</div>
        <div><b>Código:</b> ${c.code}</div>
        <div><b>Hectáreas:</b> ${hect.toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div><b>Líneas:</b> ${cantLineas}</div>
        <div><b>Boyas:</b> ${totalBoyas}</div>
      </div>
    `.trim();

    const poly = L.polygon(coords, {
      color: '#1976d2',
      weight: 3,
      fillOpacity: .28
    }).addTo(centrosGroup);

    poly._popupHTML = popupHTML;
    poly.bindPopup(popupHTML);

    poly.on('click', (ev) => {
      if (ev && ev.originalEvent) {
        ev.originalEvent.stopPropagation?.();
        L.DomEvent.stopPropagation(ev);
      }
      if (poly.isPopupOpen && poly.isPopupOpen()) {
        poly.closePopup();
      } else {
        const pop = poly.getPopup();
        if (pop && pop.getContent() !== poly._popupHTML) pop.setContent(poly._popupHTML);
        poly.openPopup(ev.latlng || poly.getBounds().getCenter());
      }
      if (onPolyClick) onPolyClick(idx);
    });

    centroPolys[idx] = poly;
    dib++;
  });

  centrarMapaEnPoligonos(centros, defaultLatLng);

  setTimeout(() => map.invalidateSize(), 60);
  setTimeout(() => map.invalidateSize(), 300);

  log('Redibujados centros =', dib);
}

export function centrarMapaEnPoligonos(centros = [], defaultLatLng = [-42.48, -73.77]) {
  if (!map) return;
  const all = [];
  centros.forEach(c => (c.coords || []).forEach(p => {
    const la = parseNum(p.lat), ln = parseNum(p.lng);
    if (la !== null && ln !== null) all.push([la, ln]);
  }));
  if (all.length) map.fitBounds(all, { padding: [20, 20] });
  else map.setView(defaultLatLng, 10);
}

export function focusCentroInMap(idx) {
  const poly = centroPolys[idx];
  if (!poly) return;
  map.fitBounds(poly.getBounds(), { maxZoom: 16 });
  if (!poly.isPopupOpen || !poly.isPopupOpen()) {
    poly.openPopup(poly.getBounds().getCenter());
  }
  poly.setStyle({ color: '#ff9800', weight: 5 });
  setTimeout(() => poly.setStyle({ color: '#1976d2', weight: 3 }), 1000);
}
