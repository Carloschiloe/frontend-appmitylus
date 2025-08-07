// js/mapas/mapDraw.js

import { crearMapa, centrosGroup } from './mapConfig.js';
import { setFilterData }            from './mapFilter.js';
import { parseOneDMS }              from '../core/utilidades.js';  // tu utilitario DMS

/**
 * Intenta parsear un número decimal; devuelve null si no es válido.
 */
const parseNum = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Si la cadena contiene “N/S/E/W”, usa parseOneDMS,
 * si no, cae a parseNum.
 */
function parseCoord(v) {
  if (typeof v === 'string' && /[NSnsEWew]/.test(v)) {
    return parseOneDMS(v);
  }
  return parseNum(v);
}

export const centroPolys = {};

/**
 * Dibuja todos los centros como polígonos en el mapa y bind de popups.
 * @param {Array} centros — array de objetos con coords, comuna, proveedor, code, hectareas, lines
 * @param {[number,number]} defaultLatLng — vista inicial si no hay coords válidas
 * @param {Function|null} onPolyClick — callback al click en cada polígono
 */
export function drawCentrosInMap(
  centros = [],
  defaultLatLng = [-42.48, -73.77],
  onPolyClick = null
) {
  const map = crearMapa(defaultLatLng);
  // sincroniza los datos para el filtro flotante
  setFilterData(centros);

  // limpia la capa y el cache
  centrosGroup.clearLayers();
  Object.keys(centroPolys).forEach(k => delete centroPolys[k]);

  // recorre cada centro
  centros.forEach((c, idx) => {
    // construir arreglo de [lat, lng] válidos
    const coords = (c.coords || [])
      .map(p => [ parseCoord(p.lat), parseCoord(p.lng) ])
      .filter(([la, ln]) => la !== null && ln !== null);

    if (coords.length < 3) return;  // necesita al menos 3 puntos

    // calcular sumas y promedios (igual que en tu tabla)
    let sumaUnKg = 0, sumaRech = 0, sumaRdm = 0, sumaTons = 0, count = 0;
    (c.lines || []).forEach(l => {
      if (!isNaN(l.unKg))         { sumaUnKg  += Number(l.unKg);   count++; }
      if (!isNaN(l.porcRechazo))  { sumaRech  += Number(l.porcRechazo); }
      if (!isNaN(l.rendimiento))  { sumaRdm   += Number(l.rendimiento); }
      if (!isNaN(l.tons))         { sumaTons  += Number(l.tons); }
    });
    const promUnKg = count ? sumaUnKg / count : 0;
    const promRech = count ? sumaRech / count : 0;
    const promRdm  = count ? sumaRdm / count : 0;

    // HTML del popup
    const popupHTML = `
      <div style="min-width:170px;font-size:13px;line-height:1.28">
        <div style="font-weight:600;margin-bottom:5px;">
          ${c.comuna || '-'}
        </div>
        <div><b>Código:</b> ${c.code || '-'}</div>
        <div><b>Hectáreas:</b> ${( +c.hectareas || 0 ).toLocaleString('es-CL',{
          minimumFractionDigits:2, maximumFractionDigits:2
        })}</div>
        <div><b>Líneas:</b> ${(c.lines||[]).length}</div>
        <div><b>Tons:</b> ${sumaTons.toLocaleString('es-CL')}</div>
        <div><b>Un/Kg:</b> ${promUnKg.toLocaleString('es-CL',{maximumFractionDigits:2})}</div>
        <div><b>% Rechazo:</b> ${promRech.toLocaleString('es-CL',{maximumFractionDigits:2})}%</div>
        <div><b>Rdmto:</b> ${promRdm.toLocaleString('es-CL',{maximumFractionDigits:2})}%</div>
      </div>
    `.trim();

    // dibujar el polígono y bind del popup
    const poly = L.polygon(coords, {
      color: '#1976d2',
      weight: 3,
      fillOpacity: 0.28
    }).addTo(centrosGroup);

    poly.bindPopup(popupHTML);
    poly.on('click', ev => {
      L.DomEvent.stopPropagation(ev);
      poly.openPopup(ev.latlng);
      if (onPolyClick) onPolyClick(idx);
    });

    // cache para focus
    centroPolys[idx] = poly;
  });

  // centrar vista en todos los polígonos si existen, o fallback
  const allCoords = [];
  centros.forEach(c =>
    (c.coords||[]).forEach(p => {
      const la = parseCoord(p.lat), ln = parseCoord(p.lng);
      if (la !== null && ln !== null) allCoords.push([la, ln]);
    })
  );
  if (allCoords.length) {
    map.fitBounds(allCoords, { padding: [20,20] });
  } else {
    map.setView(defaultLatLng, 10);
  }
}

/**
 * Centra el mapa en el polígono del índice dado y abre su popup.
 * @param {number} idx
 */
export function focusCentroInMap(idx) {
  const poly = centroPolys[idx];
  if (!poly) return;
  const map = crearMapa();
  map.fitBounds(poly.getBounds(), { maxZoom: 16 });
  poly.openPopup(poly.getBounds().getCenter());
}
