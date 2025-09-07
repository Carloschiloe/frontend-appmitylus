// api_insumos.js — versión alineada a Vercel y tolerante a window.API_URL

// Base API: toma window.API_URL si existe; si no, usa Vercel por defecto
const API_BASE =
  (typeof window !== 'undefined' && window.API_URL)
    ? `${window.API_URL}`
    : 'https://backend-appmitylus.vercel.app/api';

// Endpoint de insumos
const API_URL = `${API_BASE}/insumos`;

export async function apiGetMovimientos() {
  const resp = await fetch(API_URL);
  if (!resp.ok) throw new Error('Error al obtener movimientos');
  return resp.json();
}

export async function apiCreateMovimiento(data) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!resp.ok) throw new Error('Error al crear movimiento');
  return resp.json();
}

export async function apiUpdateMovimiento(id, data) {
  const resp = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!resp.ok) throw new Error('Error al actualizar movimiento');
  return resp.json();
}

export async function apiDeleteMovimiento(id) {
  const resp = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error('Error al eliminar movimiento');
  return resp.json();
}
