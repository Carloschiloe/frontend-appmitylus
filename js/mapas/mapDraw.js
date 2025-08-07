// js/mapas/mapDraw.js
import { crearMapa, centrosGroup } from './mapConfig.js';
import { setFilterData } from './mapFilter.js';
import L from 'leaflet';

const parseNum = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export const centroPolys = {};

/**
 * Dibuja todos los centros como polígonos y enlaza popups.
 * @param {Array} centros — objetos con coords, comuna, proveedor, code, hectareas, lines
 * @param {[number,number]} defaultLatLng — vista inicial si no hay polígonos
 * @param {Function|null} onPolyClick — callback al click en polígono
 */
export function drawCentrosInMap(
  centros = [],
  defaultLatLng = [-42.48, -73.77],
  onPolyClick = null
) {
  const map = crearMapa(defaultLatLng);

  // actualizar datos de filtro
  setFilterData(centros);

  // limpiar grupo y caché
  centrosGroup.clearLayers();
  Object.keys(centroPolys).forEach(k => delete centroPolys[k]);

  centros.forEach((c, idx) => {
    // coords válidas
    const coords = (c.coords||[])
      .map(p => [parseNum(p.lat), parseNum(p.lng)])
      .filter(([la,ln]) => la!==null&&ln!==null);
    if (coords.length < 3) return;

    // calcular sumas y promedios
    let sumaUnKg=0, sumaRech=0, sumaRdm=0, sumaTons=0, count=0;
    (c.lines||[]).forEach(l => {
      if (!isNaN(l.unKg)) { sumaUnKg+=Number(l.unKg); count++; }
      if (!isNaN(l.porcRechazo)) sumaRech+=Number(l.porcRechazo);
      if (!isNaN(l.rendimiento)) sumaRdm+=Number(l.rendimiento);
      if (!isNaN(l.tons)) sumaTons+=Number(l.tons);
    });
    const promUnKg = count? sumaUnKg/count : 0;
    const promRech = count? sumaRech/count : 0;
    const promRdm  = count? sumaRdm/count : 0;

    // construir popup
    const popupHTML = `
      <div style="min-width:170px;font-size:13px;line-height:1.28">
        <div style="font-weight:600;margin-bottom:5px;">${c.comuna||'-'}</div>
        <div><b>Código:</b> ${c.code||'-'}</div>
        <div><b>Hectáreas:</b> ${( +c.hectareas||0 ).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div><b>Líneas:</b> ${(c.lines||[]).length}</div>
        <div><b>Tons:</b> ${sumaTons.toLocaleString('es-CL')}</div>
        <div><b>Un/Kg:</b> ${promUnKg.toLocaleString('es-CL',{maximumFractionDigits:2})}</div>
        <div><b>% Rechazo:</b> ${promRech.toLocaleString('es-CL',{maximumFractionDigits:2})}%</div>
        <div><b>Rdmto:</b> ${promRdm.toLocaleString('es-CL',{maximumFractionDigits:2})}%</div>
      </div>
    `.trim();

    // dibujar polígono
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

    centroPolys[idx] = poly;
  });

  // centrar vista en todos los coords
  const allCoords = [];
  centros.forEach(c =>
    (c.coords||[]).forEach(p => {
      const la = parseNum(p.lat), ln = parseNum(p.lng);
      if (la!==null&&ln!==null) allCoords.push([la,ln]);
    })
  );
  if (allCoords.length) map.fitBounds(allCoords, { padding:[20,20] });
  else map.setView(defaultLatLng, 10);
}

/**
 * Centra el mapa en un centro específico y abre su popup.
 * @param {number} idx — índice en el array original de centros
 */
export function focusCentroInMap(idx) {
  const poly = centroPolys[idx];
  if (!poly) return;
  const map = crearMapa();
  map.fitBounds(poly.getBounds(), { maxZoom: 16 });
  poly.openPopup(poly.getBounds().getCenter());
}
