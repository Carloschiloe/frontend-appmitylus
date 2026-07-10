import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';
import {
  clearRuntimeLayoutState,
  clearSessionCache,
  persistUserSession,
  readCachedUser,
} from './authSession.helpers';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const checkAuth = async () => {
      try {
        const cachedUser = readCachedUser();
        if (cachedUser) setUser(cachedUser);

        const data = await apiClient.get('/auth/me', { signal: controller.signal });
        if (data?.ok && data.usuario) {
          setUser(data.usuario);
          persistUserSession(data.usuario);
        } else {
          clearSessionCache({ clearTenant: true });
          clearRuntimeLayoutState();
          setUser(null);
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
        clearSessionCache({ clearTenant: true });
        clearRuntimeLayoutState();
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
          persistUserSession(data.usuario);
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

      // El servidor pide el código 2FA antes de entregar sesión
      if (data.requires2FA) {
        return { success: false, requires2FA: true, pendingToken: data.pendingToken };
      }

      const usuario = data.usuario || data.user || data.item;
      if (!usuario) return { success: false, error: 'Respuesta de autenticación inválida' };

      clearSessionCache({ clearTenant: true });
      clearRuntimeLayoutState();
      persistUserSession(usuario);
      setUser(usuario);
      return { success: true, usuario };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Llamado por Login.jsx tras verificar el código 2FA exitosamente
  const completeLogin = (usuario) => {
    clearSessionCache({ clearTenant: true });
    clearRuntimeLayoutState();
    persistUserSession(usuario);
    setUser(usuario);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      // Cerrar sesion local incluso si la red falla.
    }
    clearSessionCache({ clearTenant: true });
    clearRuntimeLayoutState();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, completeLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
