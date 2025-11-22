// js/mapas/mapa.js
// Mapa Leaflet para Centros: creación, dibujo de polígonos, tooltips y buscador.
// Mantiene API pública: crearMapa, initSidebarFiltro, cargarYRenderizarCentros,
// drawCentrosInMap, updateLabelVisibility, clearMapPoints, addPointMarker, redrawPolygon,
// focusCentroInMap. 100% libre de "líneas" / "inventario".

let map;
let puntosIngresoGroup;
let centrosGroup;
let currentPoly = null;
let centroPolys = {};
let centroTooltips = {};
let windowCentrosDebug = [];
let _throttledUpd;

// ====== Medición de distancias (regla) ======
let measureLayer;
let measureOn = false;
let measurePoints = [];
let measureLine = null;
let measureLabelMarker = null;
let measureButtonEl = null;

// ====== Constantes ======
const CHILOE_COORDS = [-42.65, -73.99];
const CHILOE_ZOOM = 10;
const LABEL_ZOOM = 13; // mostrar etiquetas desde este zoom

// ====== Logging ======
const LOG = false;
const log     = (...a) => LOG && console.log('[MAP]', ...a);
const logWarn = (...a) => LOG && console.warn('[MAP]', ...a);
const logErr  = (...a) => LOG && console.error('[MAP]', ...a);
const group   = (title, fn) => { if (!LOG) return fn(); console.group('[MAP]', title); try { fn(); } finally { console.groupEnd(); } };

// ====== Utils locales ======
const parseNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitle = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const throttle = (fn, ms=80) => {
  let last = 0, t;
  return (...args) => {
    const now = Date.now();
    const wait = ms - (now - last);
    if (wait <= 0) { last = now; fn.apply(null, args); }
    else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn.apply(null, args); }, wait); }
  };
};

