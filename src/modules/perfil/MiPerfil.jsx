import { useState, useEffect } from 'react';
import { User, Lock, ShieldCheck, ShieldOff, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, QrCode } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/apiClient';
import { setup2FA, activate2FA, disable2FA } from '../../api/api-2fa';
import { useToast } from '../../context/ToastContext';

// ── Sección: datos de la cuenta ─────────────────────────────────────────────
function DatosCuenta({ user }) {
  return (
    <div className="mx-card" style={{ padding: '24px 28px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-accent-cyan, #12D6FF)22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={22} color="var(--color-accent-cyan, #0ea5e9)" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{user?.nombre}</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted, #64748b)', textTransform: 'capitalize' }}>
            {user?.rol}{user?.empresaId?.nombre ? ` · ${user.empresaId.nombre}` : ''}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo</p>
          <p style={{ margin: 0, fontSize: 14 }}>{user?.email}</p>
        </div>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa</p>
          <p style={{ margin: 0, fontSize: 14 }}>{user?.empresaId?.nombre || '—'}</p>
        </div>
      </div>
    </div>
  );
}

// ── Sección: cambio de contraseña ───────────────────────────────────────────
function CambiarPassword({ addToast }) {
  const [form, setForm] = useState({ passwordActual: '', passwordNueva: '', confirmar: '' });
  const [show, setShow] = useState({ actual: false, nueva: false, confirmar: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = (field) => setShow((v) => ({ ...v, [field]: !v[field] }));

  const handleChange = (e) => setForm((v) => ({ ...v, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.passwordNueva !== form.confirmar) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      await apiClient.post('/auth/change-password', {
        passwordActual: form.passwordActual,
        passwordNueva: form.passwordNueva,
      });
      addToast({ title: 'Contraseña actualizada', message: 'Tu contraseña fue cambiada correctamente.', type: 'success' });
      setForm({ passwordActual: '', passwordNueva: '', confirmar: '' });
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = { width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--color-border, #e2e8f0)', fontSize: 14, boxSizing: 'border-box' };
  const wrapStyle = { position: 'relative', marginBottom: 14 };
  const iconStyle = { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' };
  const eyeStyle = { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 5 };

  return (
    <div className="mx-card" style={{ padding: '24px 28px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Lock size={18} color="#64748b" />
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Cambiar contraseña</h3>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 14, color: '#dc2626', fontSize: 13 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>
        Mínimo 12 caracteres · mayúscula · minúscula · número · carácter especial
      </p>

      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Contraseña actual</label>
        <div style={wrapStyle}>
          <Lock size={15} style={iconStyle} />
          <input name="passwordActual" type={show.actual ? 'text' : 'password'} style={{ ...fieldStyle, paddingRight: 36 }} value={form.passwordActual} onChange={handleChange} required />
          <button type="button" style={eyeStyle} onClick={() => toggle('actual')}>{show.actual ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>

        <label style={labelStyle}>Contraseña nueva</label>
        <div style={wrapStyle}>
          <Lock size={15} style={iconStyle} />
          <input name="passwordNueva" type={show.nueva ? 'text' : 'password'} style={{ ...fieldStyle, paddingRight: 36 }} value={form.passwordNueva} onChange={handleChange} required />
          <button type="button" style={eyeStyle} onClick={() => toggle('nueva')}>{show.nueva ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>

        <label style={labelStyle}>Confirmar contraseña nueva</label>
        <div style={wrapStyle}>
          <Lock size={15} style={iconStyle} />
          <input name="confirmar" type={show.confirmar ? 'text' : 'password'} style={{ ...fieldStyle, paddingRight: 36 }} value={form.confirmar} onChange={handleChange} required />
          <button type="button" style={eyeStyle} onClick={() => toggle('confirmar')}>{show.confirmar ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>

        <button type="submit" className="mx-btn mx-btn-primary sm" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  );
}

// ── Sección: 2FA ─────────────────────────────────────────────────────────────
function DobleFactorCard({ user, addToast }) {
  const [status, setStatus]       = useState(user?.totp?.enabled ?? false);
  const [phase, setPhase]         = useState('idle'); // 'idle' | 'setup' | 'disabling'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret]       = useState('');
  const [code, setCode]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const handleStartSetup = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await setup2FA();
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setPhase('setup');
    } catch (err) {
      setError(err.message || 'No se pudo iniciar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await activate2FA(secret, code);
      setStatus(true);
      setPhase('idle');
      setCode('');
      addToast({ title: '2FA activado', message: 'Ahora necesitarás tu app al iniciar sesión.', type: 'success' });
    } catch (err) {
      setError(err.message || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await disable2FA(code);
      setStatus(false);
      setPhase('idle');
      setCode('');
      addToast({ title: '2FA desactivado', message: 'El doble factor fue eliminado de tu cuenta.', type: 'info' });
    } catch (err) {
      setError(err.message || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  const codeInputStyle = {
    width: '100%', padding: '10px 16px', borderRadius: 8,
    border: '1px solid var(--color-border, #e2e8f0)', fontSize: '1.5rem',
    letterSpacing: '0.4em', textAlign: 'center', fontWeight: 700, boxSizing: 'border-box',
  };

  return (
    <div className="mx-card" style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={18} color={status ? '#22c55e' : '#94a3b8'} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Autenticación de dos factores (2FA)</h3>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: status ? '#dcfce7' : '#f1f5f9',
          color: status ? '#16a34a' : '#64748b',
        }}>
          {status ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>
        {status
          ? 'Tu cuenta está protegida con un código de 6 dígitos que rota cada 30 segundos.'
          : 'Agrega una capa extra de seguridad. Necesitarás Google Authenticator (u otra app TOTP) en tu celular.'}
      </p>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Estado: inactivo, sin configurar */}
      {!status && phase === 'idle' && (
        <button className="mx-btn mx-btn-primary sm" onClick={handleStartSetup} disabled={loading}>
          {loading ? <><Loader2 size={14} className="animate-spin" /> Generando...</> : <><QrCode size={14} /> Activar 2FA</>}
        </button>
      )}

      {/* Estado: mostrando QR para escanear */}
      {phase === 'setup' && (
        <div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR para Google Authenticator" style={{ width: 160, height: 160, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Pasos para activar:</p>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
                <li>Abre <strong>Google Authenticator</strong> en tu celular</li>
                <li>Toca el botón <strong>+</strong> → "Escanear código QR"</li>
                <li>Apunta la cámara al código de la izquierda</li>
                <li>Ingresa el código de 6 dígitos que aparece</li>
              </ol>
              <p style={{ margin: '12px 0 0', fontSize: 11, color: '#94a3b8' }}>
                ¿Sin cámara? Ingresa manualmente el secreto: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{secret}</code>
              </p>
            </div>
          </div>

          <form onSubmit={handleActivate}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
              Código de verificación (de la app)
            </label>
            <input
              type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={codeInputStyle}
              required
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="submit" className="mx-btn mx-btn-primary sm" disabled={loading || code.length < 6}>
                {loading ? <><Loader2 size={14} className="animate-spin" /> Verificando...</> : <><CheckCircle2 size={14} /> Confirmar activación</>}
              </button>
              <button type="button" className="mx-btn mx-btn-ghost sm" onClick={() => { setPhase('idle'); setCode(''); setError(''); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Estado: activo, mostrando opción de desactivar */}
      {status && phase === 'idle' && (
        <button className="mx-btn mx-btn-outline sm" style={{ color: '#ef4444', borderColor: '#fca5a5' }}
          onClick={() => { setPhase('disabling'); setCode(''); setError(''); }}>
          <ShieldOff size={14} /> Desactivar 2FA
        </button>
      )}

      {status && phase === 'disabling' && (
        <form onSubmit={handleDisable}>
          <p style={{ fontSize: 13, marginBottom: 10 }}>Ingresa el código actual de tu app para confirmar:</p>
          <input
            type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={codeInputStyle}
            required
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="submit" className="mx-btn mx-btn-danger sm" disabled={loading || code.length < 6}>
              {loading ? <><Loader2 size={14} className="animate-spin" /> Desactivando...</> : 'Confirmar desactivación'}
            </button>
            <button type="button" className="mx-btn mx-btn-ghost sm" onClick={() => { setPhase('idle'); setCode(''); setError(''); }}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function MiPerfil() {
  const { user } = useAuth();
  const { addToast } = useToast();

  return (
    <div className="mx-page" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 4px' }}>Mi perfil</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted, #64748b)', margin: 0 }}>
          Gestiona tu cuenta, contraseña y seguridad
        </p>
      </div>

      <DatosCuenta user={user} />
      <CambiarPassword addToast={addToast} />
      <DobleFactorCard user={user} addToast={addToast} />
    </div>
  );
}
