// js/mapas/mapConfig.js
// Crea el mapa, capas base y grupos de capas

export let map = null;
export let puntosIngresoGroup = null;
export let centrosGroup      = null;
export let currentBaseKey    = 'osm';

// Definimos dos capas base: OSM (de prueba) y Esri World Imagery
export const baseLayersDefs = {
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap contributors' }
  ),
  esri: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 20, attribution: 'Imagery © Esri' }
  )
};

/**
 * Inicializa el mapa (si no existe) y los layer-groups.
 * @param {[number,number]} defaultLatLng — vista inicial
 * @returns {L.Map|null}
 */
export function crearMapa(defaultLatLng = [-42.48, -73.77]) {
  console.log('[mapConfig] crearMapa →', defaultLatLng);
  if (map) {
    console.log('[mapConfig] mapa ya inicializado');
    return map;
  }

  const el = document.getElementById('map');
  if (!el) {
    console.error('[mapConfig] ¡#map no encontrado!');
    return null;
  }
  if (el.clientHeight < 50) {
    el.style.minHeight = '400px';
    console.log('[mapConfig] ajustado minHeight a 400px');
  }

  // Arrancamos con la capa OSM para verificar que carga bien
  map = L.map(el, {
    center: defaultLatLng,
    zoom: 10,
    zoomControl: true,
    layers: [ baseLayersDefs.osm ]
  });
  console.log('[mapConfig] Leaflet map creado:', map);

  // Creamos nuestros grupos de capas
  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup      = L.layerGroup().addTo(map);
  console.log('[mapConfig] grupos de puntos y centros creados');

  // Control de cambio de capa base (opcional)
  // Puedes añadir después un control L.control.layers(baseLayersDefs).addTo(map);

  // Reajuste de tamaño al mostrar la pestaña Mapa
  document.querySelectorAll('a[href="#tab-mapa"]').forEach(a =>
    a.addEventListener('click', () => {
      console.log('[mapConfig] pestaña #tab-mapa activa → invalidateSize');
      setTimeout(() => map.invalidateSize(), 120);
      setTimeout(() => map.invalidateSize(), 400);
    })
  );

  return map;
}

/**
 * Cambia la capa base activa a 'osm' o 'esri'.
 * @param {string} key — 'osm' o 'esri'
 */
export function setBaseLayer(key) {
  console.log('[mapConfig] setBaseLayer →', key);
  if (!map || !baseLayersDefs[key] || currentBaseKey === key) {
    console.log('[mapConfig] nada que hacer para baseLayer:', key);
    return;
  }
  map.removeLayer(baseLayersDefs[currentBaseKey]);
  map.addLayer(baseLayersDefs[key]);
  currentBaseKey = key;
  console.log('[mapConfig] baseLayer cambiado a:', key);
}
