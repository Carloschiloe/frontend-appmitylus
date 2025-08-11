// /js/abastecimiento/visitas/data.js
import {
  apiGetVisitas,
  apiGetContactos,
  apiGetCentros
} from '/js/core/api.js';

/**
 * Carga visitas y enriquece con proveedor/centro cuando se pueda.
 * Devuelve: { raw, rows }
 */
export async function cargarVisitasEnriquecidas(normalizeFn) {
  // 1) Trae todo
  const [visitas, contactos, centros] = await Promise.all([
    apiGetVisitas?.() ?? fetch('/api/visitas').then(r => r.json()),
    apiGetContactos?.() ?? fetch('/api/contactos').then(r => r.json()),
    apiGetCentros?.()   ?? fetch('/api/centros').then(r => r.json()),
  ]);

  // 2) Index rápidos
  const mapContacto = new Map();
  (Array.isArray(contactos) ? contactos : []).forEach(c => mapContacto.set(String(c._id), c));

  const mapCentro = new Map();
  (Array.isArray(centros) ? centros : []).forEach(c => mapCentro.set(String(c._id || c.id), c));

  // 3) Normaliza/enriquece
  const raw = Array.isArray(visitas) ? visitas : [];
  const rows = raw.map(v => normalizeFn(v, mapContacto.get(String(v.contactoId)), mapCentro.get(String(v.centroId))));

  return { raw, rows };
}
