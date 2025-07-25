// frontend/js/core/api.js

const API_URL = 'https://backend-appmitylus-production.up.railway.app/api';

// === CENTROS ===
export async function apiGetCentros() {
  const resp = await fetch(`${API_URL}/centros`);
  return await resp.json();
}
export async function apiCreateCentro(data) {
  const resp = await fetch(`${API_URL}/centros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await resp.json();
}
export async function apiUpdateCentro(id, data) {
  const resp = await fetch(`${API_URL}/centros/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await resp.json();
}
export async function apiDeleteCentro(id) {
  const resp = await fetch(`${API_URL}/centros/${id}`, {
    method: 'DELETE'
  });
  return await resp.json();
}

// === LÍNEAS ===
export async function apiAddLinea(centroId, data) {
  const resp = await fetch(`${API_URL}/centros/${centroId}/lineas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await resp.json();
}
export async function apiUpdateLinea(centroId, lineaId, data) {
  const resp = await fetch(`${API_URL}/centros/${centroId}/lineas/${lineaId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await resp.json();
}
export async function apiDeleteLinea(centroId, lineaId) {
  const resp = await fetch(`${API_URL}/centros/${centroId}/lineas/${lineaId}`, {
    method: 'DELETE'
  });
  return await resp.json();
}

// === INVENTARIO LÍNEA ===
export async function apiAddInventarioLinea(centroId, lineaId, data) {
  const resp = await fetch(`${API_URL}/centros/${centroId}/lineas/${lineaId}/inventarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await resp.json();
}
