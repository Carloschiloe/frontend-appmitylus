import { state } from '../state.js';
import { centroCodigoById as _centroCodigoById } from '../../visitas/normalizers.js';

// Detecta “nuevo” según varios flags comunes y/o el mapa local
export function esContactoNuevo(contactoId){
  // 1) flags en el mapa de contactos (si existe)
  const c = state?.contactosById?.[contactoId] || null;
  if (c && (c.proveedorNuevo || c.contactoProveedorNuevo || c.esNuevoProveedor || c.esNuevoContacto || c.isNewSupplier)) {
    return true;
  }
  return false;
}

// Útil cuando la interacción ya trae su propio flag
export function esProveedorNuevoInteraccion(interaccion = {}){
  return !!(interaccion.proveedorNuevo || interaccion.contactoProveedorNuevo || interaccion.esNuevoProveedor);
}

// Normaliza tipo/proximoPaso a una categoría canónica
function canonTipo(interaccion = {}){
  const raw = String(interaccion.proximoPaso || interaccion.tipo || '').toLowerCase();
  if (/llamada|telef/.test(raw)) return 'llamada';
  if (/muestra/.test(raw)) return 'muestra';
  if (/reuni/.test(raw)) return 'reunion';
  if (/visita/.test(raw)) return 'visita';
  if (/negociar|seguim/.test(raw)) return 'seguimiento';
  return 'tarea';
}

// Resuelve centro con fallback seguro
function centroCodigo(interaccion = {}){
  if (interaccion.centroCodigo) return interaccion.centroCodigo;
  if (interaccion.centroId && typeof _centroCodigoById === 'function') {
    try { return _centroCodigoById(interaccion.centroId) || ''; } catch(e){ /* noop */ }
  }
  return '';
}

export function toCalendarEvent(interaccion){
  if (!interaccion) return null;

  // fecha: prioriza el próximo paso si existe (lo que vas a agendar)
  const start = interaccion.proximoPasoFecha || interaccion.fechaProx || interaccion.fecha;
  const startISO = start ? new Date(start).toISOString() : null;

  const tipo = canonTipo(interaccion);
  const contacto = interaccion.contactoNombre || interaccion.proveedorNombre || 'Contacto';
  const centro = centroCodigo(interaccion);
  const tons = Number(interaccion.tonsConversadas || interaccion.tons || 0) || null;

  // Título compacto por tipo
  const title =
    tipo === 'llamada'     ? `📞 ${contacto}`
  : tipo === 'muestra'     ? `🧪 ${centro || contacto}`
  : tipo === 'reunion'     ? `🤝 ${contacto}`
  : tipo === 'visita'      ? `🗺️ ${centro || contacto}`
  : tipo === 'seguimiento' ? `🔁 ${contacto}`
  :                          `✅ ${interaccion.proximoPaso || 'Tarea'}`;

  // Paleta simple por tipo (fallback gris)
  const colorMap = {
    llamada:     '#1e88e5',
    muestra:     '#8e24aa',
    reunion:     '#43a047',
    visita:      '#fb8c00',
    seguimiento: '#0ea5e9',
    tarea:       '#546e7a'
  };
  const color = colorMap[tipo] || '#546e7a';

  return {
    id: interaccion._id || interaccion.id,
    title,
    start: startISO,   // el calendario y tus adapters andan mejor con ISO-8601
    end: startISO,     // eventos puntuales
    color,
    meta: {
      ...interaccion,
      tipoCanon: tipo,
      centroCodigo: centro,
      tonsConversadas: tons
    }
  };
}

