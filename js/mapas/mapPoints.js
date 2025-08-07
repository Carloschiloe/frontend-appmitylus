// js/mapas/mapPoints.js

export const parseNum = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export function clearMapPoints(puntosIngresoGroup) {
  if (!puntosIngresoGroup) return;
  puntosIngresoGroup.clearLayers();
}

export function addPointMarker(lat, lng, puntosIngresoGroup) {
  if (!puntosIngresoGroup) return;
  L.marker([parseNum(lat), parseNum(lng)]).addTo(puntosIngresoGroup);
}

export function redrawPolygon(currentPoints = [], puntosIngresoGroup, currentPolyRef) {
  if (currentPolyRef.poly) {
    puntosIngresoGroup.removeLayer(currentPolyRef.poly);
    currentPolyRef.poly = null;
  }
  if (currentPoints.length >= 3) {
    currentPolyRef.poly = L.polygon(
      currentPoints.map(p => [parseNum(p.lat), parseNum(p.lng)]),
      { color: 'crimson' }
    ).addTo(puntosIngresoGroup);
  }
}
