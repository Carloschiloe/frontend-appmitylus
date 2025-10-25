import { state } from '../state.js';
import { centroCodigoById } from '../../visitas/normalizers.js';

// Detecta “nuevo contacto” por flag guardado al registrarlo.
// Ajusta los posibles nombres según tu esquema real:
export function esContactoNuevo(contactoId){
  const c = (state.contactosById && state.contactosById[contactoId]) || null;
  if (!c) return false;
  return !!(c.esNuevoProveedor || c.esNuevoContacto || c.nuevoProveedor || c.isNewSupplier);
}

export function toCalendarEvent(interaccion){
  const start = interaccion.fechaProx || interaccion.fecha;
  const contacto = interaccion.contactoNombre || interaccion.proveedorNombre || 'Contacto';
  const centro = interaccion.centroCodigo || centroCodigoById(interaccion.centroId) || '';
  const tipo = interaccion.tipo || 'tarea';

  const title =
    tipo === 'llamada' ? `📞 ${contacto}`
  : tipo === 'muestra' ? `🧪 Muestra ${centro || contacto}`
  : tipo === 'reunion' ? `🤝 Reunión ${contacto}`
  : tipo === 'visita'  ? `🗺️ Visita ${centro}`
  : `✅ ${interaccion.proximoPaso || 'Tarea'}`;

  const color =
    tipo === 'llamada' ? '#1e88e5'
  : tipo === 'muestra' ? '#8e24aa'
  : tipo === 'reunion' ? '#43a047'
  : tipo === 'visita'  ? '#fb8c00'
  : '#546e7a';

  return {
    id: interaccion._id,
    title,
    start,
    end: start,
    color,
    meta: interaccion
  };
}
