import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/apiClient';

const QUERY_KEY = ['transportistas'];

const unwrapList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

export function useTransportistas() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => unwrapList(await apiClient.get('/transportistas')),
  });
}

export function useTransportistaMutations({ onSuccess, onError } = {}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const createTransportista = useMutation({
    mutationFn: (payload) => apiClient.post('/transportistas', payload),
    onSuccess: (...args) => {
      invalidate();
      onSuccess?.('Transportista guardado correctamente.', ...args);
    },
    onError,
  });

  const updateTransportista = useMutation({
    mutationFn: ({ id, payload }) => apiClient.put(`/transportistas/${id}`, payload),
    onSuccess: (...args) => {
      invalidate();
      onSuccess?.('Transportista actualizado correctamente.', ...args);
    },
    onError,
  });

  const updateTarifas = useMutation({
    mutationFn: ({ id, tarifas }) => apiClient.put(`/transportistas/${id}/tarifas`, { tarifas }),
    onSuccess: (...args) => {
      invalidate();
      onSuccess?.('Tarifa guardada correctamente.', ...args);
    },
    onError,
  });

  const deleteTransportista = useMutation({
    mutationFn: (id) => apiClient.delete(`/transportistas/${id}`),
    onSuccess: (...args) => {
      invalidate();
      onSuccess?.('Transportista desactivado correctamente.', ...args);
    },
    onError,
  });

  return {
    createTransportista,
    updateTransportista,
    updateTarifas,
    deleteTransportista,
  };
}