// === Normalizador y formateador de hectáreas (corrige 42.67 vs 42,67) ===
function normalizeHa(v){
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;

  // Si trae coma, asumimos latam: miles con '.' y decimales con ','
  if (s.includes(',')) {
    const num = Number(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(num) ? num : null;
  }
  // Si no trae coma, respetamos '.' como decimal (formato US)
  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}
const fmtHaCL = n => n == null
  ? '—'
  : n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ====== Helpers de medición (distancias) ======
function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '0 m';
  if (meters < 1000) {
    return `${meters.toFixed(0)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(2)} km (${meters.toFixed(0)} m)`;
}

function setMeasureActive(active) {
  measureOn = !!active;
  const container = map && map.getContainer ? map.getContainer() : null;
  if (container) {
    container.classList.toggle('measure-active', !!active);
  }
  if (measureButtonEl) {
    measureButtonEl.classList.toggle('measure-btn-active', !!active);
  }
}

function clearMeasure() {
  measurePoints = [];
  if (measureLayer) {
    measureLayer.clearLayers();
  }
  measureLine = null;
  measureLabelMarker = null;
}

function handleMeasureClick(e) {
  if (!measureOn || !map) return;

  const latlng = e.latlng;
  if (!latlng) return;

  measurePoints.push(latlng);

  // Línea principal
  if (!measureLine) {
    measureLine = L.polyline([latlng], {
      color: '#c62828',
      weight: 3,
      dashArray: '6,4'
    }).addTo(measureLayer);
  } else {
    measureLine.addLatLng(latlng);
  }

  // Calcular distancia total
  let total = 0;
  for (let i = 1; i < measurePoints.length; i++) {
    total += map.distance(measurePoints[i - 1], measurePoints[i]);
  }

  // Etiqueta de distancia
  if (!measureLabelMarker) {
    measureLabelMarker = L.circleMarker(latlng, {
      radius: 0,
      opacity: 0,
      fillOpacity: 0
    }).addTo(measureLayer);

    measureLabelMarker.bindTooltip(formatDistance(total), {
      permanent: true,
      direction: 'top',
      className: 'measure-label'
    }).openTooltip();
  } else {
    measureLabelMarker.setLatLng(latlng);
    measureLabelMarker.getTooltip().setContent(formatDistance(total));
  }
}

function handleMeasureKeyDown(e) {
  if (!measureOn) return;
  if (e.key === 'Escape' || e.key === 'Esc') {
    // ESC → apagar modo medición y limpiar
    clearMeasure();
    setMeasureActive(false);
  }
}

// ====== Base tiles ======
const MAPBOX_TOKEN =
  (window.CONFIG && window.CONFIG.MAPBOX_TOKEN) ||
  window.MAPBOX_TOKEN ||
  'pk.eyJ1IjoiY2FybG9zY2hpbG9lIiwiYSI6ImNtZTB3OTZmODA5Mm0ya24zaTQ1bGd3aW4ifQ.XElNIT02jDuetHpo4r_-3g';

const baseLayersDefs = (typeof L !== 'undefined') ? {
  mapboxSat: L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}` ,
    { maxZoom: 19, tileSize: 512, zoomOffset: -1, attribution: '© Mapbox, © OpenStreetMap, © Maxar' }
  ),
  esri: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '© Esri' }
  ),
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap contributors' }
  ),
  carto: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    { maxZoom: 19, attribution: '© CARTO' }
  )
} : {};

let currentBaseKey = 'mapboxSat';

// ====== Datos (buscador) ======
let centrosDataGlobal = [];

// ====== (Sidebar eliminada, se mantiene firma) ======
export function initSidebarFiltro() {
  log('Sidebar deshabilitada (compat).');
}

// ====== Modal de detalles ======
function buildCentroDetallesHtml(c) {
  const d = (c.detalles && typeof c.detalles === 'object') ? c.detalles : {};
  const flat = { ...d };
  if (d.resSSP)    { if (d.resSSP.numero) flat.numeroResSSP    = d.resSSP.numero;    if (d.resSSP.fecha)    flat.fechaResSSP    = d.resSSP.fecha; }
  if (d.resSSFFAA) { if (d.resSSFFAA.numero) flat.numeroResSSFFAA = d.resSSFFAA.numero; if (d.resSSFFAA.fecha) flat.fechaResSSFFAA = d.resSSFFAA.fecha; }
  const fmtDate = v => { if (!v) return ''; const s=String(v); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const D=new Date(s); return Number.isNaN(D.getTime()) ? s : D.toISOString().slice(0,10); };

  const LABELS = {
    region:'Región', codigoArea:'Código Área', ubicacion:'Ubicación', grupoEspecie:'Grupo Especie',
    especies:'Especies', tonsMax:'Tons Máx', numeroResSSP:'N° ResSSP', fechaResSSP:'Fecha ResSSP',
    numeroResSSFFAA:'N° ResSSFFAA', fechaResSSFFAA:'Fecha ResSSFFAA', rutTitular:'RUT Titular', nroPert:'Nro. Pert'
  };
  const pk = k => LABELS[k] || k.replace(/([A-Z])/g,' $1').replace(/^./,m=>m.toUpperCase());

  const haVal = normalizeHa(c.hectareas ?? d.hectareas ?? d.ha);
  let html = `<table class="striped"><tbody>
    <tr><th>Titular</th><td>${esc(toTitle(c.name || c.proveedor || ''))}</td></tr>
    <tr><th>Proveedor</th><td>${esc(toTitle(c.proveedor || ''))}</td></tr>
    <tr><th>Comuna</th><td>${esc(toTitle(c.comuna || ''))}</td></tr>
    <tr><th>Código</th><td>${esc(c.code || '')}</td></tr>
    <tr><th>Hectáreas</th><td>${fmtHaCL(haVal)}</td></tr>`;

  ['region','codigoArea','ubicacion','grupoEspecie','especies','tonsMax'].forEach(k => {
    let v = c[k];
    if (k === 'especies' && Array.isArray(c.especies)) v = c.especies.join(', ');
    if (v !== undefined && v !== null && String(v) !== '') html += `<tr><th>${pk(k)}</th><td>${esc(String(v))}</td></tr>`;
  });
  html += `</tbody></table>`;

  const order = ['rutTitular','nroPert','numeroResSSP','fechaResSSP','numeroResSSFFAA','fechaResSSFFAA'];
  const rows = [];
  order.forEach(k => {
    const v = flat[k];
    if (v !== undefined && v !== null && String(v) !== '') rows.push([k, k.startsWith('fecha') ? fmtDate(v) : v]);
  });
  Object.keys(flat)
    .filter(k => !order.includes(k) && flat[k] !== '' && flat[k] != null)
    .sort()
    .forEach(k => rows.push([k, flat[k]]));

  if (rows.length) {
    html += `<h6 style="margin-top:1.5em;">Detalles</h6><table class="striped"><tbody>`;
    rows.forEach(([k, v]) => { html += `<tr><th>${pk(k)}</th><td>${esc(String(v))}</td></tr>`; });
    html += `</tbody></table>`;
  }

  if (Array.isArray(c.coords) && c.coords.length) {
    html += `<h6 style="margin-top:1.5em;">Coordenadas</h6>
      <table class="striped">
        <thead><tr><th>#</th><th>Lat</th><th>Lng</th></tr></thead><tbody>`;
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
    alert(`Centro: ${c.name || c.proveedor || '-'}\nCódigo: ${c.code || '-'}`);
    return;
  }
  body.innerHTML = buildCentroDetallesHtml(c);
  // Evita que el mapa atrape scroll cuando abres modal
  try { document.querySelector('#mapShell')?.classList?.add('modal-open'); } catch {}
  const inst = (window.M?.Modal.getInstance(modal) || window.M?.Modal.init(modal));
  inst?.open();
  // Al cerrar, liberar clase
  modal.addEventListener('modal:closed', () => {
    try { document.querySelector('#mapShell')?.classList?.remove('modal-open'); } catch {}
  }, { once: true });
}

