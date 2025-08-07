// js/mapas/mapDraw.js

import { crearMapa, centrosGroup } from './mapConfig.js';
import { setFilterData }            from './mapFilter.js';

const parseNum = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export const centroPolys = {};

export function drawCentrosInMap(
  centros = [],
  defaultLatLng = [-42.48, -73.77],
  onPolyClick = null
) {
  const map = crearMapa(defaultLatLng);
  setFilterData(centros);

  centrosGroup.clearLayers();
  Object.keys(centroPolys).forEach(k => delete centroPolys[k]);

  centros.forEach((c, idx) => {
    const coords = (c.coords||[])
      .map(p => [parseNum(p.lat), parseNum(p.lng)])
      .filter(([la,ln]) => la!==null && ln!==null);
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
        <div><b>Hectáreas:</b> ${( +c.hectareas||0 ).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div><b>Líneas:</b> ${(c.lines||[]).length}</div>
        <div><b>Tons:</b> ${sumaTons.toLocaleString('es-CL')}</div>
        <div><b>Un/Kg:</b> ${promUnKg.toLocaleString('es-CL',{maximumFractionDigits:2})}</div>
        <div><b>% Rechazo:</b> ${promRech.toLocaleString('es-CL',{maximumFractionDigits:2})}%</div>
        <div><b>Rdmto:</b> ${promRdm.toLocaleString('es-CL',{maximumFractionDigits:2})}%</div>
      </div>
    `.trim();

    const poly = L.polygon(coords, {
      color: '#1976d2', weight: 3, fillOpacity: 0.28
    }).addTo(centrosGroup);

    poly.bindPopup(popupHTML);
    poly.on('click', ev => {
      L.DomEvent.stopPropagation(ev);
      poly.openPopup(ev.latlng);
      if (onPolyClick) onPolyClick(idx);
    });

    centroPolys[idx] = poly;
  });

  // centrar todo
  const all = [];
  centros.forEach(c => (c.coords||[]).forEach(p => {
    const la=parseNum(p.lat), ln=parseNum(p.lng);
    if(la!==null&&ln!==null) all.push([la,ln]);
  }));
  if (all.length) map.fitBounds(all,{padding:[20,20]});
  else map.setView(defaultLatLng,10);
}

export function focusCentroInMap(idx) {
  const poly = centroPolys[idx];
  if (!poly) return;
  const map = crearMapa();
  map.fitBounds(poly.getBounds(),{maxZoom:16});
  poly.openPopup(poly.getBounds().getCenter());
}
