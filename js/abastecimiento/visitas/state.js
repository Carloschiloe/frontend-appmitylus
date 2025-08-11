// /js/abastecimiento/visitas/state.js

// Instancia de DataTable (se setea una vez en tabla.js)
export let dtVisitas = null;

// Datos crudos desde la API y filas normalizadas para la tabla
export let visitasRaw = [];
export let visitasRows = [];

// Setter para guardar la instancia de DataTable
export function setDtVisitas(dt) {
  dtVisitas = dt;
}

// Guarda el último fetch (crudo + normalizado)
export function setVisitas(raw = [], rows = []) {
  visitasRaw = Array.isArray(raw) ? raw : [];
  visitasRows = Array.isArray(rows) ? rows : [];
}

// Utilidad por si necesitas limpiar el estado
export function resetVisitas() {
  visitasRaw = [];
  visitasRows = [];
  // Ojo: no tocamos dtVisitas para no re-inicializar la tabla accidentalmente
}
