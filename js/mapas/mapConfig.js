// js/mapas/mapConfig.js

export let map = null;
export let puntosIngresoGroup = null;
export let centrosGroup = null;
export let currentBaseKey = 'esri';

// Usa el global L que viene del <script src="…leaflet.js">
export const baseLayersDefs = {
  esri: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 20, attribution: 'Imagery © Esri' }
  )
};

export function crearMapa(defaultLatLng = [-42.48, -73.77]) {
  if (map) return map;
  const el = document.getElementById('map');
  if (!el) {
    console.error('[mapConfig] #map no encontrado');
    return null;
  }
  if (el.clientHeight < 50) el.style.minHeight = '400px';

  map = L.map(el, {
    zoomControl: true,
    center: defaultLatLng,
    zoom: 10,
    layers: [ baseLayersDefs.esri ]
  });

  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup      = L.layerGroup().addTo(map);

  console.log('[mapConfig] Mapa inicializado');
  return map;
}

export function setBaseLayer(key) {
  if (!map || !baseLayersDefs[key] || currentBaseKey === key) return;
  map.removeLayer(baseLayersDefs[currentBaseKey]);
  map.addLayer(baseLayersDefs[key]);
  currentBaseKey = key;
  console.log('[mapConfig] Capa base ->', key);
}