// ====== Crear mapa (idempotente) ======
export function crearMapa(defaultLatLng = CHILOE_COORDS, defaultZoom = CHILOE_ZOOM) {
  if (map) { log('crearMapa(): reuse'); return map; }

  if (typeof L === 'undefined') {
    logErr('Leaflet (L) no está disponible. ¿Cargaste leaflet.js y leaflet.css?');
    return null;
  }

  const el = document.getElementById('map');
  if (!el) { logErr('crearMapa(): #map no existe'); return null; }

  const baseInicial = baseLayersDefs[currentBaseKey] || baseLayersDefs.osm;
  group('crearMapa()', () => { log('baseInicial:', currentBaseKey); });

  map = L.map(el, {
    preferCanvas: true,
    zoomControl: true,
    center: defaultLatLng,
    zoom: defaultZoom,
    layers: baseInicial ? [baseInicial] : []
  });
  window.__mapLeaflet = map;

  // Grupos
  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup = L.layerGroup().addTo(map);

  // Capa + control de medición
  initMeasureControl();

  // Eventos del mapa
  _throttledUpd = throttle(updateLabelVisibility, 80);
  map.on('zoomend', _throttledUpd);
  map.on('moveend', _throttledUpd);

  // Logs + fallback base
  if (baseInicial) {
    Object.entries(baseLayersDefs).forEach(([key, layer]) => {
      layer?.on?.('tileload', () => log('tileload OK', key));
      layer?.on?.('tileerror', () => logWarn('tileerror', key));
    });
    if (!map.hasLayer(baseInicial)) {
      logWarn('Base inicial no montada, forzando OSM…');
      baseLayersDefs.osm?.addTo(map);
      currentBaseKey = 'osm';
    }
    let _baseFailedOnce = false;
    Object.entries(baseLayersDefs).forEach(([key, layer]) => {
      layer?.on?.('tileerror', () => {
        if (_baseFailedOnce || !map) return;
        _baseFailedOnce = true;
        try { Object.values(baseLayersDefs).forEach(l => { try { map.removeLayer(l); } catch {} }); } catch {}
        baseLayersDefs.osm?.addTo(map);
        currentBaseKey = 'osm';
        setTimeout(() => map.invalidateSize(), 50);
        logWarn(`tileerror en base "${key}" → fallback a OSM`);
      });
    });
  }

  // Observadores de tamaño/visibilidad (tabs)
  (function attachObservers(){
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    const ro = new ResizeObserver(() => { if (mapEl.clientHeight > 0) map.invalidateSize(); });
    ro.observe(mapEl);

    const tab = document.getElementById('tab-mapa');
    if (tab) {
      const mo = new MutationObserver(() => {
        const visible = getComputedStyle(tab).display !== 'none' && tab.offsetParent !== null;
        if (visible) setTimeout(() => map.invalidateSize(), 60);
      });
      mo.observe(tab, { attributes:true, attributeFilter:['style','class'] });
    }

    if (location.hash === '#tab-mapa') setTimeout(() => map.invalidateSize(), 80);
    window.addEventListener('resize', () => map.invalidateSize(), { passive: true });
    document.querySelectorAll('a[href="#tab-mapa"]').forEach(a =>
      a.addEventListener('click', () => setTimeout(() => map.invalidateSize(), 80))
    );
  })();

  // UI de búsqueda
  initMapSearchUI();

  log('Mapa creado');
  return map;
}

