// js/mapas/mapPoints.js
// Manejo de puntos y polígonos de formulario

import { puntosIngresoGroup } from './mapConfig.js';

let currentPoly = null;

export function clearMapPoints() {
  console.log('[mapPoints] clearMapPoints()');
  if (!puntosIngresoGroup) return;
  puntosIngresoGroup.clearLayers();
  currentPoly = null;
}

export function addPointMarker(lat, lng) {
  console.log('[mapPoints] addPointMarker →', lat, lng);
  if (!puntosIngresoGroup) return;
  L.marker([lat, lng]).addTo(puntosIngresoGroup);
}

export function redrawPolygon(currentPoints = []) {
  console.log('[mapPoints] redrawPolygon → puntos =', currentPoints.length);
  if (!puntosIngresoGroup) return;
  if (currentPoly) {
    puntosIngresoGroup.removeLayer(currentPoly);
    currentPoly = null;
  }
  if (currentPoints.length >= 3) {
    currentPoly = L.polygon(
      currentPoints.map(p => [p.lat, p.lng]),
      { color: 'crimson' }
    ).addTo(puntosIngresoGroup);
    console.log('[mapPoints] polígono dibujado con', currentPoints.length, 'puntos');
  }
}
