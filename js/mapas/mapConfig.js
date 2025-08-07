// js/mapas/mapConfig.js
// -------------------------------------
// Configuración del mapa y capa satelital
// -------------------------------------

export let map = null;
export let puntosIngresoGroup = null;
export let centrosGroup      = null;

/**
 * Capa base única: Esri World Imagery (satélite).
 * Ruta oficial de teselas de Esri.
 */
const esriUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const baseLayer = L.tileLayer(esriUrl, {
  maxZoom: 20,
  attribution: 'Imagery © Esri'
});

/**
 * Inicializa el mapa (si aún no existe), los layer-groups, y
 * arranca en la capa satelital de Esri, centrado en Chiloé.
 * @param {[number,number]} defaultLatLng — vista inicial (Chiloé)
 * @returns {L.Map|null}
 */
export function crearMapa(defaultLatLng = [-42.50, -73.80]) {
  console.log('[mapConfig] crearMapa → centrar en', defaultLatLng);

  if (map) {
    console.log('[mapConfig] mapa ya inicializado');
    return map;
  }

  const el = document.getElementById('map');
  if (!el) {
    console.error('[mapConfig] ¡#map no encontrado!');
    return null;
  }
  // Asegura un mínimo de altura
  if (el.clientHeight < 50) {
    el.style.minHeight = '400px';
  }

  // Crea el mapa con la capa satelital
  map = L.map(el, {
    center: defaultLatLng,
    zoom: 10,
    layers: [ baseLayer ],
    zoomControl: true
  });
  console.log('[mapConfig] Leaflet map creado en satélite:', map);

  // Grupos para puntos y polígonos
  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup      = L.layerGroup().addTo(map);

  // Al hacer click en la pestaña Mapa, forzar redraw
  document.querySelectorAll('a[href="#tab-mapa"]').forEach(a =>
    a.addEventListener('click', () => {
      console.log('[mapConfig] pestaña #tab-mapa activa → invalidateSize');
      setTimeout(() => map.invalidateSize(), 120);
      setTimeout(() => map.invalidateSize(), 400);
    })
  );

  return map;
}

// Para que puedas probar desde la consola:
if (typeof window !== 'undefined') {
  window.crearMapa = crearMapa;
}
