// js/mapas/mapa.js
let map;
let puntosIngresoGroup;
let centrosGroup;
let currentPoly = null;
let centroPolys = {};
let centroTooltips = {};
let windowCentrosDebug = [];

const CHILOE_COORDS = [-42.65, -73.99];
const CHILOE_ZOOM = 10;
const LABEL_ZOOM = 13; // mostrar etiquetas solo desde este zoom

// ===== Logging =====
const LOG = true;
const log = (...a) => LOG && console.log('[MAP]', ...a);
const logWarn = (...a) => LOG && console.warn('[MAP]', ...a);
const logErr = (...a) => LOG && console.error('[MAP]', ...a);
const group = (title, fn) => {
  if (!LOG) return fn();
  console.group('[MAP]', title);
  try { fn(); } finally { console.groupEnd(); }
};

const parseNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitle = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

// -------- Bases de tiles
const MAPBOX_TOKEN = 'pk.eyJ1IjoiY2FybG9zY2hpbG9lIiwiYSI6ImNtZTB3OTZmODA5Mm0ya24zaTQ1bGd3aW4ifQ.XElNIT02jDuetHpo4r_-3g';
const baseLayersDefs = {
  mapboxSat: L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
    {
      maxZoom: 19,
      tileSize: 512,
      zoomOffset: -1,
      attribution: '© Mapbox, © OpenStreetMap, © Maxar'
    }
  ),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }),
  esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '© Esri'
  }),
  carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© CARTO'
  })
};

// 👉 Arranca con OSM (evita el gris si Mapbox falla)
let currentBaseKey = 'osm';

// -------- Datos para sidebar y búsqueda
let centrosDataGlobal = [];
let filtroSidebar = '';
let selectedCentroIdx = null;

// ===== Utils de diagnóstico
function diagMap() {
  const tab = document.getElementById('tab-mapa');
  const shell = document.getElementById('mapShell');
  const mapDiv = document.getElementById('map');
  const tilesOk = !!document.querySelector('#map .leaflet-tile');
  const d = {
    leaflet_version: L?.version || '(?)',
    currentBaseKey,
    tab_display: tab ? getComputedStyle(tab).display : '(no-tab)',
    shell_wh: shell ? [shell.clientWidth, shell.clientHeight] : '(no-shell)',
    map_wh: mapDiv ? [mapDiv.clientWidth, mapDiv.clientHeight] : '(no-map)',
    tilesOk
  };
  log('diag →', d);
  return d;
}

// ===== Sidebar mini
export function initSidebarFiltro() {
  const filtroInput = document.getElementById('filtroSidebar');
  const listaSidebar = document.getElementById('listaCentrosSidebar');
  const sidebar = document.getElementById('sidebarCentros');
  const toggleBtn = document.getElementById('toggleSidebar');
  const icon = document.getElementById('toggleSidebarIcon');
  if (!filtroInput || !listaSidebar || !sidebar || !toggleBtn || !icon) {
    logWarn('Sidebar no encontrada (ok si no la usas en móvil).');
    return;
  }

  filtroInput.addEventListener('input', () => { filtroSidebar = filtroInput.value.trim().toLowerCase(); renderListaSidebar(); });
  toggleBtn.onclick = () => {
    sidebar.classList.toggle('minimized');
    if (sidebar.classList.contains('minimized')) { document.body.classList.add('sidebar-minimized'); icon.textContent = "chevron_right"; }
    else { document.body.classList.remove('sidebar-minimized'); icon.textContent = "chevron_left"; }
    setTimeout(() => map?.invalidateSize(), 350);
  };

  renderListaSidebar();
  log('Sidebar filtro inicializada.');
}
function renderListaSidebar() {
  const lista = document.getElementById('listaCentrosSidebar');
  if (!lista) return;
  let arr = centrosDataGlobal;
  if (filtroSidebar) {
    arr = arr.filter(c =>
      (c.proveedor || '').toLowerCase().includes(filtroSidebar) ||
      (c.name || '').toLowerCase().includes(filtroSidebar)
    );
  }
  arr = arr.slice(0, 10);
  if (!arr.length) { lista.innerHTML = `<li style="color:#888;">Sin coincidencias</li>`; return; }
  lista.innerHTML = arr.map(c => {
    const idx = centrosDataGlobal.indexOf(c);
    return `<li data-idx="${idx}" class="${selectedCentroIdx===idx?'selected':''}" tabindex="0">
      <b>${esc(c.name || c.proveedor || '-')}</b>
      <span class="proveedor">${esc(c.proveedor || '')}</span></li>`;
  }).join('');
  Array.from(lista.querySelectorAll('li')).forEach(li => {
    li.onclick = li.onkeydown = (e) => {
      if (e.type==='click' || e.key==='Enter' || e.key===' ') {
        const idx = +li.getAttribute('data-idx'); selectedCentroIdx = idx; focusCentroInMap(idx); renderListaSidebar();
      }
    };
  });
}

