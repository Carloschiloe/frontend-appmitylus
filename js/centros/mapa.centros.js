// /js/mapa.centros.js — Leaflet + polígonos
let map, layerGroup, centroIndex = new Map();

export function initMapaCentros(centros){
  if(!map){
    map = L.map('map', { zoomControl: true, preferCanvas: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    map.addControl(new L.Control.Fullscreen());
    layerGroup = L.layerGroup().addTo(map);
    document.getElementById('btnFullscreenMapa')?.addEventListener('click', () => map.toggleFullscreen());
  }else{
    layerGroup.clearLayers();
    centroIndex.clear();
  }

  const bounds = [];
  centros.forEach(c => {
    const poly = Array.isArray(c.polygon) && c.polygon.length >= 3 ? c.polygon : null;
    if(!poly) return;
    const latlngs = poly.map(([lat, lng]) => [Number(lat), Number(lng)]);
    const lyr = L.polygon(latlngs, {
      weight: 1.2, opacity: .9, fillOpacity: .25, color: '#0284c7', fillColor: '#38bdf8'
    }).addTo(layerGroup);
    lyr.bindPopup(`<b>${esc(c.proveedor)}</b><br>${esc(c.comuna)} · ${esc(c.codigo)}`);
    centroIndex.set(String(c.id), lyr);
    latlngs.forEach(ll => bounds.push(ll));
  });
  if(bounds.length){
    map.fitBounds(bounds, { padding:[20,20] });
  }else{
    map.setView([-42.5, -73.7], 7);
  }

  return { map, layerGroup };
}

export function focusEnCentro(id){
  const lyr = centroIndex.get(String(id));
  if(!lyr) return;
  const b = lyr.getBounds();
  lyr.openPopup();
  lyr.setStyle({ weight: 2, color: '#0ea5e9', fillColor: '#67e8f9' });
  setTimeout(()=>{
    lyr.setStyle({ weight: 1.2, color: '#0284c7', fillColor: '#38bdf8' });
  }, 1600);
  lyr._map.fitBounds(b.pad(0.4));
}

function esc(s){ return String(s ?? '').replace(/[&<>"]/g, m=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m])); }
