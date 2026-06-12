import { apiClient } from './apiClient';

const BASE = '/planificacion';
const BASE_ASIG = '/asignaciones';
const BASE_DISP = '/disponibilidades';

// ── Disponibilidades ──────────────────────────────────────────────────────────

export async function getDisponibilidades({ mesKey, proveedorKey, anio, from, to } = {}) {
  const params = new URLSearchParams();
  if (mesKey) params.set('mesKey', mesKey);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (anio && !mesKey && !from && !to) params.set('anio', anio);
  if (proveedorKey) params.set('proveedorKey', proveedorKey);

  const data = await apiClient.get(`${BASE_DISP}${params.size ? `?${params}` : ''}`);
  const items = Array.isArray(data) ? data : (data.items || []);
  return items.map(d => ({ ...d, tons: d.tonsDisponible ?? d.tons ?? 0 }));
}

export async function crearDisponibilidad(payload) {
  const data = await apiClient.post(`${BASE_DISP}`, payload);
  return data.item || data;
}

export async function editarDisponibilidad(id, payload) {
  const data = await apiClient.patch(`${BASE_DISP}/${id}`, payload);
  return data.item || data;
}

export async function crearTratoDesdeDisponibilidad(id, payload) {
  const data = await apiClient.post(`${BASE_DISP}/${id}/crear-trato`, payload);
  return data.item || data;
}

export async function borrarDisponibilidad(id) {
  return apiClient.delete(`${BASE_DISP}/${id}`);
}

// ── Asignaciones (Compras) ────────────────────────────────────────────────────

export async function getAsignaciones({ mesKey, from, to, anio } = {}) {
  const params = new URLSearchParams();
  const fromKey = mesKey || from;
  const toKey = mesKey || to;
  if (fromKey) params.set('from', fromKey);
  if (toKey)   params.set('to', toKey);
  if (anio && !fromKey) params.set('anio', anio);

  const data = await apiClient.get(`${BASE_ASIG}${params.size ? `?${params}` : ''}`);
  return Array.isArray(data) ? data : (data.items || []);
}

export async function crearAsignacion(payload) {
  const data = await apiClient.post(`${BASE_ASIG}`, payload);
  return data.item || data;
}

export async function editarAsignacion(id, payload) {
  const data = await apiClient.patch(`${BASE_ASIG}/${id}`, payload);
  return data.item || data;
}

export async function borrarAsignacion(id) {
  return apiClient.delete(`${BASE_ASIG}/${id}`);
}

// ── Resumen mensual ───────────────────────────────────────────────────────────

export async function getResumenMensual({ mesKey } = {}) {
  const items = await getDisponibilidades({ mesKey });
  const totalDisponible = items.reduce((s, d) => s + (d.tons || 0), 0);
  return { totalDisponible, totalAsignado: 0, saldo: totalDisponible };
}

// ── Saldos (Balance) ──────────────────────────────────────────────────────────

export async function getSaldos({ anio, from, to } = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries({ anio, from, to }).filter(([, v]) => v != null && v !== ''))
  );
  const data = await apiClient.get(`${BASE}/saldos${params.size ? `?${params}` : ''}`);
  return Array.isArray(data) ? data : (data.items || []);
}