export function cargarYRenderizarCentros(centros) {
  centrosDataGlobal = centros || [];
  log('cargarYRenderizarCentros →', { total: centrosDataGlobal.length });
  drawCentrosInMap(centrosDataGlobal);
  renderListaSidebar();
  updateLabelVisibility(); // visibilidad inicial
}

// ===== Modal desde mapa
function buildCentroDetallesHtml(c) {
  const d = (c.detalles && typeof c.detalles === 'object') ? c.detalles : {};
  const flatten = { ...d };
  if (d.resSSP) { if (d.resSSP.numero) flatten.numeroResSSP = d.resSSP.numero; if (d.resSSP.fecha) flatten.fechaResSSP = d.resSSP.fecha; }
  if (d.resSSFFAA) { if (d.resSSFFAA.numero) flatten.numeroResSSFFAA = d.resSSFFAA.numero; if (d.resSSFFAA.fecha) flatten.fechaResSSFFAA = d.resSSFFAA.fecha; }
  const fmtDate = v => { if (!v) return ''; const s=String(v); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const D=new Date(s); return Number.isNaN(D.getTime())?s:D.toISOString().slice(0,10); };

  const LABELS = { region:'Región', codigoArea:'Código Área', ubicacion:'Ubicación', grupoEspecie:'Grupo Especie', especies:'Especies', tonsMax:'Tons Máx',
    numeroResSSP:'N° ResSSP', fechaResSSP:'Fecha ResSSP', numeroResSSFFAA:'N° ResSSFFAA', fechaResSSFFAA:'Fecha ResSSFFAA', rutTitular:'RUT Titular', nroPert:'Nro. Pert' };
  const pk = k => LABELS[k] || k.replace(/([A-Z])/g,' $1').replace(/^./,m=>m.toUpperCase());

  let html = `<table class="striped"><tbody>
    <tr><th>Titular</th><td>${esc(toTitle(c.name || c.proveedor || ''))}</td></tr>
    <tr><th>Proveedor</th><td>${esc(toTitle(c.proveedor || ''))}</td></tr>
    <tr><th>Comuna</th><td>${esc(toTitle(c.comuna || ''))}</td></tr>
    <tr><th>Código</th><td>${esc(c.code || '')}</td></tr>
    <tr><th>Hectáreas</th><td>${c.hectareas ?? ''}</td></tr>`;
  ['region','codigoArea','ubicacion','grupoEspecie','especies','tonsMax'].forEach(k=>{
    let v=c[k]; if (k==='especies' && Array.isArray(c.especies)) v=c.especies.join(', ');
    if (v!==undefined && v!==null && String(v)!=='') html+=`<tr><th>${pk(k)}</th><td>${esc(String(v))}</td></tr>`;
  });
  html += `</tbody></table>`;

  const order = ['rutTitular','nroPert','numeroResSSP','fechaResSSP','numeroResSSFFAA','fechaResSSFFAA'];
  const rows=[]; order.forEach(k=>{ const v=flatten[k]; if (v!==undefined && v!==null && String(v)!=='') rows.push([k,k.startsWith('fecha')?fmtDate(v):v]); });
  Object.keys(flatten).filter(k=>!order.includes(k) && flatten[k]!=='' && flatten[k]!=null).sort().forEach(k=>rows.push([k,flatten[k]]));
  if (rows.length) {
    html+=`<h6 style="margin-top:1.5em;">Detalles</h6><table class="striped"><tbody>`;
    rows.forEach(([k,v])=> html+=`<tr><th>${pk(k)}</th><td>${esc(String(v))}</td></tr>`);
    html+=`</tbody></table>`;
  }
  if (Array.isArray(c.coords) && c.coords.length) {
    html+=`<h6 style="margin-top:1.5em;">Coordenadas</h6><table class="striped">
      <thead><tr><th>#</th><th>Lat</th><th>Lng</th></tr></thead><tbody>`;
    c.coords.forEach((p,i)=> {
      const latStr = Number.isFinite(p?.lat) ? Number(p.lat).toFixed(6) : (p?.lat ?? '');
      const lngStr = Number.isFinite(p?.lng) ? Number(p.lng).toFixed(6) : (p?.lng ?? '');
      html+=`<tr><td>${i+1}</td><td>${latStr}</td><td>${lngStr}</td></tr>`;
    });
    html+=`</tbody></table>`;
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

// ===== Crear mapa + observadores de tamaño/visibilidad
export function crearMapa(defaultLatLng = CHILOE_COORDS, defaultZoom = CHILOE_ZOOM) {
  if (map) { log('crearMapa(): ya existe, reuse.'); return map; }
  const el = document.getElementById('map');
  if (!el) { logErr('crearMapa(): #map no existe'); return null; }

  const baseInicial = baseLayersDefs[currentBaseKey] || baseLayersDefs.osm;

  group('crearMapa()', () => {
    log('baseInicial:', currentBaseKey);
  });

  map = L.map(el, {
    preferCanvas: true,
    zoomControl: true,
    center: defaultLatLng,
    zoom: defaultZoom,
    layers: [baseInicial]
  });
  window.__mapLeaflet = map;

  // Eventos útiles
  map.on('layeradd', e => log('layeradd:', e?.layer?.options?.attribution || e?.layer?.options));
  map.on('layerremove', e => log('layerremove:', e?.layer?.options?.attribution || e?.layer?.options));
  map.on('zoomend', () => {
    log('zoomend → zoom:', map.getZoom());
    updateLabelVisibility();
  });

  // Listeners de tiles (todas las bases)
  Object.entries(baseLayersDefs).forEach(([key, layer]) => {
    layer?.on?.('tileloadstart', ev => log('tileloadstart', key, ev?.tile?.src?.slice(0,80) || ''));
    layer?.on?.('tileload', () => log('tileload OK', key));
    layer?.on?.('tileerror', ev => logWarn('tileerror', key, ev?.tile?.src?.slice(0,80) || ''));
  });

  // Si por X razón la capa no quedó, fuerza OSM
  if (!map.hasLayer(baseInicial)) {
    logWarn('Base inicial no montada, forzando OSM…');
    baseLayersDefs.osm.addTo(map);
    currentBaseKey = 'osm';
  }

  // Fallback automático si la base tira errores (una sola vez)
  let _baseFailedOnce = false;
  Object.entries(baseLayersDefs).forEach(([key, layer]) => {
    layer?.on?.('tileerror', () => {
      if (!_baseFailedOnce && map) {
        _baseFailedOnce = true;
        try { Object.values(baseLayersDefs).forEach(l => { try { map.removeLayer(l); } catch {} }); } catch {}
        baseLayersDefs.osm.addTo(map);
        currentBaseKey = 'osm';
        setTimeout(() => map.invalidateSize(), 50);
        logWarn(`tileerror en base "${key}" → fallback a OSM`);
      }
    });
  });

  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup = L.layerGroup().addTo(map);

  // Observadores para tamaño/visibilidad
  (function attachObservers(){
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    const ro = new ResizeObserver(() => {
      log('ResizeObserver → mapEl:', [mapEl.clientWidth, mapEl.clientHeight]);
      if (mapEl.clientHeight > 0) map.invalidateSize();
    });
    ro.observe(mapEl);

    const tab = document.getElementById('tab-mapa');
    if (tab) {
      const mo = new MutationObserver(() => {
        const visible = getComputedStyle(tab).display !== 'none' && tab.offsetParent !== null;
        log('MutationObserver(tab) visible=', visible);
        if (visible) setTimeout(() => map.invalidateSize(), 60);
      });
      mo.observe(tab, { attributes:true, attributeFilter:['style','class'] });
    }

    if (location.hash === '#tab-mapa') {
      log('Hash abre tab-mapa → invalidateSize()');
      setTimeout(() => map.invalidateSize(), 80);
    }

    window.addEventListener('resize', () => {
      log('window.resize → invalidateSize()');
      map.invalidateSize();
    });
    document.querySelectorAll('a[href="#tab-mapa"]').forEach(a =>
      a.addEventListener('click', () => {
        log('<a #tab-mapa> click → invalidateSize()');
        setTimeout(() => map.invalidateSize(), 80);
      })
    );
  })();

  diagMap();
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
      diagMap();
    } catch (e) {
      logErr('setBaseLayer error → fallback OSM:', e);
      baseLayersDefs.osm.addTo(map);
      currentBaseKey = 'osm';
    }
  });
}

