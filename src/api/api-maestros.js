import { apiClient } from './apiClient';

export const maestrosApi = {
  getMaestros: async (tipo) => {
    const res = await apiClient.get(`/maestros?tipo=${tipo}`);
    return res.items || [];
  },
  
  getMaestrosActivos: async (tipo) => {
    const res = await apiClient.get(`/maestros?tipo=${tipo}&soloActivos=true`);
    return res.items || [];
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
