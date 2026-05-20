import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import './login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Credenciales inválidas');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-visual">
        <div className="login-visual-overlay"></div>
        <div className="login-ocean" aria-hidden="true">
          <span className="ocean-glow ocean-glow-a"></span>
          <span className="ocean-glow ocean-glow-b"></span>
          <span className="ocean-grid"></span>
          <span className="ocean-current"></span>
          <span className="ocean-wave ocean-wave-a"></span>
          <span className="ocean-wave ocean-wave-b"></span>
        </div>
        <div className="login-brand-mark" aria-hidden="true">
          <img src="/img/brand/mitynex-logo-new.svg" alt="" />
        </div>
        <div className="login-visual-content">
          <div className="login-logo-big">
            <span className="logo-icon">
              <img src="/img/brand/mitynex-icon-new.svg" alt="" />
            </span>
            <h1>Mitynex Prime</h1>
          </div>
          <p>Plataforma inteligente para la gestión de la industria mitilicultora.</p>
        </div>
      </div>
      
      <div className="login-form-side">
        <div className="login-form-wrap">
          <header>
            <h2>Bienvenido</h2>
            <p>Ingresa tus credenciales para acceder al sistema</p>
          </header>

          {error && (
            <div className="login-error-alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label>Correo Electrónico</label>
              <div className="login-input-wrap">
                <Mail className="input-icon" size={18} />
                <input 
                  type="email" 
                  placeholder="usuario@mitynex.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label>Contraseña</label>
              <div className="login-input-wrap">
                <Lock className="input-icon" size={18} />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-actions">
              <label className="login-remember">
                <input type="checkbox" />
                <span>Recordarme</span>
              </label>
              <a href="#" className="login-forgot">¿Olvidaste tu contraseña?</a>
            </div>

            <button 
              type="submit" 
              className="login-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Iniciando sesión...
                </>
              ) : 'Entrar al Sistema'}
            </button>
          </form>

          <footer>
            <p>&copy; 2026 Mitynex Prime. Todos los derechos reservados.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
