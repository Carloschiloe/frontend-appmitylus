import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  buildDisponibilidadAnnualProjection,
  buildDisponibilidadMonthDetail,
  buildDisponibilidadTotals,
  DISPONIBILIDAD_ESTADOS,
  DISPONIBILIDAD_ORIGENES,
  DISPONIBILIDAD_PRODUCTOS,
  optionLabel,
} from '../disponibilidad.constants';
import { fmtTons } from '../utils/programaCalculos';
import { mesLabel } from '../utils/fechasChile';
import DisponibilidadProviderCell from './DisponibilidadProviderCell';

const itemTons = (item) => Number(item.tons || item.tonsDisponible || 0);
const stateMeta = (value) => DISPONIBILIDAD_ESTADOS.find((state) => state.value === value) || DISPONIBILIDAD_ESTADOS[0];

export default function DisponibilidadAnalisisGrafico({
  items,
  baseItems,
  stateBaseItems,
  comparisonItems,
  year,
  comparisonYear,
  onComparisonYearChange,
  productFilter,
  onProductFilterChange,
  stateFilter,
  onStateFilterChange,
  loading,
  comparisonLoading,
}) {
  const [selectedMonth, setSelectedMonth] = useState(null);
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
  const stateCards = useMemo(() => {
    const all = { value: '', label: 'Todos', tone: 'total', ...buildDisponibilidadTotals(stateBaseItems) };
    return [
      all,
      ...DISPONIBILIDAD_ESTADOS.map((state) => ({
        ...state,
        ...buildDisponibilidadTotals(stateBaseItems.filter((item) => (item.estado || 'disponible') === state.value)),
      })),
    ];
  }, [stateBaseItems]);
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
  const selectedDetail = useMemo(
    () => buildDisponibilidadMonthDetail(items, selectedMonth),
    [items, selectedMonth]
  );

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

      <div className="disponibilidad-state-filter-cards" aria-label="Filtro rápido por estado">
        {stateCards.map((state) => (
          <button
            key={state.value || 'todos'}
            type="button"
            className={`disponibilidad-state-filter-card disponibilidad-state-filter-card--${state.tone}${stateFilter === state.value ? ' is-active' : ''}`}
            onClick={() => onStateFilterChange(state.value)}
          >
            <span>{state.label}</span>
            <strong>{fmtTons(state.total)}</strong>
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

        <div className="disponibilidad-analysis-chart-scroll">
          <div className="disponibilidad-analysis-chart" aria-label={`Disponibilidad por mes para ${year}`}>
            {primary.rows.map((row, index) => {
              const comparedRow = comparison.rows[index];
              return (
                <button
                  key={row.monthKey}
                  type="button"
                  className={`disponibilidad-analysis-month${selectedMonth === row.monthKey ? ' is-selected' : ''}`}
                  onClick={() => setSelectedMonth(row.monthKey)}
                  aria-label={`${mesLabel(row.monthKey)}: ${fmtTons(row.total)}`}
                >
                  <span className="disponibilidad-analysis-tooltip" role="tooltip">
                    <strong>{mesLabel(row.monthKey, true)}</strong>
                    <span>{fmtTons(row.total)}</span>
                    <small>Click para ver proveedores</small>
                  </span>
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
        {!loading && items.length === 0 && <div className="disponibilidad-annual-empty">No hay datos para graficar con los filtros seleccionados.</div>}
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

      {selectedMonth && (
        <div className="disponibilidad-analysis-drawer-overlay" onClick={() => setSelectedMonth(null)}>
          <aside className="disponibilidad-analysis-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="disponibilidad-analysis-drawer-header">
              <div>
                <h3>Detalle {mesLabel(selectedMonth, true)}</h3>
                <p>Proveedores y contactos involucrados en este mes.</p>
              </div>
              <button type="button" className="mx-modal-close" onClick={() => setSelectedMonth(null)} aria-label="Cerrar detalle"><X size={18} /></button>
            </div>

            <div className="disponibilidad-analysis-drawer-total">
              <span>Total mes</span>
              <strong>{fmtTons(selectedDetail.total)}</strong>
            </div>
            <div className="disponibilidad-analysis-drawer-states">
              {DISPONIBILIDAD_ESTADOS.map((state) => (
                <span key={state.value} className={`disponibilidad-totals-chip disponibilidad-totals-chip--${state.tone}`}>
                  {state.label}: <strong>{fmtTons(selectedDetail.totalsByState[state.value])}</strong>
                </span>
              ))}
            </div>

            <div className="disponibilidad-analysis-drawer-list">
              {selectedDetail.items.length > 0 ? selectedDetail.items.map((item) => {
                const meta = stateMeta(item.estado || 'disponible');
                return (
                  <article key={item._id} className="disponibilidad-analysis-detail-record">
                    <div className="disponibilidad-analysis-detail-title">
                      <DisponibilidadProviderCell item={item} />
                      <strong>{fmtTons(itemTons(item))}</strong>
                    </div>
                    <div className="disponibilidad-analysis-detail-tags">
                      <span>{optionLabel(DISPONIBILIDAD_PRODUCTOS, item.producto || 'sin_definir')}</span>
                      <span className={`disponibilidad-state disponibilidad-state--${meta.tone}`}>{meta.label}</span>
                    </div>
                    <div className="disponibilidad-analysis-detail-meta">
                      <span>Origen: {optionLabel(DISPONIBILIDAD_ORIGENES, item.origen || 'otro')}</span>
                      <span>Responsable: {item.responsable || 'Sin asignar'}</span>
                      <span title={item.observacion || item.motivo || ''}>{item.observacion || item.motivo || 'Sin observación'}</span>
                    </div>
                  </article>
                );
              }) : (
                <div className="disponibilidad-month-empty">No hay disponibilidad registrada para este mes con los filtros actuales.</div>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