export function setBaseLayer(key) {
  if (!map || !baseLayersDefs[key] || currentBaseKey === key) {
    logWarn('setBaseLayer skip', { hasMap: !!map, key, currentBaseKey });
    return;
  }
  group('setBaseLayer', () => {
    log('from →', currentBaseKey, 'to →', key);
    try {
      Object.values(baseLayersDefs).forEach(l => { try { map.removeLayer(l); } catch {} });
      baseLayersDefs[key].addTo(map);
      currentBaseKey = key;
      setTimeout(() => map.invalidateSize(), 30);
      setTimeout(() => map.invalidateSize(), 300); // ajuste extra para evitar tiles “cortados”
    } catch (e) {
      logErr('setBaseLayer error → fallback OSM:', e);
      try { Object.values(baseLayersDefs).forEach(l => { try { map.removeLayer(l); } catch {} }); } catch {}
      baseLayersDefs.osm?.addTo(map);
      currentBaseKey = 'osm';
      setTimeout(() => map.invalidateSize(), 60);
    }
  });
}

// ====== Puntos manuales (formulario) ======
export function clearMapPoints(){
  if (!puntosIngresoGroup) return;
  puntosIngresoGroup.clearLayers();
  currentPoly = null;
}
export function addPointMarker(lat, lng){
  if (!puntosIngresoGroup) return;
  L.marker([lat, lng]).addTo(puntosIngresoGroup);
}
export function redrawPolygon(currentPoints = []){
  if (currentPoly){
    try { puntosIngresoGroup.removeLayer(currentPoly); } catch {}
    currentPoly = null;
  }
  if (currentPoints.length >= 3) {
    currentPoly = L.polygon(
      currentPoints.map(p => [p.lat, p.lng]),
      { color: '#9333ea', weight: 3, fillOpacity: .25 } // tono violeta opcional (match MMPP)
    ).addTo(puntosIngresoGroup);
  }
}

// ====== Dibujo de centros ======
export function cargarYRenderizarCentros(centros) {
  centrosDataGlobal = Array.isArray(centros) ? centros : [];
  drawCentrosInMap(centrosDataGlobal);
  updateLabelVisibility();
}

export function drawCentrosInMap(centros = [], defaultLatLng = CHILOE_COORDS, onPolyClick = null) {
  if (!map) crearMapa(defaultLatLng);
  if (!centrosGroup) return;

  centros = Array.isArray(centros) ? centros : [];
  windowCentrosDebug = centros.slice();

  centrosGroup.clearLayers();
  centroPolys = {};
  centroTooltips = {};

  // Paleta consistente si existe u.paletteFor (de /js/utils.js)
  const hasPalette = !!(window.u && typeof window.u.paletteFor === 'function');

  let dib = 0, filtrados = 0;
  centros.forEach((c, idx) => {
    const coords = (c.coords || [])
      .map(p => [parseNum(p.lat), parseNum(p.lng)])
      .filter(([la, ln]) => la !== null && ln !== null);

    if (coords.length < 3) { filtrados++; return; }

    // Color por proveedor/contacto/código (opcional)
    let color = '#1976d2', fill = '#e3f2fd';
    if (hasPalette) {
      const pal = window.u.paletteFor(c.proveedor || c.name || c.code || idx);
      color = pal.main;
      fill = pal.faint;
    }

    const poly = L.polygon(coords, { color, weight: 3, fillOpacity: .28, fillColor: fill }).addTo(centrosGroup);

    // cursor pointer para interacción
    try { poly.getElement?.()?.classList?.add('cursor-pointer'); } catch {}

    const titular = c.name || c.proveedor || '—';
    const codigo  = c.code || '—';
    const labelHtml = `
      <div class="centro-label-inner">
        <div class="titular">${esc(titular)}</div>
        <div class="codigo">Código: ${esc(codigo)}</div>
      </div>`;
    poly.bindTooltip(labelHtml, { permanent: true, direction: 'center', opacity: 0.95, className: 'centro-label' });

    // Hover highlight + “pill” solo en hover
    poly.on('mouseover', () => {
      try {
        poly.setStyle({ weight: 5 });
        poly.bringToFront();
        const tEl = poly.getTooltip()?.getElement?.();
        if (tEl) tEl.classList.add('hover-pill'); // activa píldora solo mientras está el hover
      } catch {}
    });
    poly.on('mouseout', () => {
      try {
        poly.setStyle({ weight: 3 });
        const tEl = poly.getTooltip()?.getElement?.();
        if (tEl) tEl.classList.remove('hover-pill'); // vuelve a texto transparente
      } catch {}
    });

    // Click → modal
    poly.on('click', (ev) => {
      ev?.originalEvent && L.DomEvent.stopPropagation(ev);
      openCentroModal(c);
      onPolyClick && onPolyClick(idx);
    });

    centroPolys[idx] = poly;
    centroTooltips[idx] = poly.getTooltip();
    dib++;
  });

  log('dibujados:', dib, 'filtrados(sin >=3 pts):', filtrados);
  centrarMapaEnPoligonos(centros, defaultLatLng);

  // Invalidate por si la pestaña cambió recién
  setTimeout(() => map && map.invalidateSize(), 60);
  setTimeout(() => map && map.invalidateSize(), 300);

  updateLabelVisibility();
  log('Redibujados centros =', dib);
}