// ===== Puntos manuales
export function clearMapPoints(){ if (!puntosIngresoGroup) return; puntosIngresoGroup.clearLayers(); currentPoly=null; }
export function addPointMarker(lat,lng){ if (!puntosIngresoGroup) return; L.marker([lat,lng]).addTo(puntosIngresoGroup); }
export function redrawPolygon(currentPoints=[]){
  if (currentPoly){ puntosIngresoGroup.removeLayer(currentPoly); currentPoly=null; }
  if (currentPoints.length>=3){ currentPoly=L.polygon(currentPoints.map(p=>[p.lat,p.lng]),{color:'crimson'}).addTo(puntosIngresoGroup); }
}

// ===== Dibujar centros (con etiquetas condicionadas por zoom)
export function drawCentrosInMap(centros=[], defaultLatLng=CHILOE_COORDS, onPolyClick=null) {
  if (!map) crearMapa(defaultLatLng);
  if (!centrosGroup) return;

  centros = Array.isArray(centros) ? centros : [];
  windowCentrosDebug = centros.slice();
  centrosGroup.clearLayers();
  centroPolys = {};
  centroTooltips = {};

  let dib = 0;
  let filtrados = 0;

  group('drawCentrosInMap()', () => {
    log('total recibidos:', centros.length);
    centros.forEach((c, idx) => {
      const coords = (c.coords||[])
        .map(p=>[parseNum(p.lat), parseNum(p.lng)])
        .filter(([la,ln])=>la!==null && ln!==null);

      if (coords.length<3) { filtrados++; return; }

      const poly = L.polygon(coords, { color:'#1976d2', weight:3, fillOpacity:.28 }).addTo(centrosGroup);

      const titular = c.name || c.proveedor || '—';
      const codigo  = c.code || '—';
      const labelHtml = `<div class="centro-label-inner"><div class="titular">${esc(titular)}</div><div class="codigo">Código: ${esc(codigo)}</div></div>`;
      poly.bindTooltip(labelHtml, { permanent:true, direction:'center', opacity:0.95, className:'centro-label' });

      centroTooltips[idx] = poly.getTooltip();

      poly.on('click', (ev) => { ev?.originalEvent && L.DomEvent.stopPropagation(ev); openCentroModal(c); onPolyClick && onPolyClick(idx); });

      centroPolys[idx] = poly;
      dib++;
    });

    log('dibujados:', dib, 'filtrados(sin 3 pts):', filtrados);
  });

  centrarMapaEnPoligonos(centros, defaultLatLng);
  setTimeout(()=>map.invalidateSize(), 60);
  setTimeout(()=>map.invalidateSize(), 300);
  updateLabelVisibility();

  log('Redibujados centros =', dib);
}

