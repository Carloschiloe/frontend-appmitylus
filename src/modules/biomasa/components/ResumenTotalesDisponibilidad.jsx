import { DISPONIBILIDAD_ESTADOS } from '../disponibilidad.constants';
import { fmtTons } from '../utils/programaCalculos';

export default function ResumenTotalesDisponibilidad({ label, total, totalsByState }) {
  return (
    <div className="disponibilidad-totals-summary" aria-label={`${label}: ${fmtTons(total)}`}>
      <div className="disponibilidad-totals-main">
        <span>{label}</span>
        <strong>{fmtTons(total)}</strong>
      </div>
      <div className="disponibilidad-totals-states">
        {DISPONIBILIDAD_ESTADOS.map((state) => (
          <span key={state.value} className={`disponibilidad-totals-chip disponibilidad-totals-chip--${state.tone}`}>
            {state.label}: <strong>{fmtTons(totalsByState[state.value] || 0)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
