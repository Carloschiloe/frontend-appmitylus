// /js/abastecimiento/visitas/normalizers.js
import { state } from '../contactos/state.js';

export function centroCodigoById(id) {
  if (!id) return '';
  const c = state.listaCentros.find(x => String(x._id || x.id) === String(id));
  return (c?.code || c?.codigo || '') || '';
}

function proveedorNombreByContacto(contactoId) {
  const c = state.contactosGuardados.find(x => String(x._id) === String(contactoId));
  return c?.proveedorNombre || '';
}

export function normalizeVisita(v = {}) {
  return {
    ...v,
    // columnas para la tabla
    fecha: (v.fecha || '').slice(0, 10),
    proveedor: v.proveedorNombre || proveedorNombreByContacto(v.contactoId) || '',
    centro: v.centroCodigo || centroCodigoById(v.centroId) || '',
    actividad: v.enAgua || '',
    proximoPaso: v.estado || '',
    tons: (v.tonsComprometidas ?? '') + '',
    observaciones: v.observaciones || ''
  };
}
