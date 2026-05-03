import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('ammpp_token');
        
        if (!token) {
          setLoading(false);
          return;
        }

        // Validar token contra el servidor
        const data = await apiClient.get('/auth/me');
        if (data?.ok && data.usuario) {
          setUser(data.usuario);
          // Actualizar cache local con datos frescos
          localStorage.setItem('ammpp_user', JSON.stringify(data.usuario));
        } else {
          // Token inválido: limpiar sesión
          localStorage.removeItem('ammpp_token');
          localStorage.removeItem('ammpp_user');
        }
      } catch (e) {
        // Token expirado o error de red: limpiar
        localStorage.removeItem('ammpp_token');
        localStorage.removeItem('ammpp_user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const data = await apiClient.post('/auth/login', { email, password });
      const usuario = data.usuario || data.user || data.item;

      localStorage.setItem('ammpp_token', data.token);
      localStorage.setItem('ammpp_user', JSON.stringify(usuario));
      setUser(usuario);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('ammpp_token');
    localStorage.removeItem('ammpp_user');
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
