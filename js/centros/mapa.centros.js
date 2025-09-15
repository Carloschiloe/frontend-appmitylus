// /js/centros/mapa.centros.js — Leaflet + polígonos
let map, layerGroup, centroIndex = new Map();

export function initMapaCentros(centros) {
  if (!map) {
    map = L.map('map', { zoomControl: true, preferCanvas: true });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // ✅ Control fullscreen correcto para leaflet.fullscreen
    if (L.control && typeof L.control.fullscreen === 'function') {
      map.addControl(L.control.fullscreen({
        position: 'topleft',
        title: 'Pantalla completa',
        titleCancel: 'Salir pantalla completa'
      }));
    }

    layerGroup = L.layerGroup().addTo(map);

    // Botón propio de la UI
    const btnFs = document.getElementById('btnFullscreenMapa');
    if (btnFs) {
      btnFs.addEventListener('click', () => {
        // Si el plugin expone toggleFullscreen:
        if (typeof map.toggleFullscreen === 'function') {
          map.toggleFullscreen();
        } else {
          // Fallback nativo
          const el = document.getElementById('map');
          if (!document.fullscreenElement && el?.requestFullscreen) {
            el.requestFullscreen();
          } else if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
      });
    }
  } else {
    layerGroup.clearLayers();
    centroIndex.clear();
  }

  const bounds = [];

  // Acepta polygon como [[lat,lng],...] o MultiPolygon [[[lat,lng],...], ...]
  const toRings = (poly) => {
    if (!Array.isArray(poly)) return [];
    if (poly.length && Array.isArray(poly[0]) && typeof poly[0][0] === 'number') {
      // Polygon simple
      return [poly];
    }
    // MultiPolygon o anillos
    return poly;
  };

  centros.forEach(c => {
    const raw = c.polygon || c.coordenadas || c.coordinates;
    const hasMin = Array.isArray(raw) && raw.length >= 3;
    if (!raw || (!hasMin && !Array.isArray(raw[0]))) return;

    const rings = toRings(raw).map(r =>
      r.map(([lat, lng]) => [Number(lat), Number(lng)])
    );

    // Evita errores con anillos vacíos
    if (!rings.length || !rings[0].length) return;

    const lyr = L.polygon(rings, {
      weight: 1.2,
      opacity: 0.9,
      fillOpacity: 0.25,
      color: '#0284c7',
      fillColor: '#38bdf8'
    }).addTo(layerGroup);

    lyr.bindPopup(`<b>${esc(c.proveedor)}</b><br>${esc(c.comuna)} · ${esc(c.codigo)}`);
    centroIndex.set(String(c.id), lyr);

    rings.forEach(r => r.forEach(ll => bounds.push(ll)));
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [20, 20] });
  } else {
    // Vista por defecto Chiloé aprox.
    map.setView([-42.5, -73.7], 7);
  }

  return { map, layerGroup };
}

export function focusEnCentro(id) {
  const lyr = centroIndex.get(String(id));
  if (!lyr) return;
  const b = lyr.getBounds();

  lyr.openPopup();
  lyr.setStyle({ weight: 2, color: '#0ea5e9', fillColor: '#67e8f9' });
  setTimeout(() => {
    lyr.setStyle({ weight: 1.2, color: '#0284c7', fillColor: '#38bdf8' });
  }, 1600);

  lyr._map.fitBounds(b.pad(0.4));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[m]));
}
