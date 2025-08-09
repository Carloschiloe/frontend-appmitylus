const API_URL = 'https://backend-appmitylus-production.up.railway.app/api';

// === CENTROS ===
async function checkResponse(resp) {
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status} - ${text}`);
  }
  return resp.json();
}

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
  const resp = await fetch(`${API_URL}/centros/${id}`, {
    method: 'DELETE'
  });
  return checkResponse(resp);
}

// === LÍNEAS ===
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

// === INVENTARIO LÍNEA ===
export async function apiAddInventarioLinea(centroId, lineaId, data) {
  const resp = await fetch(`${API_URL}/centros/${centroId}/lines/${lineaId}/inventarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return checkResponse(resp);
}

// === BULK CENTROS ===
export async function apiBulkUpsertCentros(arr) {
  const resp = await fetch(`${API_URL}/centros/bulk-upsert`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arr)
  });
  return checkResponse(resp);
}


