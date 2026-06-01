import { apiClient } from '../../../api/apiClient';

export const getMuestreoDetail = (id) => apiClient.get(`/muestreos/${id}`);

export const getMuestreoReportDetail = (id) => apiClient.get(`/muestreos/${id}?audit=1`);

export const deleteMuestreo = (id) => apiClient.delete(`/muestreos/${id}`);

export const saveMuestreo = (id, payload) => {
  const endpoint = id ? `/muestreos/${id}` : '/muestreos';
  return id ? apiClient.patch(endpoint, payload) : apiClient.post(endpoint, payload);
};

export const createPublicMuestreoShare = (id) => apiClient.post(`/muestreos/${id}/share`);

export const uploadMuestreoEvidence = ({ file, category, samplingId }) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  formData.append('samplingId', samplingId || 'temp');

  return apiClient.post('/muestreos/evidencias/upload', formData);
};

export const deleteMuestreoEvidence = (key) => (
  apiClient.delete(`/muestreos/evidencias?key=${encodeURIComponent(key)}`)
);

export const getMuestreoDirectorySources = ({ signal } = {}) => Promise.all([
  apiClient.get('/centros', { signal }),
  apiClient.get('/contactos', { signal }),
]);

export const createMuestreoDirectoryContact = (payload) => apiClient.post('/contactos', payload);
