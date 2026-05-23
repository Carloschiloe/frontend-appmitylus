import { useState } from 'react';
import { CalendarClock, X } from 'lucide-react';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ReprogramModal({ item, onConfirm, onClose }) {
  const initial = item?.date
    ? `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}-${String(item.date.getDate()).padStart(2, '0')}`
    : todayStr();

  const [fecha, setFecha] = useState(initial);

  function handleSubmit(e) {
    e.preventDefault();
    if (!fecha) return;
    onConfirm(fecha);
  }

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal" style={{ maxWidth: '420px', width: 'min(100%, 420px)' }}>
        <div className="mx-modal-header">
          <div>
            <h3 className="mx-modal-title" style={{ fontSize: '1rem' }}>Reprogramar actividad</h3>
            <p style={{ margin: '3px 0 0', color: 'var(--color-text-subtle)', fontSize: '0.88rem' }}>
              {item?.provider} · {item?.title}
            </p>
          </div>
          <button type="button" className="mx-btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mx-modal-body" style={{ padding: '20px 24px' }}>
            <label className="mx-label" style={{ display: 'block', marginBottom: 8 }}>
              Nueva fecha
            </label>
            <label className="cal-filter-select" style={{ width: '100%', height: 44, borderRadius: 12 }}>
              <CalendarClock size={16} style={{ flexShrink: 0 }} />
              <input
                type="date"
                className="mx-input"
                style={{ border: 0, padding: 0, height: 'auto' }}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="mx-btn mx-btn-primary">
              Reprogramar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
