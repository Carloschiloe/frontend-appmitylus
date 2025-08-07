// js/mapas/mapConfig.js

export let map = null;
export let puntosIngresoGroup = null;
export let centrosGroup      = null;
export const defaultLatLng = [-42.50, -73.80];

/**
 * SOLO OpenStreetMap (OSM), 100% confiable.
 */
export const baseLayersDefs = {
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }
  )
};

/**
 * Inicializa el mapa solo con OSM.
 * @param {[number,number]} defaultLatLngParam — vista inicial (Chiloé)
 * @returns {L.Map|null}
 */
export function crearMapa(defaultLatLngParam = defaultLatLng) {
  console.log('[mapConfig] crearMapa → solo OpenStreetMap', defaultLatLngParam);

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

  // Mapa SOLO con OSM
  map = L.map(el, {
    center: defaultLatLngParam,
    zoom: 10,
    layers: [baseLayersDefs.osm]
  });

  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup      = L.layerGroup().addTo(map);

  window.map = map; // Debug en consola

  console.log('[mapConfig] Mapa creado con OSM');
  return map;
}
