// js/mapas/mapDraw.js

import { Estado } from '../core/estado.js';
import { parseNum } from './mapPoints.js';

// Guarda los polígonos por índice para focus
let centroPolys = {};

/**
 * Dibuja todos los centros en el mapa, limpia el grupo previo y ajusta los bounds.
 * @param {Array} centros – array de objetos centro con coords, lines, etc.
 * @param {[number,number]} defaultLatLng – centro de fallback si no hay coords válidas.
 * @param {Function|null} onPolyClick – callback opcional al hacer click en un polígono.
 */
export function drawCentrosInMap(centros = [], defaultLatLng = [-42.48, -73.77], onPolyClick = null) {
  console.log('[mapDraw] drawCentrosInMap →', centros.length, 'centros');
  if (!Estado.map) {
    console.error('[mapDraw] Mapa no inicializado');
    return;
  }
  const group = window.__centrosGroup;
  if (!group) {
    console.error('[mapDraw] window.__centrosGroup no existe');
    return;
  }

  // Limpiar antes de dibujar
  group.clearLayers();
  centroPolys = {};

  let dibujados = 0;
  centros.forEach((c, idx) => {
    // Convertir coords y filtrar inválidas
    const coords = (c.coords || [])
      .map(p => [ parseNum(p.lat), parseNum(p.lng) ])
      .filter(([la, ln]) => la !== null && ln !== null);
    if (coords.length < 3) return;

    // Calcular totales / promedios (igual que en tabla)
    const hect = +c.hectareas || 0;
    const cantLines = Array.isArray(c.lines) ? c.lines.length : 0;
    let sumaUnKg = 0, sumaRech = 0, sumaRend = 0, sumaTons = 0;
    if (Array.isArray(c.lines)) {
      c.lines.forEach(l => {
        if (l.unKg   != null) sumaUnKg   += Number(l.unKg);
        if (l.porcRechazo != null) sumaRech += Number(l.porcRechazo);
        if (l.rendimiento != null) sumaRend += Number(l.rendimiento);
        if (l.tons    != null) sumaTons   += Number(l.tons);
      });
    }
    const promUnKg   = cantLines ? sumaUnKg   / cantLines : 0;
    const promRech   = cantLines ? sumaRech   / cantLines : 0;
    const promRend   = cantLines ? sumaRend   / cantLines : 0;

    // HTML del popup
    const popupHTML = `
      <div style="min-width:170px;font-size:13px;line-height:1.3">
        <strong>${c.proveedor || '-'}</strong><br/>
        <em>${c.comuna || ''}</em><br/>
        <b>Cód:</b> ${c.code || '-'}<br/>
        <b>Hect:</b> ${hect.toFixed(2)}<br/>
        <b>Líneas:</b> ${cantLines}<br/>
        <b>Tons:</b> ${sumaTons.toLocaleString('es-CL')}<br/>
        <b>Un/Kg:</b> ${promUnKg.toFixed(2)}<br/>
        <b>% Rechazo:</b> ${promRech.toFixed(1)}%<br/>
        <b>Rend:</b> ${promRend.toFixed(1)}%
      </div>
    `.trim();

    // Crear polígono
    const poly = L.polygon(coords, {
      color: '#1976d2',
      weight: 3,
      fillOpacity: 0.3
    }).addTo(group);

    poly._popupHTML = popupHTML;
    poly.bindPopup(popupHTML);

    poly.on('click', ev => {
      L.DomEvent.stopPropagation(ev);
      if (poly.isPopupOpen()) poly.closePopup();
      else poly.openPopup(ev.latlng || poly.getBounds().getCenter());
      if (onPolyClick) onPolyClick(idx);
    });

    centroPolys[idx] = poly;
    dibujados++;
  });

  console.log(`[mapDraw] polígonos dibujados: ${dibujados}`);

  // Ajustar vista a todos los coords
  const allCoords = [];
  centros.forEach(c =>
    (c.coords || []).forEach(p => {
      const la = parseNum(p.lat), ln = parseNum(p.lng);
      if (la !== null && ln !== null) allCoords.push([la, ln]);
    })
  );
  if (allCoords.length) {
    Estado.map.fitBounds(allCoords, { padding: [20, 20] });
  } else {
    Estado.map.setView(defaultLatLng, 10);
  }

  // Refrescar tamaño del mapa
  setTimeout(() => Estado.map.invalidateSize(), 100);
  setTimeout(() => Estado.map.invalidateSize(), 300);
}

/**
 * Centra y resalta un centro en particular.
 * @param {number} idx – índice del centro.
 */
export function focusCentroInMap(idx) {
  const poly = centroPolys[idx];
  if (!poly) return;
  Estado.map.fitBounds(poly.getBounds(), { maxZoom: 16 });
  if (!poly.isPopupOpen()) poly.openPopup(poly.getBounds().getCenter());
  poly.setStyle({ color: '#ff9800', weight: 5 });
  setTimeout(() => poly.setStyle({ color: '#1976d2', weight: 3 }), 800);
}
