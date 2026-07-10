import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { verify2FALogin } from '../../api/api-2fa';
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import './login.css';

// Si la cuenta tiene acceso acotado a módulos específicos, entra directo
// ahí en vez del Dashboard general (que no podría ver de todas formas).
function landingPath(usuario) {
  const modulos = usuario?.modulosPermitidos || [];
  return modulos.length > 0 ? modulos[0] : '/dashboard';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Paso 2FA
  const [step, setStep] = useState('credentials'); // 'credentials' | '2fa'
  const [pendingToken, setPendingToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const totpRef = useRef(null);

  const { login, completeLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.requires2FA) {
        setPendingToken(result.pendingToken);
        setStep('2fa');
        setTimeout(() => totpRef.current?.focus(), 100);
        return;
      }
      if (result.success) {
        navigate(landingPath(result.usuario));
      } else {
        setError(result.error || 'Credenciales inválidas');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const data = await verify2FALogin(pendingToken, totpCode);
      completeLogin(data.usuario);
      navigate(landingPath(data.usuario));
    } catch (err) {
      setError(err.message || 'Código incorrecto o expirado');
      setTotpCode('');
      totpRef.current?.focus();
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

          {step === 'credentials' && (
            <>
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
                      type={showPassword ? 'text' : 'password'}
                      className="login-input-with-toggle"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="login-toggle-password"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="login-actions">
                  <label className="login-remember">
                    <input type="checkbox" />
                    <span>Recordarme</span>
                  </label>
                  <a href="#" className="login-forgot">¿Olvidaste tu contraseña?</a>
                </div>

                <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="animate-spin" size={18} /> Iniciando sesión...</>
                  ) : 'Entrar al Sistema'}
                </button>
              </form>
            </>
          )}

          {step === '2fa' && (
            <>
              <header>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <ShieldCheck size={22} color="#0ea5e9" />
                  <h2 style={{ margin: 0 }}>Verificación 2FA</h2>
                </div>
                <p>Abre Google Authenticator en tu celular e ingresa el código de 6 dígitos.</p>
              </header>

              {error && (
                <div className="login-error-alert">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerify2FA}>
                <div className="login-field">
                  <label>Código de verificación</label>
                  <div className="login-input-wrap">
                    <ShieldCheck className="input-icon" size={18} />
                    <input
                      ref={totpRef}
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      style={{ letterSpacing: '0.3em', fontSize: '1.3rem', textAlign: 'center' }}
                    />
                  </div>
                </div>

                <button type="submit" className="login-submit-btn" disabled={isSubmitting || totpCode.length < 6}>
                  {isSubmitting ? (
                    <><Loader2 className="animate-spin" size={18} /> Verificando...</>
                  ) : 'Confirmar código'}
                </button>

                <button
                  type="button"
                  style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13 }}
                  onClick={() => { setStep('credentials'); setError(''); setPendingToken(''); setTotpCode(''); }}
                >
                  ← Volver al inicio de sesión
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
