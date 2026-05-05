import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import './login.css';

export default function ActivarCuenta() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/activar-cuenta', { token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'El link es inválido o ya fue utilizado. Solicita uno nuevo al administrador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-visual">
        <div className="login-visual-overlay"></div>
        <div className="login-visual-content">
          <div className="login-logo-big">
            <span className="logo-icon">M</span>
            <h1>Mitynex Prime</h1>
          </div>
          <p>Establece tu contraseña para comenzar a usar la plataforma.</p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-form-wrap">
          {success ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <CheckCircle2 size={56} color="var(--color-success)" style={{ marginBottom: '16px' }} />
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>¡Cuenta activada!</h2>
                <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>
                  Tu contraseña fue establecida correctamente. Ya puedes ingresar.
                </p>
              </div>
              <button className="login-submit-btn" onClick={() => navigate('/login')}>
                Ir al inicio de sesión
              </button>
            </>
          ) : (
            <>
              <header>
                <h2>Activa tu cuenta</h2>
                <p>Elige una contraseña segura para acceder a Mitynex.</p>
              </header>

              {!token && (
                <div className="login-error-alert">
                  <AlertCircle size={18} />
                  <span>Link inválido. Solicita un nuevo acceso al administrador.</span>
                </div>
              )}

              {error && (
                <div className="login-error-alert">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="login-field">
                  <label>Nueva contraseña</label>
                  <div className="login-input-wrap">
                    <Lock className="input-icon" size={18} />
                    <input
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={!token}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="login-field">
                  <label>Confirmar contraseña</label>
                  <div className="login-input-wrap">
                    <Lock className="input-icon" size={18} />
                    <input
                      type="password"
                      placeholder="Repite tu contraseña"
                      value={confirmar}
                      onChange={(e) => setConfirmar(e.target.value)}
                      required
                      disabled={!token}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={isSubmitting || !token}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Activando cuenta...
                    </>
                  ) : 'Activar mi cuenta'}
                </button>
              </form>
            </>
          )}

          <footer>
            <p>&copy; 2026 Mitynex Prime. Todos los derechos reservados.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
