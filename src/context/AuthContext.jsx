import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';

const AuthContext = createContext(null);

function clearSessionCache({ clearTenant = false } = {}) {
  localStorage.removeItem('ammpp_token');
  localStorage.removeItem('ammpp_refresh_token');
  localStorage.removeItem('ammpp_user');
  if (clearTenant) localStorage.removeItem('selected_tenant_db');
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const checkAuth = async () => {
      try {
        const cachedUserRaw = localStorage.getItem('ammpp_user');

        if (cachedUserRaw) {
          try {
            setUser(JSON.parse(cachedUserRaw));
          } catch {
            localStorage.removeItem('ammpp_user');
          }
        }

        const data = await apiClient.get('/auth/me', { signal: controller.signal });
        if (data?.ok && data.usuario) {
          setUser(data.usuario);
          localStorage.setItem('ammpp_user', JSON.stringify(data.usuario));

          // Auto-seleccionar tenant si el usuario tiene empresa asignada (Self-healing)
          const currentTenant = localStorage.getItem('selected_tenant_db');
          if (!currentTenant) {
            const empresaData = data.usuario.empresaId;
            if (empresaData && typeof empresaData === 'object' && empresaData.dbName) {
              localStorage.setItem('selected_tenant_db', empresaData.dbName);
              localStorage.setItem('selected_tenant_nombre', empresaData.nombre || '');
              localStorage.setItem('selected_tenant_logo', empresaData.config?.logo || '');
            } else if (data.usuario.dbName) {
              localStorage.setItem('selected_tenant_db', data.usuario.dbName);
            }
          }
        } else {
          clearSessionCache();
          setUser(null);
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
        clearSessionCache({ clearTenant: true });
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const refreshSession = async () => {
      try {
        const data = await apiClient.post('/auth/refresh', {});
        if (data?.ok && data.usuario) {
          setUser(data.usuario);
          localStorage.setItem('ammpp_user', JSON.stringify(data.usuario));
        }
      } catch {
        // La siguiente llamada privada recibira 401 y redirigira si corresponde.
      }
    };

    const intervalId = window.setInterval(refreshSession, 15 * 60 * 1000);
    window.addEventListener('focus', refreshSession);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshSession);
    };
  }, [user]);

  const login = async (email, password) => {
    try {
      const data = await apiClient.post('/auth/login', { email, password });
      const usuario = data.usuario || data.user || data.item;

      if (!usuario) {
        return { success: false, error: 'Respuesta de autenticacion invalida' };
      }

      clearSessionCache();
      localStorage.setItem('ammpp_user', JSON.stringify(usuario));

      // Auto-seleccionar tenant si el usuario tiene empresa asignada
      const empresaData = usuario.empresaId;
      if (empresaData && typeof empresaData === 'object' && empresaData.dbName) {
        localStorage.setItem('selected_tenant_db', empresaData.dbName);
        localStorage.setItem('selected_tenant_nombre', empresaData.nombre || '');
        localStorage.setItem('selected_tenant_logo', empresaData.config?.logo || '');
      } else if (usuario.dbName) {
        // Fallback: dbName directamente en el token/usuario
        localStorage.setItem('selected_tenant_db', usuario.dbName);
      }

      setUser(usuario);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      // Cerrar sesion local incluso si la red falla.
    }
    clearSessionCache({ clearTenant: true });
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
