// /js/abastecimiento/contactos/normalizers.js
import { state, slug } from './state.js';

export function coerceArray(res) {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    return res.data || res.items || res.results || res.contactos || res.contacts || [];
  }
  return [];
}

export function normalizeContacto(c = {}) {
  // No borres nada: conserva lo que venga del backend
  const o = { ...c };

  // Identidad de proveedor/empresa
  o.proveedorKey     = o.proveedorKey || (o.proveedorNombre ? slug(o.proveedorNombre) : (o.proveedor ? slug(o.proveedor) : ''));
  o.proveedorNombre  = o.proveedorNombre || o.proveedor || '';

  // Centro asociado (si existe)
  o.centroId         = o.centroId ?? null;
  o.centroCodigo     = o.centroCodigo || o.centro_code || o.codigoCentro || '';
  o.centroComuna     = o.centroComuna || '';
  o.centroHectareas  = o.centroHectareas ?? null;

  // Persona
  o.contactoNombre   = o.contactoNombre || '';
  // teléfonos y emails: aceptar string o array
  if (Array.isArray(o.contactoTelefonos)) {
    o.contactoTelefonos = o.contactoTelefonos.filter(Boolean);
  } else if (o.contactoTelefono) {
    o.contactoTelefonos = [String(o.contactoTelefono)];
  } else {
    o.contactoTelefonos = [];
  }
  if (Array.isArray(o.contactoEmails)) {
    o.contactoEmails = o.contactoEmails.filter(Boolean);
  } else if (o.contactoEmail) {
    o.contactoEmails = [String(o.contactoEmail)];
  } else {
    o.contactoEmails = [];
  }

  // Campos informativos usados por tablas
  o.notas            = o.notas || o.notasContacto || '';
  o.createdAt        = o.createdAt || o.created_at || o.fecha || o.fechaCreacion || null;
  o.tonsDisponiblesAprox = (o.tonsDisponiblesAprox ?? o.tnsDisponiblesAprox ?? o.onsDisponiblesAprox ?? null);

  return o;
}

// útil para mostrar código cuando sólo hay centroId
export function centroCodigoById(id) {
  if (!id) return '';
  const c = (state.listaCentros || []).find(x => String(x._id || x.id) === String(id));
  return c?.code || c?.codigo || '';
}


// retorna comuna a partir del código de centro
export function comunaPorCodigo(codigo){
  if (!codigo) return '';
  const lista = Array.isArray(state.listaCentros) ? state.listaCentros : [];
  const cod = String(codigo);
  const ct = lista.find(x => {
    const cs = [x.codigo, x.code, x.Codigo].filter(v => v != null).map(String);
    return cs.includes(cod);
  });
  return ct?.comuna ?? ct?.Comuna ?? '';
}
