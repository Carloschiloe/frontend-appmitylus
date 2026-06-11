import { useMemo, useState } from 'react';
import {
  buildDisponibilidadAnnualProjection,
  buildDisponibilidadTotals,
  DISPONIBILIDAD_ESTADOS,
  DISPONIBILIDAD_PRODUCTOS,
} from '../disponibilidad.constants';
import { fmtTons } from '../utils/programaCalculos';
import { mesLabel } from '../utils/fechasChile';

const itemTons = (item) => Number(item.tons || item.tonsDisponible || 0);
const identityLabel = (item) => (
  item.proveedorNombreNorm
  || item.proveedorNombre
  || item.empresaNombre
  || (item.contactoNombre ? `Contacto: ${item.contactoNombre}` : 'Sin proveedor')
);

function monthProviders(items, monthKey) {
  const providers = new Map();
  items.filter((item) => item.mesKey === monthKey).forEach((item) => {
    const label = identityLabel(item);
    providers.set(label, (providers.get(label) || 0) + itemTons(item));
  });
  return Array.from(providers, ([label, tons]) => ({ label, tons }))
    .sort((a, b) => b.tons - a.tons);
}

export default function DisponibilidadAnalisisGrafico({
  items,
  baseItems,
  comparisonItems,
  year,
  comparisonYear,
  onComparisonYearChange,
  productFilter,
  onProductFilterChange,
  loading,
  comparisonLoading,
}) {
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const primary = useMemo(() => buildDisponibilidadAnnualProjection(items, year), [items, year]);
  const comparison = useMemo(
    () => buildDisponibilidadAnnualProjection(comparisonItems, comparisonYear || year),
    [comparisonItems, comparisonYear, year]
  );
  const productCards = useMemo(() => {
    const all = { value: '', label: 'Todos', ...buildDisponibilidadTotals(baseItems) };
    return [
      all,
      ...DISPONIBILIDAD_PRODUCTOS.map((product) => ({
        ...product,
        ...buildDisponibilidadTotals(baseItems.filter((item) => (item.producto || 'sin_definir') === product.value)),
      })),
    ];
  }, [baseItems]);
  const compareOptions = useMemo(() => {
    const current = Number(year);
    return [current - 2, current - 1, current + 1].filter((value) => value > 0);
  }, [year]);
  const maxMonthTotal = Math.max(
    ...primary.rows.map((row) => row.total),
    ...(comparisonYear ? comparison.rows.map((row) => row.total) : [0]),
    1
  );
  const difference = comparisonYear ? primary.annualTotal - comparison.annualTotal : 0;
  const activeTooltip = hoveredMonth == null ? null : {
    row: primary.rows[hoveredMonth],
    providers: monthProviders(items, primary.rows[hoveredMonth].monthKey),
  };

  return (
    <section className="disponibilidad-analysis">
      <div className="disponibilidad-analysis-header">
        <div>
          <span className="mx-eyebrow">Análisis gráfico</span>
          <h3>Disponibilidad mensual {year}</h3>
          <p>Compara el volumen informado por mes y estado comercial.</p>
        </div>
        <label className="disponibilidad-analysis-compare">
          <span>Comparar con</span>
          <select className="mx-select" value={comparisonYear} onChange={(event) => onComparisonYearChange(event.target.value)}>
            <option value="">Ninguno</option>
            {compareOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <div className="disponibilidad-kpi-grid disponibilidad-kpi-grid--annual">
        <article className="disponibilidad-kpi disponibilidad-kpi--total">
          <span>Total {year}</span>
          <strong>{fmtTons(primary.annualTotal)}</strong>
          {comparisonYear && (
            <small className={difference >= 0 ? 'is-positive' : 'is-negative'}>
              {difference >= 0 ? '+' : ''}{fmtTons(difference)} vs {comparisonYear}
            </small>
          )}
        </article>
        {DISPONIBILIDAD_ESTADOS.map((state) => (
          <article key={state.value} className={`disponibilidad-kpi disponibilidad-kpi--${state.tone}`}>
            <span>{state.label}</span>
            <strong>{fmtTons(primary.totalsByState[state.value])}</strong>
          </article>
        ))}
      </div>

      <div className="disponibilidad-product-cards" aria-label="Filtro rápido por producto">
        {productCards.map((product) => (
          <button
            key={product.value || 'todos'}
            type="button"
            className={`disponibilidad-product-card${productFilter === product.value ? ' is-active' : ''}`}
            onClick={() => onProductFilterChange(product.value)}
          >
            <span>{product.label}</span>
            <strong>{fmtTons(product.total)}</strong>
          </button>
        ))}
      </div>

      <div className="disponibilidad-analysis-card">
        <div className="disponibilidad-analysis-legend">
          {DISPONIBILIDAD_ESTADOS.map((state) => (
            <span key={state.value}><i className={`disponibilidad-analysis-swatch disponibilidad-analysis-swatch--${state.tone}`} />{state.label}</span>
          ))}
          {comparisonYear && <span><i className="disponibilidad-analysis-swatch disponibilidad-analysis-swatch--comparison" />Total {comparisonYear}</span>}
        </div>

        {activeTooltip && (
          <div className="disponibilidad-analysis-tooltip" role="status">
            <strong>{mesLabel(activeTooltip.row.monthKey, true)} · {fmtTons(activeTooltip.row.total)}</strong>
            <div>
              {DISPONIBILIDAD_ESTADOS.map((state) => (
                <span key={state.value}>{state.label}: {fmtTons(activeTooltip.row.stateTons[state.value])}</span>
              ))}
            </div>
            <p>Proveedores/contactos</p>
            {activeTooltip.providers.length > 0
              ? activeTooltip.providers.slice(0, 5).map((provider) => <span key={provider.label}>{provider.label}: {fmtTons(provider.tons)}</span>)
              : <span>Sin registros para este mes.</span>}
            {activeTooltip.providers.length > 5 && <span>+ {activeTooltip.providers.length - 5} más</span>}
          </div>
        )}

        <div className="disponibilidad-analysis-chart-scroll">
          <div className="disponibilidad-analysis-chart" aria-label={`Disponibilidad por mes para ${year}`}>
            {primary.rows.map((row, index) => {
              const comparedRow = comparison.rows[index];
              return (
                <button
                  key={row.monthKey}
                  type="button"
                  className="disponibilidad-analysis-month"
                  onMouseEnter={() => setHoveredMonth(index)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  onFocus={() => setHoveredMonth(index)}
                  onBlur={() => setHoveredMonth(null)}
                  aria-label={`${mesLabel(row.monthKey)}: ${fmtTons(row.total)}`}
                >
                  <span className="disponibilidad-analysis-bars">
                    <span className="disponibilidad-analysis-stack" style={{ height: `${(row.total / maxMonthTotal) * 100}%` }}>
                      {DISPONIBILIDAD_ESTADOS.map((state) => {
                        const tons = row.stateTons[state.value];
                        return tons > 0 ? <span key={state.value} className={`disponibilidad-analysis-segment disponibilidad-analysis-segment--${state.tone}`} style={{ flexGrow: tons }} /> : null;
                      })}
                    </span>
                    {comparisonYear && <span className="disponibilidad-analysis-comparison-bar" style={{ height: `${(comparedRow.total / maxMonthTotal) * 100}%` }} />}
                  </span>
                  <strong>{row.total > 0 ? fmtTons(row.total) : '0 t'}</strong>
                  <span>{mesLabel(row.monthKey).slice(0, 3)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {(loading || comparisonLoading) && <div className="disponibilidad-annual-loading">Actualizando análisis...</div>}
        {!loading && items.length === 0 && <div className="disponibilidad-annual-empty">No hay disponibilidades para los filtros seleccionados durante {year}.</div>}
      </div>

      {comparisonYear && (
        <div className="mx-table-card disponibilidad-table-card">
          <div className="disponibilidad-table-scroll">
            <table className="mx-table disponibilidad-comparison-table">
              <thead><tr><th>Mes</th><th>{year}</th><th>{comparisonYear}</th><th>Diferencia</th></tr></thead>
              <tbody>
                {primary.rows.map((row, index) => {
                  const comparedTotal = comparison.rows[index].total;
                  const monthDifference = row.total - comparedTotal;
                  return (
                    <tr key={row.monthKey}>
                      <td>{mesLabel(row.monthKey, true)}</td>
                      <td>{fmtTons(row.total)}</td>
                      <td>{fmtTons(comparedTotal)}</td>
                      <td className={monthDifference >= 0 ? 'is-positive' : 'is-negative'}>{monthDifference >= 0 ? '+' : ''}{fmtTons(monthDifference)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
