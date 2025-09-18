// js/mapas/mapa.js — refactor centrado en Chiloé con sidebar minimal

let map;
let puntosIngresoGroup;
let centrosGroup;
let currentPoly = null;
let centroPolys = {};
let windowCentrosDebug = [];

// ==================== Utiles locales ====================
const LOG = true;
const log = (...a) => LOG && console.log('[MAP]', ...a);
const parseNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const numeroCL = (n, opt = {}) =>
  (Number(n) || 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0, ...opt });

// Paleta estable por clave (evita “todo azul”)
function _hash(str) {
  let h = 2166136261 >>> 0; str = String(str || '');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
  return h >>> 0;
}
const HUES = [210, 12, 140, 48, 280, 110, 330, 190, 24, 160, 300, 80];
function paletteFor(key) {
  const idx = _hash(key) % HUES.length;
  const h = HUES[idx];
  return {
    stroke: `hsl(${h}, 70%, 45%)`,
    fill:   `hsl(${h}, 90%, 88%)`
  };
}

// Desbounced invalidate para pestañas/cambios de tamaño
let _invTimer = null;
function scheduleInvalidate(delay = 120) {
  if (!map) return;
  if (_invTimer) clearTimeout(_invTimer);
  _invTimer = setTimeout(() => {
    try { map.invalidateSize(); } catch {}
  }, delay);
}

// ==================== Centro Chiloé fijo ====================
const CHILOE_COORDS = [-42.65, -73.99];
const CHILOE_ZOOM = 10;

// ==================== Proveedores de tiles ====================
const MAPBOX_TOKEN =
  'pk.eyJ1IjoiY2FybG9zY2hpbG9lIiwiYSI6ImNtZTB3OTZmODA5Mm0ya24zaTQ1bGd3aW4ifQ.XElNIT02jDuetHpo4r_-3g';

const baseLayersDefs = {
  mapboxSat: L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
    { maxZoom: 19, attribution: '© Mapbox, © OpenStreetMap, © Maxar' }
  ),
  esri: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '© Esri, Maxar, etc.' }
  ),
  carto: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    { maxZoom: 19, attribution: '&copy; CARTO' }
  ),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap' })
};

// Si no hay token válido, usamos CARTO/ESRI
let currentBaseKey = MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith('pk.') ? 'mapboxSat' : 'carto';

// ==================== Estado sidebar/filtro ====================
let centrosDataGlobal = [];
let filtroSidebar = '';
let selectedCentroIdx = null;

/* =============== Sidebar ultra simple =============== */
export function initSidebarFiltro() {
  const filtroInput = document.getElementById('filtroSidebar');
  const listaSidebar = document.getElementById('listaCentrosSidebar');
  const sidebar = document.getElementById('sidebarCentros');
  const toggleBtn = document.getElementById('toggleSidebar');
  const icon = document.getElementById('toggleSidebarIcon');

  if (!filtroInput || !listaSidebar || !sidebar || !toggleBtn || !icon) {
    log('No se encontró filtro/sidebar');
    return;
  }

  filtroInput.addEventListener('input', () => {
    filtroSidebar = filtroInput.value.trim().toLowerCase();
    renderListaSidebar();
  });

  toggleBtn.onclick = () => {
    sidebar.classList.toggle('minimized');
    if (sidebar.classList.contains('minimized')) {
      document.body.classList.add('sidebar-minimized'); toggleBtn.title = 'Expandir sidebar'; icon.textContent = 'chevron_right';
    } else {
      document.body.classList.remove('sidebar-minimized'); toggleBtn.title = 'Colapsar sidebar'; icon.textContent = 'chevron_left';
    }
    scheduleInvalidate(350);
  };

  renderListaSidebar();
}