export function updateLabelVisibility() {
  if (!map) return;
  const show = map.getZoom() >= LABEL_ZOOM;
  const total = Object.values(centroTooltips).length;
  Object.values(centroTooltips).forEach(t => {
    const el = t?.getElement?.();
    if (el) el.style.display = show ? 'block' : 'none';
  });
  log('updateLabelVisibility → zoom:', map.getZoom(), 'showLabels:', show, 'tooltips:', total);
}

export function centrarMapaEnPoligonos(centros=[], defaultLatLng=CHILOE_COORDS) {
  if (!map) return;
  const all=[];
  centros.forEach(c => (c.coords||[]).forEach(p => {
    const la=parseNum(p.lat), ln=parseNum(p.lng);
    if(la!==null && ln!==null) all.push([la,ln]);
  }));
  if (all.length) {
    try {
      map.fitBounds(all, { padding:[20,20], maxZoom:CHILOE_ZOOM });
      log('fitBounds con puntos:', all.length);
    } catch (e) {
      logErr('fitBounds error:', e);
      map.setView(defaultLatLng, CHILOE_ZOOM);
    }
  } else {
    logWarn('Sin puntos → setView default');
    map.setView(defaultLatLng, CHILOE_ZOOM);
  }
}

export function focusCentroInMap(idx) {
  const poly = centroPolys[idx]; if (!poly) return;
  map.fitBounds(poly.getBounds(), { maxZoom: 16 });
  const t = centroTooltips[idx]?.getElement?.(); if (t) t.style.display = 'block';
  poly.setStyle({ color:'#ff9800', weight:5 }); setTimeout(()=>poly.setStyle({color:'#1976d2', weight:3}),1000);
}

