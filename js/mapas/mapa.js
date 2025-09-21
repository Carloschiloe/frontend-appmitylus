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

// ====== Base tiles ======
const MAPBOX_TOKEN =
  (window.CONFIG && window.CONFIG.MAPBOX_TOKEN) ||
  window.MAPBOX_TOKEN ||
  'pk.eyJ1IjoiY2FybG9zY2hpbG9lIiwiYSI6ImNtZTB3OTZmODA5Mm0ya24zaTQ1bGd3aW4ifQ.XElNIT02jDuetHpo4r_-3g';

const baseLayersDefs = {
  mapboxSat: L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
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
};

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

  let html = `<table class="striped"><tbody>
    <tr><th>Titular</th><td>${esc(toTitle(c.name || c.proveedor || ''))}</td></tr>
    <tr><th>Proveedor</th><td>${esc(toTitle(c.proveedor || ''))}</td></tr>
    <tr><th>Comuna</th><td>${esc(toTitle(c.comuna || ''))}</td></tr>
    <tr><th>Código</th><td>${esc(c.code || '')}</td></tr>
    <tr><th>Hectáreas</th><td>${c.hectareas ?? ''}</td></tr>`;

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
  if (!modal || !body) { alert(`Centro: ${c.name || c.proveedor || '-'}\nCódigo: ${c.code || '-'}`); return; }
  body.innerHTML = buildCentroDetallesHtml(c);
  (window.M?.Modal.getInstance(modal) || window.M?.Modal.init(modal))?.open();
}

// ====== Crear mapa (idempotente) ======
export function crearMapa(defaultLatLng = CHILOE_COORDS, defaultZoom = CHILOE_ZOOM) {
  if (map) { log('crearMapa(): reuse'); return map; }

  const el = document.getElementById('map');
  if (!el) { logErr('crearMapa(): #map no existe'); return null; }

  const baseInicial = baseLayersDefs[currentBaseKey] || baseLayersDefs.osm;
  group('crearMapa()', () => { log('baseInicial:', currentBaseKey); });

  map = L.map(el, {
    preferCanvas: true,
    zoomControl: true,
    center: defaultLatLng,
    zoom: defaultZoom,
    layers: [baseInicial]
  });
  window.__mapLeaflet = map;

  // Grupos
  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup = L.layerGroup().addTo(map);

  // Eventos del mapa
  _throttledUpd = throttle(updateLabelVisibility, 80);
  map.on('zoomend', _throttledUpd);
  map.on('moveend', _throttledUpd);

  // Logs + fallback base
  Object.entries(baseLayersDefs).forEach(([key, layer]) => {
    layer?.on?.('tileload', () => log('tileload OK', key));
    layer?.on?.('tileerror', () => logWarn('tileerror', key));
  });
  if (!map.hasLayer(baseInicial)) {
    logWarn('Base inicial no montada, forzando OSM…');
    baseLayersDefs.osm.addTo(map);
    currentBaseKey = 'osm';
  }
  let _baseFailedOnce = false;
  Object.entries(baseLayersDefs).forEach(([key, layer]) => {
    layer?.on?.('tileerror', () => {
      if (_baseFailedOnce || !map) return;
      _baseFailedOnce = true;
      try { Object.values(baseLayersDefs).forEach(l => { try { map.removeLayer(l); } catch {} }); } catch {}
      baseLayersDefs.osm.addTo(map);
      currentBaseKey = 'osm';
      setTimeout(() => map.invalidateSize(), 50);
      logWarn(`tileerror en base "${key}" → fallback a OSM`);
    });
  });

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
    } catch (e) {
      logErr('setBaseLayer error → fallback OSM:', e);
      baseLayersDefs.osm.addTo(map);
      currentBaseKey = 'osm';
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

    const titular = c.name || c.proveedor || '—';
    const codigo  = c.code || '—';
    const labelHtml = `
      <div class="centro-label-inner">
        <div class="titular">${esc(titular)}</div>
        <div class="codigo">Código: ${esc(codigo)}</div>
      </div>`;
    poly.bindTooltip(labelHtml, { permanent: true, direction: 'center', opacity: 0.95, className: 'centro-label' });

    // Hover highlight (sin romper color original)
    poly.on('mouseover', () => { try { poly.setStyle({ weight: 5 }); poly.bringToFront(); } catch {} });
    poly.on('mouseout',  () => { try { poly.setStyle({ weight: 3 }); } catch {} });

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
  const show = map.getZoom() >= LABEL_ZOOM;
  Object.values(centroTooltips).forEach(t => {
    const el = t?.getElement?.();
    if (el) el.style.display = show ? 'block' : 'none';
  });
  log('updateLabelVisibility → zoom:', map.getZoom(), 'showLabels:', show,
      'tooltips:', Object.keys(centroTooltips).length);
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

// ====== Buscador global (input sobre el mapa) ======
function initMapSearchUI() {
  const input = document.getElementById('mapSearch');
  const list  = document.getElementById('mapSearchResults');
  if (!input || !list) { logWarn('mapSearch UI no encontrado'); return; }
  log('mapSearch UI OK');

  function hideList() { list.style.display = 'none'; list.innerHTML = ''; }

  const doSearch = (q) => {
    q = (q || '').trim().toLowerCase();
    hideList();
    if (!q) return;

    const hits = centrosDataGlobal
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => {
        const area = (c.codigoArea || c?.detalles?.codigoArea || '').toString().toLowerCase();
        return (c.code || '').toString().toLowerCase().includes(q) ||
               (c.name || c.proveedor || '').toString().toLowerCase().includes(q) ||
               area.includes(q);
      })
      .slice(0, 20);

    if (hits.length === 1) {
      focusCentroInMap(hits[0].idx);
      input.blur();
      return;
    }

    if (!hits.length) {
      list.innerHTML = `<li style="color:#6b7280; padding:8px 12px;">Sin resultados</li>`;
      list.style.display = 'block';
      return;
    }

    list.innerHTML = hits.map(({ c, idx }) => `
      <li data-idx="${idx}" tabindex="0">
        <b>${esc(c.name || c.proveedor || '-')}</b>
        <div style="font-size:12px;color:#374151">
          Código: ${esc(c.code || '—')} · Área: ${esc(c.codigoArea || c?.detalles?.codigoArea || '—')}
        </div>
      </li>
    `).join('');
    list.style.display = 'block';

    Array.from(list.querySelectorAll('li')).forEach(li => {
      const go = () => { const id = +li.getAttribute('data-idx'); focusCentroInMap(id); hideList(); };
      li.onclick = go;
      li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') go(); };
    });
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(input.value); }
    if (e.key === 'Escape') hideList();
  });
  input.addEventListener('input', () => { if (!input.value) hideList(); });
  // click fuera -> ocultar
  document.addEventListener('click', (e) => {
    if (!list.contains(e.target) && e.target !== input) hideList();
  });

  // Helpers debug
  window.__MAPDBG = {
    L, map, setBaseLayer,
    baseLayersDefs,
    centrosSample: () => centrosDataGlobal.slice(0, 3)
  };
}
