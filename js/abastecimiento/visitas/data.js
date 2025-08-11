// /js/abastecimiento/visitas/data.js
import { apiGetVisitas } from '/js/core/api.js';
import { normalizeVisita } from './normalizers.js';

export async function cargarVisitasEnriquecidas(normalizeFn) {
  const res = await apiGetVisitas();                    // puede ser [] o {items:[]}
  const raw = Array.isArray(res) ? res : (res.items || []);
  const norm = typeof normalizeFn === 'function' ? normalizeFn : normalizeVisita;
  const rows = raw.map(v => norm(v));
  return { raw, rows };
}