// Render lista (máx 10)
function renderListaSidebar() {
  const listaSidebar = document.getElementById('listaCentrosSidebar');
  if (!listaSidebar) return;

  let filtrados = centrosDataGlobal;
  if (filtroSidebar) {
    filtrados = centrosDataGlobal.filter(c =>
      (c.proveedor || '').toLowerCase().includes(filtroSidebar) ||
      (c.name || '').toLowerCase().includes(filtroSidebar) ||
      (c.comuna || '').toLowerCase().includes(filtroSidebar)
    );
  }
  filtrados = filtrados.slice(0, 10);

  if (!filtrados.length) {
    listaSidebar.innerHTML = '<li style="color:#888;">Sin coincidencias</li>';
    return;
  }

  listaSidebar.innerHTML = filtrados.map(c => {
    const idx = centrosDataGlobal.indexOf(c);
    return `
      <li data-idx="${idx}" class="${selectedCentroIdx === idx ? 'selected' : ''}" tabindex="0">
        <b>${c.name || '-'}</b>
        <span class="proveedor">${c.proveedor || ''}</span>
      </li>`;
  }).join('');

  Array.from(listaSidebar.querySelectorAll('li')).forEach(li => {
    const go = () => {
      const idx = +li.getAttribute('data-idx');
      selectedCentroIdx = idx;
      focusCentroInMap(idx);
      renderListaSidebar();
    };
    li.onclick = go;
    li.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') go(); };
  });
}

/* =============== Carga/redibujo =============== */
export function cargarYRenderizarCentros(centros) {
  centrosDataGlobal = Array.isArray(centros) ? centros : [];
  drawCentrosInMap(centrosDataGlobal);
  renderListaSidebar();
}

/* =============== Crear mapa (Chiloé por defecto) =============== */
export function crearMapa(defaultLatLng = CHILOE_COORDS, defaultZoom = CHILOE_ZOOM) {
  if (map) return map;

  const el = document.getElementById('map');
  if (!el) { console.error('[MAP] Falta #map'); return null; }
  if (el.clientHeight < 50) el.style.minHeight = '400px';

  map = L.map(el, {
    zoomControl: true,
    center: CHILOE_COORDS,
    zoom: CHILOE_ZOOM,
    layers: [baseLayersDefs[currentBaseKey]]
  });
  window.__mapLeaflet = map;

  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup = L.layerGroup().addTo(map);

  // Recalcular tamaño al mostrar la pestaña del mapa
  document.querySelectorAll('a[href="#tab-mapa"]').forEach(a =>
    a.addEventListener('click', () => { scheduleInvalidate(120); scheduleInvalidate(420); })
  );
  if (location.hash === '#tab-mapa') { scheduleInvalidate(150); scheduleInvalidate(450); }

  log('Mapa creado');
  return map;
}

/* =============== Base layer =============== */
export function setBaseLayer(key) {
  if (!map || !baseLayersDefs[key] || currentBaseKey === key) return;
  map.removeLayer(baseLayersDefs[currentBaseKey]);
  map.addLayer(baseLayersDefs[key]);
  currentBaseKey = key;
  log('Base layer ->', key);
}

/* =============== Puntos manuales =============== */
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
  if (currentPoly) { puntosIngresoGroup.removeLayer(currentPoly); currentPoly = null; }
  if (currentPoints.length >= 3) {
    currentPoly = L.polygon(currentPoints.map(p => [p.lat, p.lng]), { color: 'crimson' }).addTo(puntosIngresoGroup);
  }
}