export function updateLabelVisibility() {
  if (!map) return;

  const z = map.getZoom();
  const show = z >= LABEL_ZOOM;

  // Escala suave según zoom (opcional, usa tu CSS --label-scale)
  const scale = (z >= 16) ? 1.00
              : (z >= 15) ? 0.95
              : (z >= 14) ? 0.90
              : (z >= 13) ? 0.85
              : 0.80;

  Object.values(centroTooltips).forEach(t => {
    const el = t?.getElement?.();
    if (!el) return;

    el.style.display = show ? 'block' : 'none';
    el.style.setProperty('--label-scale', scale);

    // Fuerza orientación horizontal y evita “columna” de letras
    el.style.writingMode = 'horizontal-tb';
    el.style.textOrientation = 'mixed';
    el.style.whiteSpace = 'normal';
    el.style.wordBreak = 'normal';
    el.style.maxWidth = '260px'; // alineado con CSS
  });

  log('updateLabelVisibility → zoom:', z, 'showLabels:', show, 'tooltips:', Object.keys(centroTooltips).length);
}

function centrarMapaEnPoligonos(centros = [], defaultLatLng = CHILOE_COORDS) {
  if (!map) return;
  const all = [];
  centros.forEach(c => (c.coords || []).forEach(p => {
    const la = parseNum(p.lat), ln = parseNum(p.lng);
    if (la !== null && ln !== null) all.push([la, ln]);
  }));
  if (all.length) {
    try { map.fitBounds(all, { padding: [20, 20], maxZoom: CHILOE_ZOOM }); }
    catch (e) { logErr('fitBounds error:', e); map.setView(defaultLatLng, CHILOE_ZOOM); }
  } else {
    map.setView(defaultLatLng, CHILOE_ZOOM);
  }
}

export function focusCentroInMap(idx) {
  const poly = centroPolys[idx]; if (!poly) return;
  try { map.fitBounds(poly.getBounds(), { maxZoom: 16 }); } catch {}
  const t = centroTooltips[idx]?.getElement?.(); if (t) t.style.display = 'block';
  // Flash de énfasis breve
  try { poly.setStyle({ weight: 6 }); setTimeout(() => poly.setStyle({ weight: 3 }), 850); } catch {}
}

// ====== Control de medición (regla) ======
function initMeasureControl() {
  if (!map || typeof L === 'undefined') return;
  if (measureLayer) return; // ya inicializado

  // Capa donde van línea + tooltip
  measureLayer = L.layerGroup().addTo(map);

  const MeasureControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function() {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom measure-control');
      container.title = 'Medir distancia (clicks en el mapa, ESC para limpiar)';
      container.innerHTML = '<span class="measure-icon">📏</span>';

      measureButtonEl = container;

      // Evitar que el click propague al mapa
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(container, 'click', function (ev) {
        L.DomEvent.stopPropagation(ev);
        L.DomEvent.preventDefault(ev);

        if (measureOn) {
          // Apagar
          clearMeasure();
          setMeasureActive(false);
        } else {
          // Encender (y limpiar cualquier medición previa)
          clearMeasure();
          setMeasureActive(true);
        }
      });

      return container;
    }
  });

  map.addControl(new MeasureControl());

  // Eventos del mapa/documento para medición
  map.on('click', handleMeasureClick);
  document.addEventListener('keydown', handleMeasureKeyDown);
}

