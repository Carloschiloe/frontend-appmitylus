import { apiClient } from './apiClient';

const BASE = '/oportunidades';

export async function listOportunidades(filters = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null))
  ).toString();
  const data = await apiClient.get(`${BASE}${qs ? `?${qs}` : ''}`);
  return Array.isArray(data) ? data : (data.items || []);
}

export async function cambiarEstado(id, estado, observacion) {
  return apiClient.patch(`${BASE}/${id}/estado`, { estado, observacion: observacion || '' });
}

export async function actualizarSeguimiento(id, payload) {
  return apiClient.patch(`${BASE}/${id}/seguimiento`, payload);
}

export async function quickCaptureSeguimiento(payload) {
  return apiClient.post(`${BASE}/quick-capture`, payload);
}

export async function cerrarExitoso(id, observacion) {
  return apiClient.post(`${BASE}/${id}/cerrar-exitoso`, { observacion: observacion || '' });
}

export async function cerrarPerdido(id, motivoPerdida, observacion, estado = 'perdido') {
  return apiClient.post(`${BASE}/${id}/cerrar-perdido`, { motivoPerdida, observacion: observacion || '', estado });
}
