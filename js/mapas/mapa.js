// js/mapas/mapa.js - gestión completa del mapa y sidebar de centros, centrado en Chiloé

let map;
let puntosIngresoGroup;
let centrosGroup;
let currentPoly = null;
let centroPolys = {};
let windowCentrosDebug = [];

// Coordenadas centro Chiloé
const CHILOE_COORDS = [-42.65, -73.99];
const CHILOE_ZOOM = 10;

const LOG = true;
const log = (...a) => LOG && console.log('[MAP]', ...a);

// Helpers
const parseNum = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const toTitleCase = (str) => (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const fmtDate = (v) => {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
};

// Proveedores de mapas
const MAPBOX_TOKEN = 'pk.eyJ1IjoiY2FybG9zY2hpbG9lIiwiYSI6ImNtZTB3OTZmODA5Mm0ya24zaTQ1bGd3aW4ifQ.XElNIT02jDuetHpo4r_-3g';
const baseLayersDefs = {
  mapboxSat: L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
    { maxZoom: 19, attribution: '© Mapbox, © OpenStreetMap, © Maxar' }
  ),
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap contributors' }
  ),
  esri: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '© Esri' }
  ),
  carto: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    { maxZoom: 19, attribution: '&copy; CARTO' }
  )
};
let currentBaseKey = 'mapboxSat';

// Datos globales para sidebar y filtro
let centrosDataGlobal = [];
let filtroSidebar = '';
let selectedCentroIdx = null;

/* =========================
   SIDEBAR (mini)
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

  filtroInput.addEventListener('input', () => {
    filtroSidebar = filtroInput.value.trim().toLowerCase();
    renderListaSidebar();
  });

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
    setTimeout(() => { if (map) map.invalidateSize(); }, 350);
  };

  renderListaSidebar();
}

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

  if (!filtrados.length) {
    listaSidebar.innerHTML = `<li style="color:#888;">Sin coincidencias</li>`;
    return;
  }

  listaSidebar.innerHTML = filtrados.map((c) => {
    const idx = centrosDataGlobal.indexOf(c);
    return `
      <li data-idx="${idx}" class="${selectedCentroIdx === idx ? 'selected' : ''}" tabindex="0">
        <b>${esc(c.name || c.proveedor || '-')}</b>
        <span class="proveedor">${esc(c.proveedor || '')}</span>
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

export function cargarYRenderizarCentros(centros) {
  centrosDataGlobal = centros;
  drawCentrosInMap(centros);
  renderListaSidebar();
}

/* =========================
   MODAL DETALLES DESDE MAPA
   ========================= */
