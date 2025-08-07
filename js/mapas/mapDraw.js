// js/mapas/mapDraw.js

import { parseNum } from './mapPoints.js';
import { map, centrosGroup, defaultLatLng, baseLayersDefs, crearMapa } from './mapConfig.js';

let currentPolyRef = { poly: null };
let centroPolys = {};

/**
 * Inicializa el mapa con capa ESRI satélite y centrado en Chiloé.
 * Solo llama a la función de mapConfig.js
 */
export function inicializarMapa() {
  return crearMapa();
}

/**
 * Dibuja todos los polígonos de los centros y ajusta los bounds.
 */
export function drawCentrosInMap(centros = [], onPolyClick = null) {
  if (!map) crearMapa();
  if (!centrosGroup) return;

  centrosGroup.clearLayers();
  centroPolys = {};
  let dibujados = 0;

  centros.forEach((c, idx) => {
    // parsea y filtra coordenadas válidas
    const coords = (c.coords || [])
      .map(p => [ parseNum(p.lat), parseNum(p.lng) ])
      .filter(([lat, lng]) => lat !== null && lng !== null);

    if (coords.length < 3) return;

    // calcula sumas y promedios como en tu tabla
    const lines = Array.isArray(c.lines) ? c.lines : [];
    let sumaUnKg = 0, sumaRechazo = 0, sumaRdmto = 0, sumaTons = 0;
    lines.forEach(l => {
      if (!isNaN(+l.unKg))        sumaUnKg     += +l.unKg;
      if (!isNaN(+l.porcRechazo)) sumaRechazo += +l.porcRechazo;
      if (!isNaN(+l.rendimiento)) sumaRdmto   += +l.rendimiento;
      if (!isNaN(+l.tons))        sumaTons     += +l.tons;
    });
    const n = lines.length || 1;
    const promUnKg    = sumaUnKg    / n;
    const promRechazo = sumaRechazo / n;
    const promRdmto   = sumaRdmto   / n;

    const popupHTML = `
      <div style="min-width:170px;font-size:13px;line-height:1.28">
        <div style="font-weight:600;margin-bottom:5px;">${c.name}</div>
        <div><b>Código:</b> ${c.code || '-'}</div>
        <div><b>Hectáreas:</b> ${(c.hectareas||0).toLocaleString('es-CL',{minimumFractionDigits:2})}</div>
        <div><b>Líneas:</b> ${lines.length}</div>
        <div><b>Tons:</b> ${sumaTons.toLocaleString('es-CL')}</div>
        <div><b>Un/Kg:</b> ${promUnKg.toFixed(2)}</div>
        <div><b>% Rechazo:</b> ${promRechazo.toFixed(2)}%</div>
        <div><b>Rdmto:</b> ${promRdmto.toFixed(2)}%</div>
      </div>
    `.trim();

    // crea y añade el polígono
    const poly = L.polygon(coords, {
      color: '#1976d2',
      weight: 3,
      fillOpacity: 0.28
    }).addTo(centrosGroup);

    poly._popupHTML = popupHTML;
    poly.bindPopup(popupHTML);
    poly.on('click', ev => {
      ev.originalEvent && L.DomEvent.stopPropagation(ev);
      poly.isPopupOpen() ? poly.closePopup() : poly.openPopup(ev.latlng);
      if (onPolyClick) onPolyClick(idx);
    });

    centroPolys[idx] = poly;
    dibujados++;
  });

  // Ajusta la vista para que quepa todo
  const all = [];
  centros.forEach(c => (c.coords||[]).forEach(p => {
    const lat = parseNum(p.lat), lng = parseNum(p.lng);
    if (lat !== null && lng !== null) all.push([lat, lng]);
  }));
  if (all.length && map) map.fitBounds(all, { padding: [20,20] });

  console.log(`[mapDraw] Polígonos dibujados: ${dibujados}`);
}

/**
 * Centra el mapa y abre el popup del centro correspondiente.
 */
export function focusCentroInMap(idx) {
  if (!map || !centroPolys[idx]) return;
  const poly = centroPolys[idx];
  map.fitBounds(poly.getBounds(), { padding: [40,40] });
  setTimeout(() => {
    poly.openPopup();
  }, 300);
}
