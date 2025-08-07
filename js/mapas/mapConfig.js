// js/mapas/mapConfig.js
// -------------------------------------
// Configuración del mapa y capa satelital
// -------------------------------------

export let map = null;
export let puntosIngresoGroup = null;
export let centrosGroup      = null;

// Coordenadas de Chiloé (ajusta si quieres otra vista inicial)
export const defaultLatLng = [-42.50, -73.80];

/**
 * Definición de capas base
 * Exporta como objeto para compatibilidad con otros módulos.
 */
const esriUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const baseLayersDefs = {
  esri: L.tileLayer(esriUrl, {
    maxZoom: 20,
    attribution: 'Imagery © Esri'
  })
};

/**
 * Inicializa el mapa (si aún no existe), los layer-groups, y
 * arranca en la capa satelital de Esri, centrado en Chiloé.
 * Si ya existe, destruye el mapa anterior para evitar el error de Leaflet.
 * @param {[number,number]} defaultLatLngParam — vista inicial (Chiloé)
 * @returns {L.Map|null}
 */
export function crearMapa(defaultLatLngParam = defaultLatLng) {
  console.log('[mapConfig] crearMapa → centrar en', defaultLatLngParam);

  // Destruye el mapa anterior si existe para evitar el error "container is already initialized"
  if (map) {
    map.remove();
    map = null;
  }

  const el = document.getElementById('map');
  if (!el) {
    console.error('[mapConfig] No se encontró el elemento #map');
    return null;
  }
  // Asegura un alto mínimo para que el mapa sea visible
  if (el.clientHeight < 50) el.style.minHeight = '400px';

  // Crea el mapa con la capa ESRI satelital
  map = L.map(el, {
    center: defaultLatLngParam,
    zoom: 10,
    layers: [baseLayersDefs.esri]
  });

  // Grupos para puntos de ingreso y centros
  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup      = L.layerGroup().addTo(map);

  window.map = map; // Para debugging en consola

  console.log('[mapConfig] Mapa creado');
  return map;
}
