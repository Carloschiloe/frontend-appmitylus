import { buildDisponibilidadAnnualProjection, DISPONIBILIDAD_ESTADOS } from '../disponibilidad.constants';
import { fmtTons } from '../utils/programaCalculos';
import { mesLabel } from '../utils/fechasChile';

export default function DisponibilidadProyeccionAnual({ items, year, loading }) {
  const { rows, totalsByState, annualTotal } = buildDisponibilidadAnnualProjection(items, year);
  const maxMonthTotal = Math.max(...rows.map((row) => row.total), 1);

  return (
    <section className="disponibilidad-annual">
      <div className="disponibilidad-summary-header">
        <div>
          <span className="mx-eyebrow">Proyección anual</span>
          <h3>{year}</h3>
          <p>Visualiza la biomasa informada por proveedores durante el año, separada por mes y estado comercial.</p>
        </div>
      </div>

      <div className="disponibilidad-kpi-grid disponibilidad-kpi-grid--annual">
        <article className="disponibilidad-kpi disponibilidad-kpi--total">
          <span>Total anual</span>
          <strong>{fmtTons(annualTotal)}</strong>
        </article>
        {DISPONIBILIDAD_ESTADOS.map((state) => (
          <article key={state.value} className={`disponibilidad-kpi disponibilidad-kpi--${state.tone}`}>
            <span>{state.label}</span>
            <strong>{fmtTons(totalsByState[state.value])}</strong>
          </article>
        ))}
      </div>

      <div className="mx-table-card disponibilidad-table-card">
        <div className="disponibilidad-table-scroll">
          <table className="mx-table disponibilidad-annual-table">
            <thead>
              <tr>
                <th>Mes</th>
                {DISPONIBILIDAD_ESTADOS.map((state) => <th key={state.value}>{state.label}</th>)}
                <th>Total mes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.monthKey}>
                  <td className="disponibilidad-annual-month">
                    <strong>{mesLabel(row.monthKey)}</strong>
                    <span className="disponibilidad-annual-track">
                      <span style={{ width: `${(row.total / maxMonthTotal) * 100}%` }} />
                    </span>
                  </td>
                  {DISPONIBILIDAD_ESTADOS.map((state) => (
                    <td key={state.value}>{fmtTons(row.stateTons[state.value])}</td>
                  ))}
                  <td className="disponibilidad-tons">{fmtTons(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {loading && <div className="disponibilidad-annual-loading">Cargando proyección anual...</div>}
      {!loading && items.length === 0 && <div className="disponibilidad-annual-empty">No hay disponibilidades para los filtros seleccionados durante {year}.</div>}
    </section>
  );
}
