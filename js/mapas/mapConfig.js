// js/mapas/mapConfig.js
// Crea el mapa, capas base y grupos
export let map = null;
export let puntosIngresoGroup = null;
export let centrosGroup      = null;
export let currentBaseKey    = 'esri';

export const baseLayersDefs = {
  esri: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 20, attribution: 'Imagery © Esri' }
  )
};

export function crearMapa(defaultLatLng = [-42.48, -73.77]) {
  console.log('[mapConfig] crearMapa → defaultLatLng =', defaultLatLng);
  if (map) {
    console.log('[mapConfig] ya existía, devolviendo instancia');
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
    layers: [ baseLayersDefs.esri ]
  });
  console.log('[mapConfig] Leaflet map inicializado:', map);

  // Crear los layer-groups
  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup      = L.layerGroup().addTo(map);
  console.log('[mapConfig] grupos de capas creados');

  // Cuando se muestre la pestaña
  document.querySelectorAll('a[href="#tab-mapa"]').forEach(a =>
    a.addEventListener('click', () => {
      console.log('[mapConfig] pestaña #tab-mapa activa, invalido size');
      setTimeout(() => map.invalidateSize(), 120);
      setTimeout(() => map.invalidateSize(), 400);
    })
  );

  return map;
}

export function setBaseLayer(key) {
  console.log('[mapConfig] setBaseLayer →', key);
  if (!map || !baseLayersDefs[key] || currentBaseKey === key) {
    console.log('[mapConfig] nada que hacer para key=', key);
    return;
  }
  map.removeLayer(baseLayersDefs[currentBaseKey]);
  map.addLayer(baseLayersDefs[key]);
  currentBaseKey = key;
  console.log('[mapConfig] capa base cambiada a', key);
}