function buildCentroDetallesHtml(c) {
  const d = (c.detalles && typeof c.detalles === 'object') ? c.detalles : {};
  const dFlat = { ...d };

  // aplanar posibles resSSP / resSSFFAA si existen
  if (d.resSSP) {
    if (d.resSSP.numero) dFlat.numeroResSSP = d.resSSP.numero;
    if (d.resSSP.fecha)  dFlat.fechaResSSP  = d.resSSP.fecha;
  }
  if (d.resSSFFAA) {
    if (d.resSSFFAA.numero) dFlat.numeroResSSFFAA = d.resSSFFAA.numero;
    if (d.resSSFFAA.fecha)  dFlat.fechaResSSFFAA  = d.resSSFFAA.fecha;
  }

  const LABELS = {
    region: 'Región',
    codigoArea: 'Código Área',
    ubicacion: 'Ubicación',
    grupoEspecie: 'Grupo Especie',
    especies: 'Especies',
    tonsMax: 'Tons Máx',
    numeroResSSP: 'N° ResSSP',
    fechaResSSP: 'Fecha ResSSP',
    numeroResSSFFAA: 'N° ResSSFFAA',
    fechaResSSFFAA: 'Fecha ResSSFFAA',
    rutTitular: 'RUT Titular',
    nroPert: 'Nro. Pert',
  };
  const prettyKey = k => LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, m => m.toUpperCase());

  let html = `<table class="striped"><tbody>
    <tr><th>Titular</th><td>${esc(toTitleCase(c.name || c.proveedor || ''))}</td></tr>
    <tr><th>Proveedor</th><td>${esc(toTitleCase(c.proveedor || ''))}</td></tr>
    <tr><th>Comuna</th><td>${esc(toTitleCase(c.comuna || ''))}</td></tr>
    <tr><th>Código</th><td>${esc(c.code || '')}</td></tr>
    <tr><th>Hectáreas</th><td>${c.hectareas ?? ''}</td></tr>
  `;

  // top-level extras
  const ORDER_TOP = ['region','codigoArea','ubicacion','grupoEspecie','especies','tonsMax'];
  ORDER_TOP.forEach(k => {
    let v = c[k];
    if (k === 'especies' && Array.isArray(c.especies)) v = c.especies.join(', ');
    if (v !== undefined && v !== null && String(v) !== '') {
      html += `<tr><th>${prettyKey(k)}</th><td>${esc(String(v))}</td></tr>`;
    }
  });

  html += `</tbody></table>`;

  // detalles extra
  const ORDER_DET = ['rutTitular','nroPert','numeroResSSP','fechaResSSP','numeroResSSFFAA','fechaResSSFFAA'];
  const rows = [];
  ORDER_DET.forEach(k => {
    const v = dFlat[k];
    if (v !== undefined && v !== null && String(v) !== '') {
      rows.push([k, k.startsWith('fecha') ? fmtDate(v) : v]);
    }
  });
  Object.keys(dFlat)
    .filter(k => !ORDER_DET.includes(k) && dFlat[k] !== '' && dFlat[k] != null)
    .sort()
    .forEach(k => rows.push([k, dFlat[k]]));

  if (rows.length) {
    html += `<h6 style="margin-top:1.5em;">Detalles</h6><table class="striped"><tbody>`;
    rows.forEach(([k, v]) => { html += `<tr><th>${prettyKey(k)}</th><td>${esc(String(v))}</td></tr>`; });
    html += `</tbody></table>`;
  } else {
    html += `<div class="grey-text" style="margin-top:1em;">Sin detalles adicionales</div>`;
  }

  // Coordenadas
  if (Array.isArray(c.coords) && c.coords.length) {
    html += `<h6 style="margin-top:1.5em;">Coordenadas</h6>
      <table class="striped"><thead><tr><th>#</th><th>Lat</th><th>Lng</th></tr></thead><tbody>`;
    c.coords.forEach((p, i) => {
      const latStr = Number.isFinite(p?.lat) ? Number(p.lat).toFixed(6) : (p?.lat ?? '');
      const lngStr = Number.isFinite(p?.lng) ? Number(p.lng).toFixed(6) : (p?.lng ?? '');
      html += `<tr><td>${i + 1}</td><td>${latStr}</td><td>${lngStr}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  return html;
}

function openCentroModal(c) {
  const modal = document.getElementById('modalDetallesCentro');
  const body  = document.getElementById('detallesCentroBody');
  if (!modal || !body) {
    alert(`Centro:\n${c.name || c.proveedor || '-'}\nCódigo: ${c.code || '-'}`);
    return;
  }
  body.innerHTML = buildCentroDetallesHtml(c);
  const inst = window.M?.Modal?.getInstance(modal) || window.M?.Modal?.init(modal);
  inst?.open();
}

/* =========================
   MAPA
   ========================= */
export function crearMapa(defaultLatLng = CHILOE_COORDS, defaultZoom = CHILOE_ZOOM) {
  if (map) return map;
  const el = document.getElementById('map');
  if (!el) { console.error('[MAP] #map no encontrado'); return null; }
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

    // Polígono
    const poly = L.polygon(coords, { color: '#1976d2', weight: 3, fillOpacity: .28 })
      .addTo(centrosGroup);

    // Etiqueta permanente (Titular + Código)
    const titular = c.name || c.proveedor || '—';
    const codigo  = c.code || '—';
    const labelHtml = `
      <div class="centro-label-inner">
        <div class="titular">${esc(titular)}</div>
        <div class="codigo">Código: ${esc(codigo)}</div>
      </div>
    `.trim();

    poly.bindTooltip(labelHtml, {
      permanent: true,
      direction: 'center',
      opacity: 0.95,
      className: 'centro-label'
    });

    // Click: abre modal con ficha completa
    poly.on('click', (ev) => {
      ev?.originalEvent && L.DomEvent.stopPropagation(ev);
      openCentroModal(c);
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
  if (all.length) map.fitBounds(all, { padding: [20, 20], maxZoom: CHILOE_ZOOM });
  else map.setView(defaultLatLng, CHILOE_ZOOM);
}

export function focusCentroInMap(idx) {
  const poly = centroPolys[idx];
  if (!poly) return;
  map.fitBounds(poly.getBounds(), { maxZoom: 16 });
  poly.setStyle({ color: '#ff9800', weight: 5 });
  setTimeout(() => poly.setStyle({ color: '#1976d2', weight: 3 }), 1000);
}
