// js/mapas/mapConfig.js

export let map = null;
export let puntosIngresoGroup = null;
export let centrosGroup      = null;
export const defaultLatLng = [-42.50, -73.80];

const esriUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const baseLayersDefs = {
  esri: L.tileLayer(esriUrl, {
    maxZoom: 20,
    attribution: 'Imagery © Esri'
  })
};

export function crearMapa(defaultLatLngParam = defaultLatLng) {
  console.log('[mapConfig] crearMapa → centrar en', defaultLatLngParam);

  // ¡Esto es LO CRUCIAL!
  if (map) {
    map.remove();
    map = null;
  }

  const el = document.getElementById('map');
  if (!el) {
    console.error('[mapConfig] No se encontró el elemento #map');
    return null;
  }
  if (el.clientHeight < 50) el.style.minHeight = '400px';

  map = L.map(el, {
    center: defaultLatLngParam,
    zoom: 10,
    layers: [baseLayersDefs.esri]
  });

  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup      = L.layerGroup().addTo(map);

  window.map = map;
  console.log('[mapConfig] Mapa creado');
  return map;
}
