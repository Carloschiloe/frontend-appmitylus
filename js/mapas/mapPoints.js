// js/mapas/mapPoints.js
import { puntosIngresoGroup } from './mapConfig.js';
import L from 'leaflet';

let currentPoly = null;

/**
 * Limpia todos los marcadores y polígonos de puntos.
 */
export function clearMapPoints() {
  if (!puntosIngresoGroup) return;
  puntosIngresoGroup.clearLayers();
  currentPoly = null;
}

/**
 * Agrega un marcador al grupo de puntos.
 * @param {number} lat
 * @param {number} lng
 */
export function addPointMarker(lat, lng) {
  if (!puntosIngresoGroup) return;
  L.marker([lat, lng]).addTo(puntosIngresoGroup);
}

/**
 * Dibuja o redibuja un polígono según los puntos en currentPoints.
 * @param {{lat:number,lng:number}[]} currentPoints
 */
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
