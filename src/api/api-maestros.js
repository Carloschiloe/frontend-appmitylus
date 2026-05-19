import { apiClient } from './apiClient';

const normalizeItems = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.docs)) return res.docs;
  if (Array.isArray(res?.results)) return res.results;
  return [];
};

const buildMaestrosUrl = ({ tipo, soloActivos } = {}) => {
  const params = new URLSearchParams();
  if (tipo) params.set('tipo', tipo);
  if (soloActivos !== undefined) params.set('soloActivos', String(Boolean(soloActivos)));
  const query = params.toString();
  return `/maestros${query ? `?${query}` : ''}`;
};

export const maestrosApi = {
  getMaestros: async (tipo) => {
    const res = await apiClient.get(buildMaestrosUrl({ tipo }));
    return normalizeItems(res);
  },
  
  getMaestrosActivos: async (tipo) => {
    const res = await apiClient.get(buildMaestrosUrl({ tipo, soloActivos: true }));
    return normalizeItems(res);
  },

  crearMaestro: async (data) => {
    return apiClient.post('/maestros', data);
  },

  actualizarMaestro: async (id, data) => {
    return apiClient.patch(`/maestros/${id}`, data);
  },

  eliminarMaestro: async (id) => {
    return apiClient.delete(`/maestros/${id}`);
  }
};