// ===== Buscador flotante
function initMapSearchUI() {
  const input = document.getElementById('mapSearch');
  const list  = document.getElementById('mapSearchResults');
  if (!input || !list) { logWarn('mapSearch UI no encontrado'); return; }
  log('mapSearch UI OK');

  const doSearch = (q) => {
    q = (q || '').trim().toLowerCase();
    list.innerHTML = '';
    list.style.display = 'none';
    if (!q) return;

    const hits = centrosDataGlobal
      .map((c, idx) => ({ c, idx }))
      .filter(({c}) => {
        const area = (c.codigoArea || c?.detalles?.codigoArea || '').toString().toLowerCase();
        return (c.code || '').toString().toLowerCase().includes(q) ||
               (c.name || c.proveedor || '').toString().toLowerCase().includes(q) ||
               area.includes(q);
      })
      .slice(0, 20);

    log('search:', q, 'hits:', hits.length);

    if (hits.length === 1) {
      focusCentroInMap(hits[0].idx);
      input.blur();
    } else if (hits.length > 0) {
      list.innerHTML = hits.map(({c, idx}) => `
        <li data-idx="${idx}" tabindex="0">
          <b>${(c.name || c.proveedor || '-')}</b>
          <div style="font-size:12px;color:#374151">
            Código: ${(c.code || '—')} · Área: ${(c.codigoArea || c?.detalles?.codigoArea || '—')}
          </div>
        </li>
      `).join('');
      list.style.display = 'block';

      Array.from(list.querySelectorAll('li')).forEach(li => {
        li.onclick = li.onkeydown = (e) => {
          if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') {
            const idx = +li.getAttribute('data-idx');
            focusCentroInMap(idx);
            list.style.display = 'none';
          }
        };
      });
    } else {
      list.innerHTML = `<li style="color:#6b7280;">Sin resultados</li>`;
      list.style.display = 'block';
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch(input.value);
    }
  });

  input.addEventListener('input', () => {
    if (!input.value) { list.style.display = 'none'; list.innerHTML = ''; }
  });

  // Exponer helpers para inspección rápida
  window.__MAPDBG = {
    L, map, baseLayersDefs, setBaseLayer,
    centrosDataGlobal: () => centrosDataGlobal.slice(0,3),
    diag: diagMap
  };
}
