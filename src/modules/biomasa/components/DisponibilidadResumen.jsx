import { DISPONIBILIDAD_ESTADOS } from '../disponibilidad.constants';
import { fmtTons } from '../utils/programaCalculos';
import { mesLabel } from '../utils/fechasChile';

export default function DisponibilidadResumen({ items, mes }) {
  const totals = DISPONIBILIDAD_ESTADOS.map((state) => ({
    ...state,
    tons: items
      .filter((item) => (item.estado || 'disponible') === state.value)
      .reduce((sum, item) => sum + Number(item.tons || item.tonsDisponible || 0), 0),
  }));
  const maxTons = Math.max(...totals.map((item) => item.tons), 1);
  const total = totals.reduce((sum, item) => sum + item.tons, 0);

  return (
    <section className="disponibilidad-summary-card">
      <div className="disponibilidad-summary-header">
        <div>
          <span className="mx-eyebrow">Resumen mensual</span>
          <h3>{mesLabel(mes, true)}</h3>
        </div>
        <strong>{fmtTons(total)} totales</strong>
      </div>
      <div className="disponibilidad-bars" aria-label={`Toneladas por estado para ${mesLabel(mes)}`}>
        {totals.map((item) => (
          <div key={item.value} className="disponibilidad-bar-row">
            <div className="disponibilidad-bar-label">
              <span className={`disponibilidad-state disponibilidad-state--${item.tone}`}>{item.label}</span>
              <strong>{fmtTons(item.tons)}</strong>
            </div>
            <div className="disponibilidad-bar-track">
              <div className={`disponibilidad-bar-fill disponibilidad-bar-fill--${item.tone}`} style={{ width: `${(item.tons / maxTons) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
