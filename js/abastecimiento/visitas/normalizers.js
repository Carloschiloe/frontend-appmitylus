// /js/abastecimiento/visitas/normalizers.js

// Convierte cualquier variante (ObjectId(".."), {$oid:..}, objeto {_id}, etc.) a string 24-hex
export function toId(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    const m = val.match(/ObjectId\(["']?([0-9a-fA-F]{24})["']?\)/);
    if (m && m[1]) return m[1];
    return val;
  }
  if (typeof val === 'object') {
    if (val.$oid) return String(val.$oid);
    if (val._id)  return toId(val._id);
    if (val.id)   return String(val.id);
  }
  return String(val);
}

export function centroCodigoById(id, lista = []) {
  const x = lista.find(c => toId(c._id ?? c.id) === toId(id));
  return x ? (x.code || x.codigo || x.Codigo || '') : '';
}

// Deja todos los campos en formato consistente
export function normalizeVisita(raw) {
  const v = raw || {};
  const out = {
    _id:              toId(v._id ?? v.id),
    contactoId:       toId(v.contactoId ?? v.proveedorId),
    centroId:         toId(v.centroId),
    centroCodigo:     v.centroCodigo ?? null,
    contacto:         v.contacto ?? null,
    enAgua:           v.enAgua ?? null,
    estado:           v.estado ?? 'Programar nueva visita',
    tonsComprometidas:v.tonsComprometidas ?? null,
    observaciones:    v.observaciones ?? null,
    fecha:            v.fecha ? new Date(v.fecha) : null,
    proximoPasoFecha: v.proximoPasoFecha ? new Date(v.proximoPasoFecha) : null, // ← NUEVO
    fotos:            Array.isArray(v.fotos) ? v.fotos.slice() : []
  };
  return out;
}
