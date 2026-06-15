import { useState } from 'react';
import {
  User, Lock, ShieldCheck, ShieldOff, Eye, EyeOff,
  Loader2, CheckCircle2, AlertCircle, QrCode, Mail, Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/apiClient';
import { setup2FA, activate2FA, disable2FA } from '../../api/api-2fa';
import { useToast } from '../../context/ToastContext';

// ── helpers de estilo ────────────────────────────────────────────────────────
const ROL_LABEL = { superadmin: 'Super Administrador', admin: 'Administrador', usuario: 'Usuario', lectura: 'Solo lectura' };

const fieldWrap = { position: 'relative', marginBottom: 14 };
const iconPos   = { position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' };
const eyePos    = { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex' };
const inputBase = {
  width: '100%', padding: '9px 38px 9px 36px',
  border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14,
  background: '#fff', boxSizing: 'border-box', outline: 'none',
  transition: 'border-color .18s, box-shadow .18s',
};
const labelSt = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 };
const codeInputSt = {
  width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: '2rem', letterSpacing: '0.45em', textAlign: 'center',
  fontWeight: 800, boxSizing: 'border-box', background: '#f8fafc',
};
const alertBox = (color) => ({
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
  background: color === 'red' ? '#fef2f2' : '#f0fdf4',
  border: `1px solid ${color === 'red' ? '#fecaca' : '#bbf7d0'}`,
  color: color === 'red' ? '#dc2626' : '#16a34a',
});

// ── Sección: cambio de contraseña ───────────────────────────────────────────
function CambiarPassword({ addToast }) {
  const [form, setForm]     = useState({ passwordActual: '', passwordNueva: '', confirmar: '' });
  const [show, setShow]     = useState({ actual: false, nueva: false, confirmar: false });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [ok, setOk]         = useState(false);

  const toggle = (f) => setShow((v) => ({ ...v, [f]: !v[f] }));
  const handle = (e) => setForm((v) => ({ ...v, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setOk(false);
    if (form.passwordNueva !== form.confirmar) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      await apiClient.post('/auth/change-password', { passwordActual: form.passwordActual, passwordNueva: form.passwordNueva });
      setOk(true);
      setForm({ passwordActual: '', passwordNueva: '', confirmar: '' });
      addToast({ title: 'Contraseña actualizada', message: 'Tu contraseña fue cambiada correctamente.', type: 'success' });
    } catch (err) { setError(err.message || 'No se pudo cambiar la contraseña'); }
    finally { setLoading(false); }
  };

  const renderField = (name, label, field) => (
    <div>
      <label style={labelSt}>{label}</label>
      <div style={fieldWrap}>
        <Lock size={15} style={iconPos} />
        <input
          name={name} type={show[field] ? 'text' : 'password'}
          style={{ ...inputBase, paddingRight: 36 }}
          value={form[name]} onChange={handle} required
          onFocus={(e) => { e.target.style.borderColor = '#0ea5e9'; e.target.style.boxShadow = '0 0 0 3px rgba(14,165,233,.12)'; }}
          onBlur={(e)  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
        />
        <button type="button" style={eyePos} onClick={() => toggle(field)}>
          {show[field] ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );

  return (
    <section>
      <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Lock size={14} /> Contraseña
      </h2>
      <div className="mx-card" style={{ padding: '22px 24px' }}>
        {error && <div style={alertBox('red')}><AlertCircle size={15} />{error}</div>}
        {ok    && <div style={alertBox('green')}><CheckCircle2 size={15} />Contraseña cambiada correctamente</div>}

        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 18px', padding: '8px 12px', background: '#f8fafc', borderRadius: 6, borderLeft: '3px solid #0ea5e9' }}>
          Mínimo 12 caracteres · mayúscula · minúscula · número · carácter especial
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 0 }}>
          {renderField('passwordActual', 'Contraseña actual', 'actual')}
          {renderField('passwordNueva',  'Nueva contraseña',  'nueva')}
          {renderField('confirmar',      'Confirmar nueva contraseña', 'confirmar')}
          <div style={{ marginTop: 4 }}>
            <button type="submit" className="mx-btn mx-btn-primary sm" disabled={loading}>
              {loading ? <><Loader2 size={14} className="animate-spin" />Guardando…</> : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

// ── Sección: 2FA ─────────────────────────────────────────────────────────────
function DobleFactorCard({ user, addToast }) {
  const [enabled, setEnabled]     = useState(user?.totp?.enabled ?? false);
  const [phase, setPhase]         = useState('idle'); // 'idle' | 'setup' | 'disabling'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret]       = useState('');
  const [code, setCode]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const reset = () => { setPhase('idle'); setCode(''); setError(''); };

  const handleStartSetup = async () => {
    setError(''); setLoading(true);
    try {
      const data = await setup2FA();
      setQrDataUrl(data.qrDataUrl); setSecret(data.secret); setPhase('setup');
    } catch (err) { setError(err.message || 'No se pudo iniciar la configuración'); }
    finally { setLoading(false); }
  };

  const handleActivate = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await activate2FA(secret, code);
      setEnabled(true); reset();
      addToast({ title: '2FA activado', message: 'Ahora necesitarás tu app al iniciar sesión.', type: 'success' });
    } catch (err) { setError(err.message || 'Código inválido'); }
    finally { setLoading(false); }
  };

  const handleDisable = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await disable2FA(code);
      setEnabled(false); reset();
      addToast({ title: '2FA desactivado', message: 'El doble factor fue eliminado de tu cuenta.', type: 'info' });
    } catch (err) { setError(err.message || 'Código inválido'); }
    finally { setLoading(false); }
  };

  return (
    <section>
      <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={14} /> Doble factor de autenticación (2FA)
      </h2>
      <div className="mx-card" style={{ padding: '22px 24px' }}>

        {/* Cabecera de estado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: enabled ? '#dcfce7' : '#f1f5f9' }}>
              <ShieldCheck size={18} color={enabled ? '#16a34a' : '#94a3b8'} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Google Authenticator</p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                {enabled ? 'Tu cuenta está protegida con 2FA' : 'Protección adicional desactivada'}
              </p>
            </div>
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: enabled ? '#dcfce7' : '#f1f5f9',
            color: enabled ? '#16a34a' : '#94a3b8',
          }}>
            {enabled ? '● Activo' : '○ Inactivo'}
          </span>
        </div>

        {error && <div style={alertBox('red')}><AlertCircle size={15} />{error}</div>}

        {/* Idle: inactivo */}
        {!enabled && phase === 'idle' && (
          <>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 18px', lineHeight: 1.6 }}>
              Agrega una capa de seguridad extra. Cada vez que inicies sesión necesitarás un código de 6 dígitos generado por tu celular.
            </p>
            <button className="mx-btn mx-btn-primary sm" onClick={handleStartSetup} disabled={loading}>
              {loading ? <><Loader2 size={14} className="animate-spin" />Generando…</> : <><QrCode size={14} />Activar 2FA</>}
            </button>
          </>
        )}

        {/* Setup: mostrar QR */}
        {phase === 'setup' && (
          <div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR 2FA" style={{ width: 140, height: 140, borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14 }}>Escanea el código QR:</p>
                <ol style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
                  <li>Abre <strong>Google Authenticator</strong> en tu celular</li>
                  <li>Toca <strong>+</strong> → <strong>Escanear código QR</strong></li>
                  <li>Apunta la cámara al código</li>
                  <li>Ingresa abajo el código que aparece</li>
                </ol>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                  ¿Sin cámara? Ingresa el secreto:<br />
                  <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: 11, wordBreak: 'break-all' }}>{secret}</code>
                </p>
              </div>
            </div>

            <form onSubmit={handleActivate}>
              <label style={labelSt}>Código de verificación (6 dígitos)</label>
              <input
                type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                placeholder="000000" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={codeInputSt} required autoFocus
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button type="submit" className="mx-btn mx-btn-primary sm" disabled={loading || code.length < 6}>
                  {loading ? <><Loader2 size={14} className="animate-spin" />Verificando…</> : <><CheckCircle2 size={14} />Confirmar activación</>}
                </button>
                <button type="button" className="mx-btn mx-btn-ghost sm" onClick={reset}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Idle: activo */}
        {enabled && phase === 'idle' && (
          <div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 18px', lineHeight: 1.6 }}>
              Cada inicio de sesión requerirá un código de tu app. Si pierdes acceso a tu dispositivo, contacta al administrador.
            </p>
            <button
              className="mx-btn mx-btn-outline sm"
              style={{ color: '#ef4444', borderColor: '#fca5a5' }}
              onClick={() => { setPhase('disabling'); setCode(''); setError(''); }}
            >
              <ShieldOff size={14} />Desactivar 2FA
            </button>
          </div>
        )}

        {/* Desactivar: pedir código */}
        {enabled && phase === 'disabling' && (
          <form onSubmit={handleDisable}>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>
              Ingresa el código actual de tu app para confirmar:
            </p>
            <input
              type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
              placeholder="000000" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={codeInputSt} required autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="mx-btn mx-btn-danger sm" disabled={loading || code.length < 6}>
                {loading ? <><Loader2 size={14} className="animate-spin" />Desactivando…</> : 'Confirmar desactivación'}
              </button>
              <button type="button" className="mx-btn mx-btn-ghost sm" onClick={reset}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
function resolveEmpresa(user) {
  // 1. Empresa populada directamente en el objeto usuario
  if (typeof user?.empresaId === 'object' && user?.empresaId?.nombre) {
    return user.empresaId.nombre;
  }
  // 2. Fallback: clave en localStorage seteada durante el login/refresh
  const cached = typeof window !== 'undefined'
    ? window.localStorage?.getItem('selected_tenant_nombre')
    : null;
  if (cached) return cached;
  // 3. Para superadmin que no tiene empresa asignada por diseño
  if (user?.rol === 'superadmin') return 'Mitynex Prime (administrador)';
  return null;
}

export default function MiPerfil() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const initials = (user?.nombre || '?')
    .split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  const empresaNombre = resolveEmpresa(user);

  return (
    <div className="mx-page">
      {/* Hero */}
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Cuenta</p>
          <h1>Mi perfil y seguridad</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 4 }}>
          <div style={{
            width: 46, height: 46, borderRadius: '50%',
            background: 'rgba(18,214,255,.18)', border: '2px solid rgba(18,214,255,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 800, color: '#12D6FF', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#fff' }}>{user?.nombre}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(234,244,255,.65)' }}>
              {ROL_LABEL[user?.rol] || user?.rol}
              {empresaNombre ? ` · ${empresaNombre}` : ''}
            </p>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <div className="mx-content-frame" style={{ maxWidth: 760 }}>

        {/* Datos de cuenta (read-only) */}
        <div className="mx-card" style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={15} color="#0ea5e9" />
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo</p>
              <p style={{ margin: '2px 0 0', fontSize: 14 }}>{user?.email}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={15} color="#0ea5e9" />
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa</p>
              <p style={{ margin: '2px 0 0', fontSize: 14 }}>{empresaNombre || '—'}</p>
            </div>
          </div>
        </div>

        <CambiarPassword addToast={addToast} />
        <DobleFactorCard user={user} addToast={addToast} />
      </div>
    </div>
  );
}
