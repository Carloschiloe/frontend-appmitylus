import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ title, message, confirmLabel = 'Confirmar', onConfirm, onClose }) {
  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal" style={{ maxWidth: '420px', width: 'min(100%, 420px)' }}>
        <div className="mx-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-grid', placeItems: 'center',
              width: 36, height: 36, borderRadius: '50%',
              background: '#fee2e2', color: '#b91c1c', flexShrink: 0,
            }}>
              <AlertTriangle size={18} />
            </span>
            <div>
              <h3 className="mx-modal-title" style={{ fontSize: '1rem' }}>{title}</h3>
              {message && (
                <p style={{ margin: '3px 0 0', color: 'var(--color-text-subtle)', fontSize: '0.88rem' }}>
                  {message}
                </p>
              )}
            </div>
          </div>
          <button type="button" className="mx-btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="mx-modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="mx-btn"
            style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
