// api.js
const API_URL = 'https://backend-appmitylus-production.up.railway.app/api';

// Utilidad común
async function checkResponse(resp) {
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status} - ${text}`);
  }
  // Puede haber 204 sin body
  if (resp.status === 204) return null;
  return resp.json();
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

/* ==================== CENTROS ==================== */
export async function apiGetCentros() {
  const resp = await fetch(`${API_URL}/centros`);
  return checkResponse(resp);
}
export async function apiCreateCentro(data) {
  const resp = await fetch(`${API_URL}/centros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return checkResponse(resp);
}
export async function apiUpdateCentro(id, data) {
  const resp = await fetch(`${API_URL}/centros/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return checkResponse(resp);
}
export async function apiDeleteCentro(id) {
  const resp = await fetch(`${API_URL}/centros/${id}`, { method: 'DELETE' });
  return checkResponse(resp);
}

/* LÍNEAS */
export async function apiAddLinea(centroId, data) {
  const resp = await fetch(`${API_URL}/centros/${centroId}/lines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return checkResponse(resp);
}
export async function apiUpdateLinea(centroId, lineaId, data) {
  const resp = await fetch(`${API_URL}/centros/${centroId}/lines/${lineaId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return checkResponse(resp);
}
export async function apiDeleteLinea(centroId, lineaId) {
  const resp = await fetch(`${API_URL}/centros/${centroId}/lines/${lineaId}`, {
    method: 'DELETE'
  });
  return checkResponse(resp);
}

/* INVENTARIO LÍNEA */
export async function apiAddInventarioLinea(centroId, lineaId, data) {
  const resp = await fetch(`${API_URL}/centros/${centroId}/lines/${lineaId}/inventarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return checkResponse(resp);
}

/* BULK CENTROS */
export async function apiBulkUpsertCentros(arr) {
  const resp = await fetch(`${API_URL}/centros/bulk-upsert`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arr)
  });
  return checkResponse(resp);
}

/* ==================== CONTACTOS ==================== */
export async function apiGetContactos() {
  const resp = await fetch(`${API_URL}/contactos`);
  return checkResponse(resp);
}
export async function apiCreateContacto(data) {
  const resp = await fetch(`${API_URL}/contactos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return checkResponse(resp);
}
// PATCH con fallback a PUT
export async function apiUpdateContacto(id, data) {
  const url = `${API_URL}/contactos/${id}`;
  const opts = (m) => ({
    method: m,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  let resp = await fetch(url, opts('PATCH'));
  if (resp.status === 404 || resp.status === 405 || resp.status === 501) {
    resp = await fetch(url, opts('PUT'));
  }
  return checkResponse(resp);
}
export async function apiDeleteContacto(id) {
  const resp = await fetch(`${API_URL}/contactos/${id}`, { method: 'DELETE' });
  return checkResponse(resp);
}

/* ==================== VISITAS ==================== */
export async function apiGetVisitas(params = {}) {
  const qs = buildQS(params);
  const resp = await fetch(`${API_URL}/visitas${qs}`);
  const json = await checkResponse(resp);
  return Array.isArray(json) ? json : (Array.isArray(json?.items) ? json.items : []);
}
export async function apiGetVisitasByContacto(contactoId) {
  if (!contactoId) return [];
  const url = `${API_URL}/visitas${buildQS({ contactoId })}`;
  try {
    const resp = await fetch(url);
    if (resp.status === 404) return [];
    const json = await checkResponse(resp);
    return Array.isArray(json) ? json : (Array.isArray(json?.items) ? json.items : []);
  } catch {
    return [];
  }
}
export async function apiCreateVisita(data) {
  const resp = await fetch(`${API_URL}/visitas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return checkResponse(resp);
}
export async function apiUpdateVisita(id, data) {
  const url = `${API_URL}/visitas/${id}`;
  const opts = (m) => ({
    method: m,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  let resp = await fetch(url, opts('PATCH'));
  if (resp.status === 404 || resp.status === 405 || resp.status === 501) {
    resp = await fetch(url, opts('PUT'));
  }
  return checkResponse(resp);
}
export async function apiDeleteVisita(id) {
  const resp = await fetch(`${API_URL}/visitas/${id}`, { method: 'DELETE' });
  return checkResponse(resp);
}

/* ======= CONTACTOS DISPONIBLES (Planificación) ======= */
export async function apiContactosDisponibles({ q = '', minTons = 1 } = {}) {
  const n = Number(minTons);
  const qs = buildQS({ q, minTons: Number.isFinite(n) ? n : 1 });
  const resp = await fetch(`${API_URL}/contactos/disponibles${qs}`);
  const json = await checkResponse(resp);
  // Normaliza la salida a array
  return Array.isArray(json) ? json : (json?.items || []);
}

// Útil para debug en UI (lista TODO sin filtro por toneladas)
export async function apiContactosDisponiblesAll({ q = '' } = {}) {
  return apiContactosDisponibles({ q, minTons: 0 });
}
