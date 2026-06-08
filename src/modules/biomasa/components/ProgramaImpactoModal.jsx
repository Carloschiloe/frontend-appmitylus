import { CheckCircle2, ArrowRight, CalendarClock } from 'lucide-react';
import { fmtDateKey, fraseCambioTermino } from '../utils/programaImpacto';

// Modal de consecuencia post-ajuste: "Programa actualizado".
// Explica qué pasó y el impacto en la fecha de término.
export default function ProgramaImpactoModal({ impacto, onClose }) {
  if (!impacto) return null;
  const cambio = impacto.direccionCambio;
  const colorCambio = cambio === 'extendio' ? '#b45309' : cambio === 'adelanto' ? '#166534' : 'var(--color-text-muted)';

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal" style={{ maxWidth: 440 }}>
        <div className="mx-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} />
            <h2 style={{ margin: 0 }}>Programa actualizado</h2>
          </div>
        </div>

        <div className="mx-modal-body">
          <p style={{ fontSize: 14, margin: '0 0 16px' }}>{impacto.mensaje}</p>

          <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
              <CalendarClock size={13} /> Fecha de término
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 16, fontWeight: 700 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>{fmtDateKey(impacto.vigenciaHastaAnterior) || '—'}</span>
              <ArrowRight size={16} style={{ color: 'var(--color-text-muted)' }} />
              <span style={{ color: '#0F172A' }}>{fmtDateKey(impacto.vigenciaHastaNueva) || '—'}</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 13, fontWeight: 600, color: colorCambio }}>
              {fraseCambioTermino(impacto)}
            </div>
          </div>

          {(impacto.totalDiaAntes != null && impacto.totalDiaDespues != null) && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 12 }}>
              Camiones del día: {impacto.totalDiaAntes} → {impacto.totalDiaDespues}
            </div>
          )}
        </div>

        <div className="mx-modal-footer">
          <button type="button" className="mx-btn mx-btn-primary" onClick={onClose} style={{ width: '100%' }}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
