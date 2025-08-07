// js/mapas/mapPoints.js

import { puntosIngresoGroup } from './mapConfig.js';

let currentPoly = null;

export function clearMapPoints() {
  if (!puntosIngresoGroup) return;
  puntosIngresoGroup.clearLayers();
  currentPoly = null;
}

export function addPointMarker(lat, lng) {
  if (!puntosIngresoGroup) return;
  L.marker([lat, lng]).addTo(puntosIngresoGroup);
}

export function redrawPolygon(currentPoints = []) {
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
  }
}

