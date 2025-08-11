// /js/abastecimiento/visitas/normalizers.js

// formatea fecha a YYYY-MM-DD
function ymd(d) {
  const f = new Date(d || Date.now());
  const yyyy = f.getFullYear();
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  const dd = String(f.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// corta observaciones para la tabla
function short(text, n = 80) {
  const s = (text || '').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/**
 * v: documento visita
 * contacto: { proveedorNombre?, ... } (opcional)
 * centro:   { code?, codigo?, comuna? } (opcional)
 */
export function normalizeVisita(v, contacto = null, centro = null) {
  const proveedor = contacto?.proveedorNombre || contacto?.proveedor || v.proveedorNombre || '';
  const centroCodigo = centro?.code || centro?.codigo || v.centroCodigo || '';
  const actividad = (v.enAgua === 'Sí' || v.enAgua === 'Si') ? 'Toma de muestras: Sí'
                  : (v.enAgua === 'No' ? 'Toma de muestras: No' : (v.enAgua || ''));

  return {
    _id: v._id,
    fecha: ymd(v.fecha || v.createdAt),
    proveedor,
    centro: centroCodigo || '-',
    actividad,
    proximoPaso: v.estado || '',
    tons: (v.tonsComprometidas ?? '') + '',
    observaciones: short(v.observaciones, 100),
  };
}

// añade/ajusta esta función
export function toRows(visitas = [], contactosMap = new Map(), centrosMap = new Map()) {
  return visitas.map(v => {
    const contacto = contactosMap.get(String(v.contactoId)) || {};
    const proveedor = contacto.proveedorNombre || contacto.proveedor || '';
    const centro =
      v.centroCodigo ||
      centrosMap.get(String(v.centroId))?.code ||
      centrosMap.get(String(v.centroId))?.codigo ||
      '';

    return {
      _id: v._id,
      fecha: (v.fecha || '').slice(0, 10),
      proveedor,
      centro,
      actividad: v.enAgua ?? '',                 // “Sí” / “No”
      proximoPaso: v.estado ?? '',               // antes podían ser “Realizada”
      tons: v.tonsComprometidas ?? '',
      observaciones: v.observaciones ?? ''
    };
  });
}

