// src/context/CentrosContext.jsx
// Contexto global para acceder a los centros (y su certificación) desde cualquier parte de la app.
import { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';

const CentrosContext = createContext([]);

export const CentrosProvider = ({ children }) => {
  const [centros, setCentros] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    apiClient.get('/centros', { signal: controller.signal })
      .then((res) => {
        const items = Array.isArray(res) ? res : (res?.items || []);
        setCentros(items);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') console.warn('[CentrosContext] No se pudieron cargar los centros:', err?.message);
      });
    return () => controller.abort();
  }, []);

  return (
    <CentrosContext.Provider value={centros}>
      {children}
    </CentrosContext.Provider>
  );
};

/** Hook para acceder al listado completo de centros */
export const useCentrosContext = () => useContext(CentrosContext);

/**
 * Devuelve la certificación de un centro dado su código.
 * @param {string} code
 * @returns {string|null}  e.g. "ASC" | null
 */
export const useCentroCertificacion = (code) => {
  const centros = useContext(CentrosContext);
  if (!code || !centros.length) return null;
  const c = centros.find(c => String(c.code) === String(code));
  return (c?.certificacion && c.certificacion.trim()) ? c.certificacion.trim().toUpperCase() : null;
};
