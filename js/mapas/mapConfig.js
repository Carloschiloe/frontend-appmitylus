// js/mapas/mapConfig.js

export let map = null;
export let puntosIngresoGroup = null;
export let centrosGroup      = null;
export const defaultLatLng = [-42.50, -73.80];

/**
 * Definición de capas base: primero ESRI, luego OSM como backup.
 */
export const baseLayersDefs = {
  esri: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 20,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
    }
  ),
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }
  )
};

/**
 * Inicializa el mapa, con fallback automático de ESRI a OSM.
 * @param {[number,number]} defaultLatLngParam — vista inicial (Chiloé)
 * @returns {L.Map|null}
 */
export function crearMapa(defaultLatLngParam = defaultLatLng) {
  console.log('[mapConfig] crearMapa → centrar en', defaultLatLngParam);

  // Elimina mapa anterior si existe
  if (map) {
    map.remove();
    map = null;
  }

  const el = document.getElementById('map');
  if (!el) {
    console.error('[mapConfig] No se encontró el elemento #map');
    return null;
  }
  if (el.clientHeight < 50) el.style.minHeight = '400px';

  // Crea el mapa con la capa ESRI satélite por defecto
  map = L.map(el, {
    center: defaultLatLngParam,
    zoom: 10,
    layers: [baseLayersDefs.esri]
  });

  // Si la capa ESRI da error de tiles, cambia a OSM automáticamente
  baseLayersDefs.esri.on('tileerror', function () {
    if (map.hasLayer(baseLayersDefs.esri)) {
      map.removeLayer(baseLayersDefs.esri);
      baseLayersDefs.osm.addTo(map);
      console.warn('[mapConfig] ESRI falló, cambiando a OpenStreetMap (OSM)');
      // Puedes mostrar un toast o alerta visual aquí si quieres avisar al usuario
    }
  });

  puntosIngresoGroup = L.layerGroup().addTo(map);
  centrosGroup      = L.layerGroup().addTo(map);

  window.map = map; // Debug en consola

  console.log('[mapConfig] Mapa creado');
  return map;
}
