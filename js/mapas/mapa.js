// js/mapas/mapa.js - gestión completa del mapa y sidebar de centros, centrado en Chiloé

let map;
let puntosIngresoGroup;
let centrosGroup;
let currentPoly = null;
let centroPolys = {};
let windowCentrosDebug = [];

// Coordenadas centro Chiloé
const CHILOE_COORDS = [-42.65, -73.99]; // Centro de la isla de Chiloé
const CHILOE_ZOOM = 10;

const LOG = true;
const log = (...a) => LOG && console.log('[MAP]', ...a);

const parseNum = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// Proveedores de mapas (tiles) con Mapbox satélite por defecto
const MAPBOX_TOKEN = 'pk.eyJ1IjoiY2FybG9zY2hpbG9lIiwiYSI6ImNtZTB3OTZmODA5Mm0ya24zaTQ1bGd3aW4ifQ.XElNIT02jDuetHpo4r_-3g';

const baseLayersDefs = {
  mapboxSat: L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
    {
      maxZoom: 19,
      attribution: '© Mapbox, © OpenStreetMap, © Maxar'
    }
  ),
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }
  ),
  esri: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: '© Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }
  ),
  carto: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      maxZoom: 19,
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  )
};
let currentBaseKey = 'mapboxSat'; // Satélite por defecto

// Datos globales para sidebar y filtro
let centrosDataGlobal = [];
let filtroSidebar = '';
let selectedCentroIdx = null;

/* =========================
   SIDEBAR ULTRA MINIMALISTA
   ========================= */
export function initSidebarFiltro() {
  const filtroInput = document.getElementById('filtroSidebar');
  const listaSidebar = document.getElementById('listaCentrosSidebar');
  const sidebar = document.getElementById('sidebarCentros');
  const toggleBtn = document.getElementById('toggleSidebar');
  const icon = document.getElementById('toggleSidebarIcon');

  if (!filtroInput || !listaSidebar || !sidebar || !toggleBtn || !icon) {
    log('No se encontró filtro, sidebar o icono');
    return;
  }

  // Filtro (nombre o proveedor)
  filtroInput.addEventListener('input', () => {
    filtroSidebar = filtroInput.value.trim().toLowerCase();
    renderListaSidebar();
  });

  // Toggle para colapsar/expandir sidebar con Material Icons
  toggleBtn.onclick = () => {
    sidebar.classList.toggle('minimized');

    if (sidebar.classList.contains('minimized')) {
      document.body.classList.add('sidebar-minimized');
      toggleBtn.title = "Expandir sidebar";
      icon.textContent = "chevron_right";
    } else {
      document.body.classList.remove('sidebar-minimized');
      toggleBtn.title = "Colapsar sidebar";
      icon.textContent = "chevron_left";
    }

    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 350);
  };

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
    const idx = centrosDataGlobal.indexOf(c);
    return `
      <li data-idx="${idx}" class="${selectedCentroIdx === idx ? 'selected' : ''}" tabindex="0">
        <b>${c.name}</b>
        <span class="proveedor">${c.proveedor ? c.proveedor : ''}</span>
      </li>
    `;
  }).join('');

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

// Crear mapa Leaflet, centrado en Chiloé
export function crearMapa(defaultLatLng = CHILOE_COORDS, defaultZoom = CHILOE_ZOOM) {
  if (map) return map;

  const el = document.getElementById('map');
  if (!el) {
    console.error('[MAP] #map no encontrado');
    return null;
  }
  if (el.clientHeight < 50) el.style.minHeight = '400px';

  // Siempre centrado en Chiloé
  map = L.map(el, {
    zoomControl: true,
    center: CHILOE_COORDS,
    zoom: CHILOE_ZOOM,
    layers: [baseLayersDefs[currentBaseKey]]
  });
  window.__mapLeaflet = map;

  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup = L.layerGroup().addTo(map);

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

    const hect = +c.hectareas || 0;
    const cantLineas = Array.isArray(c.lines) ? c.lines.length : 0;

    let sumaUnKg = 0, sumaRechazo = 0, sumaRdmto = 0, sumaTons = 0, linesConDatos = 0;
    if (Array.isArray(c.lines) && c.lines.length > 0) {
      c.lines.forEach(l => {
        if (l.unKg != null && !isNaN(l.unKg)) sumaUnKg += Number(l.unKg);
        if (l.porcRechazo != null && !isNaN(l.porcRechazo)) sumaRechazo += Number(l.porcRechazo);
        if (l.rendimiento != null && !isNaN(l.rendimiento)) sumaRdmto += Number(l.rendimiento);
        if (l.tons != null && !isNaN(l.tons)) sumaTons += Number(l.tons);
      });
      linesConDatos = c.lines.length;
    }

    const promUnKg = linesConDatos ? (sumaUnKg / linesConDatos) : 0;
    const promRechazo = linesConDatos ? (sumaRechazo / linesConDatos) : 0;
    const promRdmto = linesConDatos ? (sumaRdmto / linesConDatos) : 0;

    const popupHTML = `
      <div style="min-width:170px;font-size:13px;line-height:1.28">
        <div style="font-weight:600;margin-bottom:5px;">${c.name}</div>
        <div><b>Código:</b> ${c.code || '-'}</div>
        <div><b>Hectáreas:</b> ${hect.toLocaleString('es-CL', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div><b>Líneas:</b> ${cantLineas}</div>
        <div><b>Tons:</b> ${sumaTons.toLocaleString('es-CL', {minimumFractionDigits:0})}</div>
        <div><b>Un/Kg:</b> ${promUnKg.toLocaleString('es-CL', {maximumFractionDigits:2})}</div>
        <div><b>% Rechazo:</b> ${promRechazo.toLocaleString('es-CL', {maximumFractionDigits:2})}%</div>
        <div><b>Rdmto:</b> ${promRdmto.toLocaleString('es-CL', {maximumFractionDigits:2})}%</div>
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

  centrarMapaEnPoligonos(centros, CHILOE_COORDS);

  setTimeout(() => map.invalidateSize(), 60);
  setTimeout(() => map.invalidateSize(), 300);

  log('Redibujados centros =', dib);
}

export function centrarMapaEnPoligonos(centros = [], defaultLatLng = CHILOE_COORDS) {
  if (!map) return;
  const all = [];
  centros.forEach(c => (c.coords || []).forEach(p => {
    const la = parseNum(p.lat), ln = parseNum(p.lng);
    if (la !== null && ln !== null) all.push([la, ln]);
  }));
  // Si hay centros, ajusta bounds. Si NO hay, centra SIEMPRE en Chiloé
  if (all.length) map.fitBounds(all, { padding: [20, 20], maxZoom: CHILOE_ZOOM });
  else map.setView(defaultLatLng, CHILOE_ZOOM);
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

// **NO EXPORTES OTRAS FUNCIONES EN UN BLOQUE FINAL**
// Ya están exportadas arriba con 'export function ...'
