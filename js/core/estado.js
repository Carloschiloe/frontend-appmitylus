// js/core/estado.js — versión sin líneas/inventario
export const Estado = {
  centros: [],
  table: null,
  currentPoints: [],
  currentCentroIdx: null,

  // UI / filtros / mapa
  estadoFiltro: 'todos',
  activeCentroMapa: null,
  centrosHashRender: null,
  map: null,
  defaultLatLng: [-42.48, -73.77],
};

// Debug opcional (para inspeccionar en consola)
if (typeof window !== 'undefined') {
  window.Estado = Estado;
  window._estado = Estado;
}
