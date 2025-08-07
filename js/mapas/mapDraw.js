// js/mapas/mapDraw.js

import { map, centrosGroup, crearMapa, defaultLatLng } from './mapConfig.js';

export function drawCentrosInMap(centros = [], onPolyClick = null) {
  if (!map) crearMapa(defaultLatLng);
  if (!centrosGroup) return;

  centrosGroup.clearLayers();

  centros.forEach((c, idx) => {
    const coords = (c.coords || [])
      .map(p => [parseFloat(p.lat), parseFloat(p.lng)])
      .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));

    if (coords.length < 3) return;

    const popupHTML = `
      <div style="min-width:170px;font-size:13px;line-height:1.28">
        <div style="font-weight:600;margin-bottom:5px;">${c.name || c.proveedor || '-'}</div>
        <div><b>Código:</b> ${c.code || '-'}</div>
        <div><b>Hectáreas:</b> ${(c.hectareas||0).toLocaleString('es-CL',{minimumFractionDigits:2})}</div>
      </div>
    `.trim();

    const poly = L.polygon(coords, {
      color: '#1976d2',
      weight: 3,
      fillOpacity: 0.28
    }).addTo(centrosGroup);

    poly.bindPopup(popupHTML);
    poly.on('click', ev => {
      ev.originalEvent && L.DomEvent.stopPropagation(ev);
      poly.isPopupOpen() ? poly.closePopup() : poly.openPopup(ev.latlng);
      if (onPolyClick) onPolyClick(idx);
    });
  });

  // Ajusta vista
  const all = [];
  centros.forEach(c => (c.coords||[]).forEach(p => {
    const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
    if (!isNaN(lat) && !isNaN(lng)) all.push([lat, lng]);
  }));
  if (all.length) map.fitBounds(all, { padding: [20,20] });
}
