// js/mapas/mapPoints.js

import { puntosIngresoGroup } from './mapConfig.js';

export function clearMapPoints() {
  if (!puntosIngresoGroup) return;
  puntosIngresoGroup.clearLayers();
}

export function addPointMarker(lat, lng) {
  if (!puntosIngresoGroup) return;
  L.marker([lat, lng]).addTo(puntosIngresoGroup);
}

export function redrawPolygon(currentPoints = [], currentPolyRef) {
  if (currentPolyRef?.poly) {
    puntosIngresoGroup.removeLayer(currentPolyRef.poly);
    currentPolyRef.poly = null;
  }
  if (currentPoints.length >= 3) {
    currentPolyRef.poly = L.polygon(
      currentPoints.map(p => [p.lat, p.lng]),
      { color: 'crimson' }
    ).addTo(puntosIngresoGroup);
  }
}
