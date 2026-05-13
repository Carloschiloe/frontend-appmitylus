import { apiClient } from './apiClient';

const BASE = '/centros';

export async function getCentros(filters = {}, options = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });

  const res = await apiClient.get(`${BASE}${params.size ? `?${params}` : ''}`, options);
  return Array.isArray(res) ? res : (res.items || []);
}

export async function getCentrosMapa(options = {}) {
  try {
    const res = await apiClient.get(`${BASE}/mapa`, options);
    return Array.isArray(res) ? res : (res.items || []);
  } catch (error) {
    if (error?.status === 404) {
      return getCentros({}, options);
    }
    throw error;
  }
}

export async function getCentroById(id) {
  return apiClient.get(`${BASE}/${id}`);
}


export async function upsertCentro(payload) {
  const method = payload._id ? 'patch' : 'post';
  const url = payload._id ? `${BASE}/${payload._id}` : BASE;
  return apiClient[method](url, payload);
}

export async function deleteCentro(id) {
  return apiClient.delete(`${BASE}/${id}`);
}

export async function exportCentros(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });

  return apiClient.get(`${BASE}/export${params.size ? `?${params}` : ''}`);
}

export async function syncSubpesca() {
  return apiClient.post(`${BASE}/sync-subpesca`);
}