/* =============== Centros en mapa =============== */
export function drawCentrosInMap(centros = [], defaultLatLng = CHILOE_COORDS, onPolyClick = null) {
  if (!map) crearMapa(CHILOE_COORDS, CHILOE_ZOOM);
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

    // Agregados y promedios
    const hect = +c.hectareas || 0;
    const lines = Array.isArray(c.lines) ? c.lines : [];
    const cantLineas = lines.length;

    let sumaUnKg = 0, sumaRechazo = 0, sumaRdmto = 0, sumaTons = 0;
    lines.forEach(l => {
      if (!Number.isNaN(+l.unKg))        sumaUnKg += +l.unKg;
      if (!Number.isNaN(+l.porcRechazo)) sumaRechazo += +l.porcRechazo;
      if (!Number.isNaN(+l.rendimiento)) sumaRdmto += +l.rendimiento;
      if (!Number.isNaN(+l.tons))        sumaTons += +l.tons;
    });
    const promUnKg   = cantLineas ? (sumaUnKg / cantLineas) : 0;
    const promRech   = cantLineas ? (sumaRechazo / cantLineas) : 0;
    const promRdmto  = cantLineas ? (sumaRdmto / cantLineas) : 0;

    const nombre = c.name || '-';
    const proveedor = c.proveedor || nombre;
    const pal = paletteFor(proveedor);

    const popupHTML = `
      <div style="min-width:170px;font-size:13px;line-height:1.28">
        <div style="font-weight:600;margin-bottom:5px;">${nombre}</div>
        <div><b>Código:</b> ${c.code || '-'}</div>
        <div><b>Hectáreas:</b> ${numeroCL(hect, { minimumFractionDigits:2, maximumFractionDigits:2 })}</div>
        <div><b>Líneas:</b> ${numeroCL(cantLineas)}</div>
        <div><b>Tons:</b> ${numeroCL(sumaTons)}</div>
        <div><b>Un/Kg:</b> ${numeroCL(promUnKg, { maximumFractionDigits:2 })}</div>
        <div><b>% Rechazo:</b> ${promRech.toLocaleString('es-CL', { maximumFractionDigits:2 })}%</div>
        <div><b>Rdmto:</b> ${promRdmto.toLocaleString('es-CL', { maximumFractionDigits:2 })}%</div>
      </div>`.trim();

    const poly = L.polygon(coords, {
      color: pal.stroke,
      weight: 3,
      fillOpacity: .28,
      fillColor: pal.fill
    }).addTo(centrosGroup);

    poly._popupHTML = popupHTML;
    poly.bindPopup(popupHTML);

    poly.on('click', (ev) => {
      if (ev && ev.originalEvent) { ev.originalEvent.stopPropagation?.(); L.DomEvent.stopPropagation(ev); }
      const pop = poly.getPopup();
      if (pop && pop.getContent() !== poly._popupHTML) pop.setContent(poly._popupHTML);
      poly.openPopup(ev.latlng || poly.getBounds().getCenter());
      if (onPolyClick) onPolyClick(idx);
    });

    centroPolys[idx] = poly;
    dib++;
  });

  centrarMapaEnPoligonos(centros, CHILOE_COORDS);

  scheduleInvalidate(60);
  scheduleInvalidate(300);

  log('Redibujados centros =', dib);
}

export function centrarMapaEnPoligonos(centros = [], defaultLatLng = CHILOE_COORDS) {
  if (!map) return;
  const all = [];
  centros.forEach(c => (c.coords || []).forEach(p => {
    const la = parseNum(p.lat), ln = parseNum(p.lng);
    if (la !== null && ln !== null) all.push([la, ln]);
  }));
  if (all.length) map.fitBounds(all, { padding: [20, 20], maxZoom: CHILOE_ZOOM });
  else map.setView(defaultLatLng, CHILOE_ZOOM); // Siempre centramos en Chiloé si no hay centros
}

export function focusCentroInMap(idx) {
  const poly = centroPolys[idx];
  if (!poly) return;
  map.fitBounds(poly.getBounds(), { maxZoom: 16 });
  poly.openPopup(poly.getBounds().getCenter());
  const orig = poly.options.color;
  poly.setStyle({ color: '#ff9800', weight: 5 });
  setTimeout(() => poly.setStyle({ color: orig, weight: 3 }), 1000);
}

// **No exportes otras cosas; API pública arriba**
