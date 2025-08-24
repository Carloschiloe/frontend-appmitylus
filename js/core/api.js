// /js/core/api.js

// 👉 Opción simple: detecta local vs producción
// /js/core/api.js
const API_URL = '/api';

/* ===================== Helpers comunes ===================== */

// Respuesta segura (tolera 204 y respuestas sin body)
async function checkResponse(resp) {
  if (!resp.ok) {
    const text = await safeReadText(resp);
    throw new Error(`HTTP ${resp.status} - ${text}`);
  }
  if (resp.status === 204) return null;

  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return resp.json();
  return resp.text();
}

async function safeReadText(resp) {
  try { return await resp.text(); } catch { return '(sin cuerpo)'; }
}

// QS helper: evita mandar claves vacías/undefined/null
function buildQS(params = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') clean[k] = v;
  }
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : '';
}

/**
 * Wrapper de fetch con:
 *  - Fallback PATCH→PUT si el server no soporta PATCH (405/404/501)
 *  - Reintento 1 vez si hay error de red/DNS/timeout (en PATCH reintenta como PUT)
 */
async function request(path, { method = 'GET', json, headers = {}, retry = true } = {}) {
  const url = `${API_URL}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (json !== undefined) opts.body = JSON.stringify(json);

  let resp;
  try {
    resp = await fetch(url, opts);
  } catch (e) {
    if (!retry) throw e;
    const fallbackMethod = method === 'PATCH' ? 'PUT' : method;
    const resp2 = await fetch(url, { ...opts, method: fallbackMethod });
    return checkResponse(resp2);
  }

  if (
    retry &&
    method === 'PATCH' &&
    (!resp.ok && (resp.status === 404 || resp.status === 405 || resp.status === 501))
  ) {
    const resp2 = await fetch(url, { ...opts, method: 'PUT' });
    return checkResponse(resp2);
  }

  return checkResponse(resp);
}

/* ==================== CENTROS ==================== */
export async function apiGetCentros() { return request('/centros'); }
export async function apiCreateCentro(data) { return request('/centros', { method: 'POST', json: data }); }
export async function apiUpdateCentro(id, data) { return request(`/centros/${id}`, { method: 'PUT', json: data }); }
export async function apiDeleteCentro(id) { return request(`/centros/${id}`, { method: 'DELETE' }); }

/* LÍNEAS */
export async function apiAddLinea(centroId, data) {
  return request(`/centros/${centroId}/lines`, { method: 'POST', json: data });
}
export async function apiUpdateLinea(centroId, lineaId, data) {
  return request(`/centros/${centroId}/lines/${lineaId}`, { method: 'PUT', json: data });
}
export async function apiDeleteLinea(centroId, lineaId) {
  return request(`/centros/${centroId}/lines/${lineaId}`, { method: 'DELETE' });
}

/* INVENTARIO LÍNEA */
export async function apiAddInventarioLinea(centroId, lineaId, data) {
  return request(`/centros/${centroId}/lines/${lineaId}/inventarios`, { method: 'POST', json: data });
}

/* BULK CENTROS */
export async function apiBulkUpsertCentros(arr) {
  return request('/centros/bulk-upsert', { method: 'PUT', json: arr });
}

/* ==================== CONTACTOS ==================== */
export async function apiGetContactos() { return request('/contactos'); }
export async function apiCreateContacto(data) { return request('/contactos', { method: 'POST', json: data }); }
// PATCH con fallback a PUT y reintento (para updates grandes)
export async function apiUpdateContacto(id, data) {
  return request(`/contactos/${id}`, { method: 'PATCH', json: data, retry: true });
}
export async function apiDeleteContacto(id) { return request(`/contactos/${id}`, { method: 'DELETE' }); }
// PATCH seguro sin fallback (para NO pisar otros campos)
export async function apiPatchContactoSafe(id, data) {
  return request(`/contactos/${id}`, { method: 'PATCH', json: data, retry: false });
}

/* ==================== VISITAS ==================== */
export async function apiGetVisitas(params = {}) {
  const qs = buildQS(params);
  const json = await request(`/visitas${qs}`);
  return Array.isArray(json) ? json : (Array.isArray(json?.items) ? json.items : []);
}
export async function apiGetVisitasByContacto(contactoId) {
  if (!contactoId) return [];
  const qs = buildQS({ contactoId });
  try {
    const json = await request(`/visitas${qs}`);
    return Array.isArray(json) ? json : (Array.isArray(json?.items) ? json.items : []);
  } catch { return []; }
}
export async function apiCreateVisita(data) { return request('/visitas', { method: 'POST', json: data }); }
export async function apiUpdateVisita(id, data) {
  return request(`/visitas/${id}`, { method: 'PATCH', json: data, retry: true });
}
export async function apiDeleteVisita(id) { return request(`/visitas/${id}`, { method: 'DELETE' }); }

/* ======= CONTACTOS DISPONIBLES (Planificación) ======= */
export async function apiContactosDisponibles({ q = '', minTons = 1 } = {}) {
  const n = Number(minTons);
  const qs = buildQS({ q, minTons: Number.isFinite(n) ? n : 1 });
  const json = await request(`/contactos/disponibles${qs}`);
  return Array.isArray(json) ? json : (json?.items || []);
}
export async function apiContactosDisponiblesAll({ q = '' } = {}) {
  return apiContactosDisponibles({ q, minTons: 0 });
}
