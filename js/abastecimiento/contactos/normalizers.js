import { state, slug } from './state.js';

export function coerceArray(res) {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') return res.data || res.items || res.results || res.contactos || res.contacts || [];
  return [];
}

export function normalizeContacto(c = {}) {
  const key = c.proveedorKey || slug(c.proveedorNombre || c.proveedor || '');
  const nombre = c.proveedorNombre || (state.proveedoresIndex[key]?.proveedor) || c.proveedor || '';
  const created = c.createdAt || c.created_at || c.fecha || c.fechaCreacion;
  const tons = (c.tonsDisponiblesAprox ?? c.onsDisponiblesAprox ?? c.tnsDisponiblesAprox ?? '');
  const centroCodigo = c.centroCodigo || c.centro_code || c.codigoCentro || '';
  const centroId = c.centroId || c.centro_id || c.idCentro || null;

  return {
    ...c,
    proveedorKey: key,
    proveedorNombre: nombre,
    createdAt: created,
    tonsDisponiblesAprox: (tons === '' || tons === null) ? '' : Number(tons),
    centroCodigo,
    centroId,
  };
}

export function normalizeVisitas(res) {
  return coerceArray(res).map(v => ({
    ...v,
    fecha: v.fecha || v.createdAt || v.created_at || '',
    estado: v.estado || v.resultado || '-',
  }));
}

// útil para mostrar código cuando sólo hay centroId
export function centroCodigoById(id) {
  const c = state.listaCentros.find(x => String(x._id || x.id) === String(id));
  return c?.code || c?.codigo || null;
}
