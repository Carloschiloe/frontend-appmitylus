// js/abastecimiento/tratos/api.js
// Comunicación con /api/oportunidades (módulo Tratos)

const BASE = '/api/oportunidades';

async function req(url, options = {}) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(json?.message || r.statusText), { status: r.status, data: json });
  return json;
}

/** Lista tratos con filtros opcionales { from, to, estado, proveedorKey, proveedorId, centroId } */
export async function listTratos(filters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== null && v !== undefined && v !== '') params.set(k, v);
  }
  const qs = params.toString();
  const data = await req(`${BASE}/tratos${qs ? '?' + qs : ''}`);
  return data.items || [];
}

/** Crea un nuevo trato (oportunidad) */
export async function createTrato(payload) {
  const data = await req(BASE, { method: 'POST', body: JSON.stringify(payload) });
  return data.item || data;
}

/** Actualiza campos de trato (período, tons, precio, notas, responsable) */
export async function updateTrato(id, payload) {
  const data = await req(`${BASE}/${id}/trato`, { method: 'PATCH', body: JSON.stringify(payload) });
  return data.item || data;
}

/** Cambia estado del trato */
export async function changeEstado(id, estado, observacion = '') {
  const data = await req(`${BASE}/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado, observacion }),
  });
  return data.item || data;
}

/** Agrega o actualiza una condición */
export async function upsertCondicion(id, condicion) {
  const data = await req(`${BASE}/${id}/condiciones`, {
    method: 'POST',
    body: JSON.stringify(condicion),
  });
  return data.item || data;
}

/** Elimina una condición */
export async function removeCondicion(id, condicionId) {
  const data = await req(`${BASE}/${id}/condiciones/${condicionId}`, { method: 'DELETE' });
  return data.item || data;
}

/** Obtiene tratos de un proveedor específico */
export async function getTratosByProveedor(proveedorId) {
  const data = await req(`${BASE}/proveedor/${proveedorId}`);
  return data.items || [];
}

/** Obtiene historial de responsable de un contacto */
export async function getHistorialResponsable(proveedorId) {
  const data = await req(`${BASE}/proveedor/${proveedorId}/historial`);
  return data;
}

/** Obtiene un contacto por ID (para ver responsableHistorial) */
export async function getContacto(contactoId) {
  const data = await req(`/api/contactos/${contactoId}`);
  return data.item || data;
}

/** Lista condiciones de negociación del maestro (activas) */
export async function listCondicionesMaestro() {
  const data = await req('/api/maestros?tipo=condicion_negociacion&soloActivos=true');
  return data.items || [];
}

/** Cierra un trato como perdido o descartado con motivo obligatorio */
export async function cerrarPerdido(id, { estado, motivoPerdida, observacion = '' }) {
  const data = await req(`${BASE}/${id}/cerrar-perdido`, {
    method: 'POST',
    body: JSON.stringify({ estado, motivoPerdida, observacion, fechaCierre: new Date().toISOString() }),
  });
  return data.item || data;
}

/** Elimina un trato completo */
export async function deleteTrato(id) {
  return req(`/api/oportunidades/${id}`, { method: 'DELETE' });
}
