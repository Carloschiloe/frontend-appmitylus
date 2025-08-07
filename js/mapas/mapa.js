// js/mapa.js — gestión completa del mapa y filtro flotante

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

// Datos globales para filtro
let centrosDataGlobal = [];
let filtroSidebar = '';
let selectedCentroIdx = null;

/* =========================
   FILTRO FLOTANTE
   ========================= */
export function initSidebarFiltro() {
  const filtroInput = document.getElementById('filtroSidebar');
  if (!filtroInput) {
    log('No se encontró #filtroSidebar');
    return;
  }
  // Escucha cambios
  filtroInput.addEventListener('input', () => {
    filtroSidebar = filtroInput.value.trim().toLowerCase();
    renderListaSidebar();
  });
  // Render inicial
  renderListaSidebar();
}

function renderListaSidebar() {
  const overlay = document.getElementById('mapFilter');
  if (!overlay) return;

  // Crear o limpiar lista
  let ul = overlay.querySelector('ul.filter-list');
  if (!ul) {
    ul = document.createElement('ul');
    ul.className = 'filter-list';
    overlay.appendChild(ul);
  }

  // Filtrar por proveedor o comuna
  let filtrados = centrosDataGlobal;
  if (filtroSidebar) {
    filtrados = centrosDataGlobal.filter(c =>
      (c.proveedor || '').toLowerCase().includes(filtroSidebar) ||
      (c.comuna    || '').toLowerCase().includes(filtroSidebar)
    );
  }
  filtrados = filtrados.slice(0, 10);

  if (filtrados.length === 0) {
    ul.innerHTML = `<li style="color:#888;">Sin coincidencias</li>`;
    return;
  }

  // Generar items
  ul.innerHTML = filtrados.map(c => {
    const idx = centrosDataGlobal.indexOf(c);
    return `
      <li data-idx="${idx}">
        <b>${c.comuna || '-'}</b><br/>
        <small>${c.proveedor || ''}</small>
      </li>
    `;
  }).join('');

  // Asignar click para centrar
  ul.querySelectorAll('li[data-idx]').forEach(li => {
    li.onclick = () => {
      const idx = +li.dataset.idx;
      focusCentroInMap(idx);
    };
  });
}

/* =========================
   CARGA Y RENDERIZACIÓN
   ========================= */
export function cargarYRenderizarCentros(centros) {
  centrosDataGlobal = centros;
  drawCentrosInMap(centros);
  initSidebarFiltro();
}

/* =========================
   CREACIÓN Y CONFIG MAPA
   ========================= */
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
  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup      = L.layerGroup().addTo(map);

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
    currentPoly = L.polygon(
      currentPoints.map(p => [p.lat, p.lng]),
      { color: 'crimson' }
    ).addTo(puntosIngresoGroup);
  }
}

/* =========================
   DIBUJAR CENTROS EN MAPA
   ========================= */
export function drawCentrosInMap(
  centros = [],
  defaultLatLng = [-42.48, -73.77],
  onPolyClick = null
) {
  if (!map) crearMapa(defaultLatLng);
  centrosGroup.clearLayers();
  centroPolys = {};

  centros.forEach((c, idx) => {
    // Convertir coords
    const coords = (c.coords || [])
      .map(p => [parseNum(p.lat), parseNum(p.lng)])
      .filter(([la, ln]) => la !== null && ln !== null);
    if (coords.length < 3) return;

    // Estadísticas
    let sumaUnKg = 0, sumaRechazo = 0, sumaRdmto = 0, sumaTons = 0;
    let linesConDatos = 0;
    if (Array.isArray(c.lines)) {
      c.lines.forEach(l => {
        if (!isNaN(l.unKg)) {
          sumaUnKg += Number(l.unKg);
          linesConDatos++;
        }
        if (!isNaN(l.porcRechazo)) sumaRechazo += Number(l.porcRechazo);
        if (!isNaN(l.rendimiento)) sumaRdmto += Number(l.rendimiento);
        if (!isNaN(l.tons)) sumaTons += Number(l.tons);
      });
    }
    const promUnKg    = linesConDatos ? sumaUnKg / linesConDatos : 0;
    const promRechazo = linesConDatos ? sumaRechazo / linesConDatos : 0;
    const promRdmto   = linesConDatos ? sumaRdmto / linesConDatos : 0;

    // Popup HTML
    const popupHTML = `
      <div style="min-width:170px;font-size:13px;line-height:1.28">
        <div style="font-weight:600;margin-bottom:5px;">
          ${c.comuna || '-'}
        </div>
        <div><b>Código:</b> ${c.code || '-'}</div>
        <div><b>Hectáreas:</b> ${(+c.hectareas || 0).toLocaleString('es-CL', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}</div>
        <div><b>Líneas:</b> ${c.lines.length}</div>
        <div><b>Tons:</b> ${sumaTons.toLocaleString('es-CL')}</div>
        <div><b>Un/Kg:</b> ${promUnKg.toLocaleString('es-CL', {
          maximumFractionDigits: 2
        })}</div>
        <div><b>% Rechazo:</b> ${promRechazo.toLocaleString('es-CL', {
          maximumFractionDigits: 2
        })}%</div>
        <div><b>Rdmto:</b> ${promRdmto.toLocaleString('es-CL', {
          maximumFractionDigits: 2
        })}%</div>
      </div>
    `.trim();

    // Dibujar polígono
    const poly = L.polygon(coords, {
      color: '#1976d2',
      weight: 3,
      fillOpacity: 0.28
    }).addTo(centrosGroup);

    poly.bindPopup(popupHTML);
    poly.on('click', ev => {
      L.DomEvent.stopPropagation(ev);
      poly.openPopup(ev.latlng);
      if (onPolyClick) onPolyClick(idx);
    });

    centroPolys[idx] = poly;
  });

  // Centrar vista en todos
  const allCoords = [];
  centros.forEach(c =>
    (c.coords || []).forEach(p => {
      const la = parseNum(p.lat), ln = parseNum(p.lng);
      if (la !== null && ln !== null) allCoords.push([la, ln]);
    })
  );
  if (allCoords.length) map.fitBounds(allCoords, { padding: [20, 20] });
  else map.setView(defaultLatLng, 10);

  // Refrescar filtro después de dibujar
  renderListaSidebar();
}

/* =========================
   CENTRAR UN CENTRO
   ========================= */
export function focusCentroInMap(idx) {
  const poly = centroPolys[idx];
  if (!poly) return;
  map.fitBounds(poly.getBounds(), { maxZoom: 16 });
  poly.openPopup(poly.getBounds().getCenter());
}