// ====== Buscador global (input sobre el mapa) ======
function initMapSearchUI() {
  const input = document.getElementById('mapSearch');
  const list  = document.getElementById('mapSearchResults');
  if (!input || !list) { logWarn('mapSearch UI no encontrado'); return; }
  log('mapSearch UI OK');

  let activeIdx = -1;         // índice seleccionado en la lista
  let lastHits  = [];         // cache último resultado para Enter
  const HILITE_OPEN  = '<mark class="hit">';
  const HILITE_CLOSE = '</mark>';

  function hideList() {
    list.style.display = 'none';
    list.classList.remove('show');
    list.innerHTML = '';
    activeIdx = -1;
    lastHits = [];
  }

  function setActive(idx) {
    const items = Array.from(list.querySelectorAll('li[data-idx]'));
    items.forEach((li, i) => li.classList.toggle('active', i === idx));
    activeIdx = idx;
    if (idx >= 0 && items[idx]) {
      const el = items[idx];
      const r = el.getBoundingClientRect();
      const rBox = list.getBoundingClientRect();
      if (r.top < rBox.top) list.scrollTop -= (rBox.top - r.top) + 8;
      if (r.bottom > rBox.bottom) list.scrollTop += (r.bottom - rBox.bottom) + 8;
    }
  }

  function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hi(txt, q) {
    if (!q) return txt;
    try {
      const re = new RegExp(`(${escapeRegExp(q)})`, 'ig');
      return String(txt).replace(re, `${HILITE_OPEN}$1${HILITE_CLOSE}`);
    } catch { return txt; }
  }

  const doSearch = (q) => {
    q = (q || '').trim();
    if (!q) { hideList(); return; }

    const qLower = q.toLowerCase();
    const hits = (centrosDataGlobal || [])
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => {
        const area   = (c.codigoArea || c?.detalles?.codigoArea || '').toString().toLowerCase();
        const nombre = (c.name || c.proveedor || '').toString().toLowerCase();
        const code   = (c.code || '').toString().toLowerCase();
        const comuna = (c.comuna || c?.detalles?.comuna || '').toString().toLowerCase();
        return code.includes(qLower) || nombre.includes(qLower) || area.includes(qLower) || comuna.includes(qLower);
      })
      .slice(0, 24);

    lastHits = hits;

    if (!hits.length) {
      list.innerHTML = `<li class="nores">Sin resultados</li>`;
      list.style.display = 'block';
      list.classList.add('show');
      activeIdx = -1;
      return;
    }

    list.innerHTML = hits.map(({ c, idx }) => {
      const comuna  = (c.comuna || c?.detalles?.comuna || '—');
      const area    = (c.codigoArea || c?.detalles?.codigoArea || '—');
      const code    = (c.code || '—');
      const name    = (c.name || c.proveedor || '-');
      return `
        <li data-idx="${idx}" tabindex="0" aria-selected="false">
          <b>${hi(esc(name), q)}</b>
          <div class="sub">
            Código: ${hi(esc(code), q)} · Comuna: ${hi(esc(comuna), q)} · Área: ${hi(esc(area), q)}
          </div>
        </li>
      `;
    }).join('');
    list.style.display = 'block';
    list.classList.add('show');
    activeIdx = -1;

    Array.from(list.querySelectorAll('li[data-idx]')).forEach((li) => {
      const go = () => { const id = +li.getAttribute('data-idx'); focusCentroInMap(id); hideList(); };
      li.onclick = go;
      li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') go(); };
    });
  };

  // === Eventos ===
  // 1) Autocompletar mientras escribe (con debounce suave)
  const debouncedSearch = throttle((val) => doSearch(val), 120);
  input.addEventListener('input', () => {
    const val = input.value;
    if (!val.trim()) { hideList(); return; }
    debouncedSearch(val);
  });

  // 2) Enter/Escape/↑/↓
  input.addEventListener('keydown', (e) => {
    const items = Array.from(list.querySelectorAll('li[data-idx]'));
    const max = items.length - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!items.length) return;
      setActive(Math.min(activeIdx + 1, max));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      setActive(Math.max(activeIdx - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && items[activeIdx]) {
        items[activeIdx].click();
        return;
      }
      // sin selección, usa primer hit si existe
      if (lastHits.length) {
        focusCentroInMap(lastHits[0].idx);
        hideList();
      }
      return;
    }
    if (e.key === 'Escape') {
      hideList();
      return;
    }
  });

  // 3) Click fuera -> ocultar
  document.addEventListener('click', (e) => {
    if (!list.contains(e.target) && e.target !== input) hideList();
  });

  // 4) Accesibilidad básica
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  list.setAttribute('role', 'listbox');
}

// Helpers debug
window.__MAPDBG = { L, map, setBaseLayer, baseLayersDefs, centrosSample: () => centrosDataGlobal.slice(0, 3) };
