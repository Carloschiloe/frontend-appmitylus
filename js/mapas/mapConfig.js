// js/mapas/mapConfig.js

export let map = null;
export let puntosIngresoGroup = null;
export let centrosGroup = null;

export const defaultLatLng = [-42.50, -73.80];

// Capa base OSM (puedes poner ESRI si tienes acceso y no hay restricción de uso)
export const baseLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 20, attribution: 'Map data © OpenStreetMap contributors' }
);

export function crearMapa(center = defaultLatLng) {
  if (map) return map;
  const el = document.getElementById('map');
  if (!el) {
    console.error('[mapConfig] No se encontró #map');
    return null;
  }
  map = L.map(el, {
    center,
    zoom: 10,
    layers: [baseLayer]
  });
  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup = L.layerGroup().addTo(map);
  return map;
}
