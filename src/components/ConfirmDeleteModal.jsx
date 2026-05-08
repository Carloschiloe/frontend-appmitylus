import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Eliminar registro?',
  description,
  itemName,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
}) {
  if (!isOpen) return null;

  const resolvedDescription =
    description ||
    `Estás a punto de borrar ${itemName ? `"${itemName}"` : 'este registro'}. Esta acción es irreversible.`;

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal" style={{ maxWidth: '450px', borderRadius: 16, overflow: 'hidden' }}>
        <div className="mx-modal-body" style={{ textAlign: 'center', padding: '42px 36px 34px' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '999px',
              margin: '0 auto 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
            }}
          >
            <AlertTriangle size={36} />
          </div>
          <h3 style={{ fontWeight: 900, fontSize: '22px', marginBottom: '18px', color: '#111827' }}>
            {title}
          </h3>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.55, maxWidth: 360, margin: '0 auto' }}>
            {resolvedDescription}
          </p>
        </div>
        <div className="mx-modal-foot" style={{ gap: '18px', padding: '22px 36px', background: '#f8fafc' }}>
          <button className="mx-btn mx-btn-outline" style={{ flex: 1, height: 48 }} onClick={onClose} type="button">
            {cancelLabel}
          </button>
          <button
            className="mx-btn"
            style={{ flex: 1, height: 48, background: '#ef4444', color: 'white', fontWeight: 800 }}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

