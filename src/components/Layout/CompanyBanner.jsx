import React from 'react';
import { Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function CompanyBanner() {
  const { user } = useAuth();
  if (!user) return null;

  let nombre = null;
  let logo = null;

  if (user.rol === 'superadmin') {
    nombre = localStorage.getItem('selected_tenant_nombre') || null;
    logo   = localStorage.getItem('selected_tenant_logo')   || null;
    if (!nombre) return null; // superadmin sin tenant seleccionado: no mostrar
  } else {
    nombre = user.empresaId?.nombre || null;
    logo   = user.empresaId?.config?.logo || null;
  }

  if (!nombre) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 32px',
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      minHeight: '44px',
    }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '6px',
        background: 'var(--color-primary-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {logo
          ? <img src={logo} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <Building2 size={16} color="var(--color-primary)" />
        }
      </div>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.01em' }}>
        {nombre}
      </span>
    </div>
  );
}
