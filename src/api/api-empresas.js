import { apiClient } from './apiClient';

const BASE_URL = '/empresas';

export const empresasApi = {
  /**
   * Obtiene la lista de todas las empresas
   */
  getEmpresas: async () => {
    const data = await apiClient.get(BASE_URL);
    return data.items || [];
  },

  /**
   * Obtiene una empresa por ID
   */
  getEmpresaById: async (id) => {
    const data = await apiClient.get(`${BASE_URL}/${id}`);
    return data.item || data;
  },

  /**
   * Crea una nueva empresa
   */
  createEmpresa: async (payload) => {
    const data = await apiClient.post(BASE_URL, payload);
    return data.item || data;
  },

  /**
   * Actualiza una empresa existente
   */
  updateEmpresa: async (id, payload) => {
    const data = await apiClient.patch(`${BASE_URL}/${id}`, payload);
    return data.item || data;
  },

  /**
   * Desactiva una empresa
   */
  deleteEmpresa: async (id) => {
    const data = await apiClient.delete(`${BASE_URL}/${id}`);
    return data;
  }
};
