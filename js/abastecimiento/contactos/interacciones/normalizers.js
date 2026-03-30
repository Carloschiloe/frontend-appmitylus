// /js/abastecimiento/contactos/interacciones/normalizers.js
import { state } from '../state.js';
import { centroCodigoById as _centroCodigoById } from '../../visitas/normalizers.js';

/** Detecta “nuevo” según varios flags comunes y/o el mapa local */
export function esContactoNuevo(contactoId){
  const c = state?.contactosById?.[contactoId] || null;
  if (!c) return false;
  return !!(
    c.proveedorNuevo ||
    c.contactoProveedorNuevo ||
    c.esNuevoProveedor ||
    c.esNuevoContacto ||
    c.isNewSupplier
  );
}

/** Útil cuando la interacción ya trae su propio flag */
export function esProveedorNuevoInteraccion(interaccion = {}){
  return !!(
    interaccion.proveedorNuevo ||
    interaccion.contactoProveedorNuevo ||
    interaccion.esNuevoProveedor
  );
}

/** Fecha segura → ISO (o null si inválida) */
function safeISO(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t) ? null : t.toISOString();
}

/** Normaliza tipo/proximoPaso a una categoría canónica */
function canonTipo(interaccion = {}){
  const raw = String(interaccion.proximoPaso || interaccion.tipo || '')
    .normalize('NFC')
    .toLowerCase()
    .trim();

  if (/llamada|telef/.test(raw)) return 'llamada';
  if (/muestra/.test(raw)) return 'muestra';
  if (/reuni/.test(raw))   return 'reunion';
  if (/visita/.test(raw))  return 'visita';
  if (/negociar|seguim/.test(raw)) return 'seguimiento';
  return 'tarea';
}

/** Resuelve centro con fallback seguro */
function centroCodigo(interaccion = {}){
  if (interaccion.centroCodigo) return interaccion.centroCodigo;
  if (interaccion.centroId && typeof _centroCodigoById === 'function') {
    try { return _centroCodigoById(interaccion.centroId) || ''; } catch(_){}
  }
  return '';
}

/** Convierte una interacción a evento de calendario */
export function toCalendarEvent(interaccion){
  if (!interaccion) return null;

  // Prioriza el próximo paso (lo que se agenda); acepta legacy fechaProx
  const startISO = safeISO(
    interaccion.proximoPasoFecha ||
    interaccion.fechaProx ||
    interaccion.fecha
  );
  if (!startISO) return null; // sin fecha válida no generamos evento

  const tipo = canonTipo(interaccion);
  const contacto = interaccion.contactoNombre || interaccion.proveedorNombre || 'Contacto';
  const centro = centroCodigo(interaccion);
  const tons = Number(interaccion.tonsConversadas ?? interaccion.tons ?? 0) || null;

  // Título compacto por tipo
  const title =
    tipo === 'llamada'     ? `📞 ${contacto}` :
    tipo === 'muestra'     ? `🧪 ${centro || contacto}` :
    tipo === 'reunion'     ? `🤝 ${contacto}` :
    tipo === 'visita'      ? `🗺️ ${centro || contacto}` :
    tipo === 'seguimiento' ? `🔁 ${contacto}` :
                             `✅ ${interaccion.proximoPaso || 'Tarea'}`;

  // Paleta simple por tipo (fallback gris)
  const colorMap = {
    llamada: '#1e88e5',
    muestra: '#8e24aa',
    reunion: '#43a047',
    visita: '#fb8c00',
    seguimiento: '#0ea5e9',
    tarea: '#546e7a'
  };

  return {
    id: interaccion._id || interaccion.id,
    title,
    start: startISO, // ISO-8601
    end: startISO,   // eventos puntuales
    color: colorMap[tipo] || '#546e7a',
    meta: {
      ...interaccion,
      tipoCanon: tipo,
      centroCodigo: centro,
      tonsConversadas: tons
    }
  };
}
