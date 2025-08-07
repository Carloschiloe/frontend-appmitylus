// js/mapas/mapConfig.js
// Crea el mapa, capas base y grupos de capas

export let map = null;
export let puntosIngresoGroup = null;
export let centrosGroup = null;
export let currentBaseKey = 'esri';

export const baseLayersDefs = {
  esri: L.tileLayer(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 20, attribution: 'Imagery © Esri' }
  )
};

/**
 * Inicializa el mapa (si no existe) y los layer-groups.
 * @param {[number,number]} defaultLatLng
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

  map = L.map(el, {
    center: defaultLatLng,
    zoom: 10,
    zoomControl: true,
    layers: [baseLayersDefs.esri]
  });
  console.log('[mapConfig] Leaflet map creado:', map);

  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup      = L.layerGroup().addTo(map);
  console.log('[mapConfig] grupos puntosIngresoGroup y centrosGroup creados');

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
 * Cambia la capa base (esri, etc).
 * @param {string} key
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
