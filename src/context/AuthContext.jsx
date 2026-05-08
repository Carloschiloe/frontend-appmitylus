import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

const AuthContext = createContext(null);

function getTokenExpMs(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const checkAuth = async () => {
      try {
        // En modo Cookies, no dependemos de la presencia del token en localStorage 
        // para intentar recuperar la sesión. Simplemente preguntamos al servidor.
        const cachedUserRaw = localStorage.getItem('ammpp_user');

        if (cachedUserRaw) {
          try {
            setUser(JSON.parse(cachedUserRaw));
          } catch {
            localStorage.removeItem('ammpp_user');
          }
        }

        // Validar token contra el servidor
        const data = await apiClient.get('/auth/me', { signal: controller.signal });
        if (data?.ok && data.usuario) {
          setUser(data.usuario);
          localStorage.setItem('ammpp_user', JSON.stringify(data.usuario));
        } else {
          // Si el servidor dice que no hay sesión, limpiamos todo
          localStorage.removeItem('ammpp_token');
          localStorage.removeItem('ammpp_refresh_token');
          localStorage.removeItem('ammpp_user');
          setUser(null);
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
        // Token expirado o error de red: limpiar
        localStorage.removeItem('ammpp_token');
        localStorage.removeItem('ammpp_refresh_token');
        localStorage.removeItem('ammpp_user');
        localStorage.removeItem('selected_tenant_db');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
    return () => controller.abort();
  }, []);

  // Auto-refresh: renueva el token 30 min antes de que expire
  useEffect(() => {
    if (!user) return;

    const scheduleRefresh = () => {
      const token = localStorage.getItem('ammpp_token');
      if (!token) return null;
      const expMs = getTokenExpMs(token);
      if (!expMs) return null;
      const delay = Math.max(expMs - Date.now() - 30 * 60 * 1000, 0);

      return setTimeout(async () => {
        try {
          // El refresh ahora es automático vía cookies, pero enviamos el legacy 
          // si existe para máxima compatibilidad con el backend actual.
          const refreshToken = localStorage.getItem('ammpp_refresh_token');
          const data = await apiClient.post('/auth/refresh', { refreshToken });
          
          if (data?.token) {
            localStorage.setItem('ammpp_token', data.token);
            if (data.usuario) {
              setUser(data.usuario);
              localStorage.setItem('ammpp_user', JSON.stringify(data.usuario));
            }
            scheduleRefresh();
          }
        } catch {
          // Silencioso
        }
      }, delay);
    };

    const timerId = scheduleRefresh();
    return () => { if (timerId) clearTimeout(timerId); };
  }, [user]);

  const login = async (email, password) => {
    try {
      const data = await apiClient.post('/auth/login', { email, password });
      const usuario = data.usuario || data.user || data.item;

      localStorage.setItem('ammpp_token', data.token);
      if (data.refreshToken) localStorage.setItem('ammpp_refresh_token', data.refreshToken);
      localStorage.setItem('ammpp_user', JSON.stringify(usuario));
      setUser(usuario);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout', {});
    } catch { /* ignorar errores de red al cerrar sesión */ }
    localStorage.removeItem('ammpp_token');
    localStorage.removeItem('ammpp_refresh_token');
    localStorage.removeItem('ammpp_user');
    localStorage.removeItem('selected_tenant_db');
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
