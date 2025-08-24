// js/core/estado.js
export const Estado = {
  centros: [],
  table: null,
  currentPoints: [],
  currentCentroIdx: null,
  lineAcordionOpen: null,
  editingLine: { idx: null, lineIdx: null },
  estadoFiltro: 'todos',
  activeCentroMapa: null,
  centrosHashRender: null,
  map: null,
  defaultLatLng: [-42.48, -73.77],

  // usado por el inventario de líneas & boyas
  inventarioActual: { centroIdx: null, lineaIdx: null, registroIdx: null }
};

// Debug opcional (para escribir Estado en la consola)
if (typeof window !== 'undefined') {
  window.Estado = Estado;
  window._estado = Estado;
}
