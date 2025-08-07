// js/mapas/mapDraw.js
// Dibuja polígonos de centros, popups y centrado

import { crearMapa, centrosGroup } from './mapConfig.js';
import { setFilterData }            from './mapFilter.js';
import { parseOneDMS }              from '../core/utilidades.js';

const parseNum = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

function parseCoord(v) {
  if (typeof v === 'string' && /[NSnsEWew]/.test(v)) {
    const d = parseOneDMS(v);
    console.log('[mapDraw] parseCoord DMS →', v, '=>', d);
    return d;
  }
  const n = parseNum(v);
  console.log('[mapDraw] parseCoord decimal →', v, '=>', n);
  return n;
}

export const centroPolys = {};

export function drawCentrosInMap(
  centros = [],
  defaultLatLng = [-42.48, -73.77],
  onPolyClick = null
) {
  console.log('[mapDraw] drawCentrosInMap →', centros.length, 'centros');
  const map = crearMapa(defaultLatLng);
  setFilterData(centros);

  centrosGroup.clearLayers();
  Object.keys(centroPolys).forEach(k => delete centroPolys[k]);

  centros.forEach((c, idx) => {
    console.log(`[mapDraw] procesando centro[${idx}] →`, c);
    const coords = (c.coords||[])
      .map(p => [parseCoord(p.lat), parseCoord(p.lng)])
      .filter(([la,ln]) => la!==null && ln!==null);
    console.log(`[mapDraw] centro[${idx}] coords válidas =`, coords.length);
    if (coords.length < 3) return;

    let sumaUnKg=0, sumaRech=0, sumaRdm=0, sumaTons=0, count=0;
    (c.lines||[]).forEach(l => {
      if (!isNaN(l.unKg)) { sumaUnKg+=Number(l.unKg); count++; }
      if (!isNaN(l.porcRechazo)) sumaRech+=Number(l.porcRechazo);
      if (!isNaN(l.rendimiento))  sumaRdm+=Number(l.rendimiento);
      if (!isNaN(l.tons))         sumaTons+=Number(l.tons);
    });
    const promUnKg = count? sumaUnKg/count : 0;
    const promRech = count? sumaRech/count : 0;
    const promRdm  = count? sumaRdm/count : 0;

    const popupHTML = `
      <div style="min-width:170px;font-size:13px;line-height:1.28">
        <div style="font-weight:600;margin-bottom:5px;">${c.comuna||'-'}</div>
        <div><b>Código:</b> ${c.code||'-'}</div>
        <div><b>Hectáreas:</b> ${( +c.hectareas||0 ).toLocaleString('es-CL',{ minimumFractionDigits:2,maximumFractionDigits:2 })}</div>
        <div><b>Líneas:</b> ${(c.lines||[]).length}</div>
        <div><b>Tons:</b> ${sumaTons.toLocaleString('es-CL')}</div>
        <div><b>Un/Kg:</b> ${promUnKg.toLocaleString('es-CL',{maximumFractionDigits:2})}</div>
        <div><b>% Rechazo:</b> ${promRech.toLocaleString('es-CL',{maximumFractionDigits:2})}%</div>
        <div><b>Rdmto:</b> ${promRdm.toLocaleString('es-CL',{maximumFractionDigits:2})}%</div>
      </div>
    `.trim();

    const poly = L.polygon(coords, { color:'#1976d2', weight:3, fillOpacity:.28 })
      .addTo(centrosGroup);
    console.log(`[mapDraw] polígono creado para centro[${idx}]`);

    poly.bindPopup(popupHTML);
    poly.on('click', ev => {
      L.DomEvent.stopPropagation(ev);
      if (poly.isPopupOpen()) {
        poly.closePopup();
        console.log(`[mapDraw] popup cerrado [${idx}]`);
      } else {
        poly.openPopup(ev.latlng);
        console.log(`[mapDraw] popup abierto [${idx}]`);
      }
      if (onPolyClick) onPolyClick(idx);
    });

    centroPolys[idx] = poly;
  });

  // Centrar vista
  const all = [];
  centros.forEach(c => (c.coords||[]).forEach(p => {
    const la=parseCoord(p.lat), ln=parseCoord(p.lng);
    if (la!==null&&ln!==null) all.push([la,ln]);
  }));
  if (all.length) {
    map.fitBounds(all, { padding:[20,20] });
    console.log('[mapDraw] map.fitBounds con', all.length, 'coords');
  } else {
    map.setView(defaultLatLng,10);
    console.log('[mapDraw] fallback map.setView a', defaultLatLng);
  }
}

export function focusCentroInMap(idx) {
  console.log('[mapDraw] focusCentroInMap →', idx);
  const poly = centroPolys[idx];
  if (!poly) {
    console.warn('[mapDraw] no existe poly para idx', idx);
    return;
  }
  const map = crearMapa();
  map.fitBounds(poly.getBounds(), { maxZoom:16 });
  poly.openPopup(poly.getBounds().getCenter());
  poly.setStyle({ color:'#ff9800', weight:5 });
  setTimeout(() => {
    poly.setStyle({ color:'#1976d2', weight:3 });
    console.log('[mapDraw] estilo restaurado para idx', idx);
  }, 1000);
}
