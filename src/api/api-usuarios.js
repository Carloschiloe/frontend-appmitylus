import { apiClient } from './apiClient';

const BASE_URL = '/auth/usuarios';

export const usuariosApi = {
  /**
   * Obtiene la lista de todos los usuarios.
   * params.scope = 'all' fuerza ver todas las empresas (panel saas-admin),
   * ignorando la empresa seleccionada en el selector de tenant.
   */
  getUsuarios: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const data = await apiClient.get(`${BASE_URL}${query ? `?${query}` : ''}`);
    return data.items || [];
  },

  /**
   * Crea un nuevo usuario
   */
  crearUsuario: async (payload) => {
    const data = await apiClient.post(BASE_URL, payload);
    return data.item || data;
  },

  /**
   * Actualiza un usuario existente
   */
  actualizarUsuario: async (id, payload) => {
    const data = await apiClient.patch(`${BASE_URL}/${id}`, payload);
    return data.item || data;
  },

  /**
   * Elimina un usuario permanentemente
   */
  eliminarUsuario: async (id) => {
    const data = await apiClient.delete(`${BASE_URL}/${id}`);
    return data;
  },

  /**
   * Alterna el estado activo/inactivo de un usuario
   */
  toggleEstado: async (id, isActive) => {
    const data = await apiClient.patch(`${BASE_URL}/${id}`, { activo: isActive });
    return data.item || data;
  },

  /**
   * Restablece la contraseña de un usuario
   */
  restablecerPassword: async (id) => {
    const data = await apiClient.post(`${BASE_URL}/${id}/reset-password`);
    return data;
  }
};
