// /js/abastecimiento/visitas/state.js
export let dtVisitas = null;          // instancia DataTable
export let visitasRaw = [];           // crudo desde API
export let visitasRows = [];          // filas normalizadas + enriquecidas

export function setVisitas(raw, rows) {
  visitasRaw = raw || [];
  visitasRows = rows || [];
}
