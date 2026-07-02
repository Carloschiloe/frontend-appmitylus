import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Pencil, UserRound, X } from 'lucide-react';
import {
  buildDisponibilidadAnnualProjection,
  buildDisponibilidadMonthDetail,
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
  comparisonItems,
  year,
  onYearChange,
  comparisonYear,
  onComparisonYearChange,
  providers,
  contacts,
  providerFilter,
  onProviderFilterChange,
  productFilter,
  onProductFilterChange,
  stateFilter,
  onStateFilterChange,
  onRefresh,
  loading,
  comparisonLoading,
  onEdit,
}) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showComparisonTable, setShowComparisonTable] = useState(false);
  const [showPastMonths, setShowPastMonths] = useState(false);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const primary = useMemo(() => buildDisponibilidadAnnualProjection(items, year), [items, year]);
  const comparison = useMemo(
    () => buildDisponibilidadAnnualProjection(comparisonItems, comparisonYear || year),
    [comparisonItems, comparisonYear, year]
  );

  const availableProducts = useMemo(
    () => DISPONIBILIDAD_PRODUCTOS.filter((p) => items.some((i) => (i.producto || 'sin_definir') === p.value)),
    [items]
  );

  const availableProviders = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const name = item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || '';
      if (!name) return;
      const entry = map.get(name) || { name, total: 0 };
      entry.total += Number(item.tons || item.tonsDisponible || 0);
      map.set(name, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [items]);

  const pastRows = primary.rows.filter((r) => r.monthKey < currentMonthKey);
  const visibleRows = showPastMonths ? primary.rows : primary.rows.filter((r) => r.monthKey >= currentMonthKey);

  const maxMonthTotal = Math.max(
    ...visibleRows.map((row) => row.total),
    ...(comparisonYear ? visibleRows.map((row) => {
      const idx = primary.rows.findIndex((r) => r.monthKey === row.monthKey);
      return comparison.rows[idx]?.total || 0;
    }) : [0]),
    1
  );
  const difference = comparisonYear ? primary.annualTotal - comparison.annualTotal : 0;

  const selectedDetail = useMemo(
    () => buildDisponibilidadMonthDetail(items, selectedMonth),
    [items, selectedMonth]
  );

  return (
    <section className="disponibilidad-analysis">

      <div className="disponibilidad-kpi-grid disponibilidad-kpi-grid--annual">
        <button
          type="button"
          className={`disponibilidad-kpi disponibilidad-kpi-button disponibilidad-kpi--total${!stateFilter ? ' is-active' : ''}`}
          aria-pressed={!stateFilter}
          onClick={() => onStateFilterChange('')}
        >
          <span>Total {year}</span>
          <strong>{fmtTons(primary.annualTotal)}</strong>
          {comparisonYear && (
            <small className={difference >= 0 ? 'is-positive' : 'is-negative'}>
              {difference >= 0 ? '+' : ''}{fmtTons(difference)} vs {comparisonYear}
            </small>
          )}
        </button>
        {DISPONIBILIDAD_ESTADOS.map((state) => (
          <button
            key={state.value}
            type="button"
            className={`disponibilidad-kpi disponibilidad-kpi-button disponibilidad-kpi--${state.tone}${stateFilter === state.value ? ' is-active' : ''}`}
            aria-pressed={stateFilter === state.value}
            onClick={() => onStateFilterChange(stateFilter === state.value ? '' : state.value)}
          >
            <span>{state.label}</span>
            <strong>{fmtTons(primary.totalsByState[state.value])}</strong>
          </button>
        ))}
      </div>


      <div className="disponibilidad-analysis-card">
        {(!stateFilter || comparisonYear) && (
          <div className="disponibilidad-analysis-legend">
            {!stateFilter && DISPONIBILIDAD_ESTADOS.map((state) => (
              <span key={state.value}><i className={`disponibilidad-analysis-swatch disponibilidad-analysis-swatch--${state.tone}`} />{state.label}</span>
            ))}
            {comparisonYear && <span><i className="disponibilidad-analysis-swatch disponibilidad-analysis-swatch--comparison" />Total {comparisonYear}</span>}
          </div>
        )}
        <div className="disp-analysis-chart-row">
          <div className="disponibilidad-analysis-chart-scroll">
          <div className="disponibilidad-analysis-chart" style={{ gridTemplateColumns: `repeat(${visibleRows.length}, minmax(0, 1fr))` }} aria-label={`Disponibilidad por mes para ${year}`}>
            {visibleRows.map((row) => {
              const idx = primary.rows.findIndex((r) => r.monthKey === row.monthKey);
              const comparedRow = comparison.rows[idx];
              const isPast = row.monthKey < currentMonthKey;
              return (
                <button
                  key={row.monthKey}
                  type="button"
                  className={`disponibilidad-analysis-month${selectedMonth === row.monthKey ? ' is-selected' : ''}${isPast ? ' is-past' : ''}`}
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
          {(availableProducts.length > 0 || availableProviders.length > 1) && (
            <div className="disp-analysis-product-pills-side">
              {availableProducts.length > 0 && (
                <>
                  <span className="disp-annual-chips-label">Producto</span>
                  <button type="button" className={`disp-annual-chip${!productFilter ? ' is-active' : ''}`} onClick={() => onProductFilterChange('')}>Todos</button>
                  {availableProducts.map((p) => (
                    <button key={p.value} type="button" className={`disp-annual-chip${productFilter === p.value ? ' is-active' : ''}`} onClick={() => onProductFilterChange(p.value)}>{p.label}</button>
                  ))}
                </>
              )}
              {availableProviders.length > 1 && (
                <>
                  <span className="disp-annual-chips-label disp-annual-chips-label--section">Proveedor</span>
                  <button type="button" className={`disp-annual-chip${!providerFilter ? ' is-active' : ''}`} onClick={() => onProviderFilterChange('')}>Todos</button>
                  {availableProviders.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      className={`disp-annual-chip${providerFilter === p.name ? ' is-active' : ''}`}
                      title={`${p.name} · ${fmtTons(p.total)}`}
                      onClick={() => onProviderFilterChange(providerFilter === p.name ? '' : p.name)}
                    >
                      {p.name.length > 22 ? `${p.name.slice(0, 20)}…` : p.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {pastRows.length > 0 && (
          <div className="disp-analysis-past-toggle-row">
            <button
              type="button"
              className="disp-annual-past-btn"
              onClick={() => {
                if (showPastMonths) {
                  setShowPastMonths(false);
                  if (selectedMonth && selectedMonth < currentMonthKey) setSelectedMonth(null);
                } else {
                  setShowPastMonths(true);
                }
              }}
            >
              {showPastMonths
                ? <><ChevronUp size={15} /> Ocultar {pastRows.length} mes{pastRows.length !== 1 ? 'es' : ''} anterior{pastRows.length !== 1 ? 'es' : ''}</>
                : <><ChevronDown size={15} /> Mostrar {pastRows.length} mes{pastRows.length !== 1 ? 'es' : ''} anterior{pastRows.length !== 1 ? 'es' : ''}</>
              }
            </button>
          </div>
        )}
        {(loading || comparisonLoading) && <div className="disponibilidad-annual-loading">Actualizando análisis...</div>}
        {!loading && items.length === 0 && <div className="disponibilidad-annual-empty">No hay datos para graficar con los filtros seleccionados.</div>}
      </div>

      {comparisonYear && (
        <div className="disponibilidad-comparison-section">
          <button type="button" className="disponibilidad-comparison-toggle" onClick={() => setShowComparisonTable((current) => !current)} aria-expanded={showComparisonTable}>
            <span>Ver comparación mensual</span><ChevronDown size={16} />
          </button>
          {showComparisonTable && (
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
              {DISPONIBILIDAD_ESTADOS.filter((state) => selectedDetail.totalsByState[state.value] > 0).map((state) => (
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
                      <DisponibilidadProviderCell item={item} hideContact />
                      <div className="disponibilidad-analysis-detail-actions">
                        <strong>{fmtTons(itemTons(item))}</strong>
                        {onEdit && (
                          <button
                            type="button"
                            className="mx-btn-icon sm"
                            onClick={() => onEdit(item)}
                            aria-label="Editar disponibilidad"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="disponibilidad-analysis-detail-tags">
                      <span>{optionLabel(DISPONIBILIDAD_PRODUCTOS, item.producto || 'sin_definir')}</span>
                      <span className={`disponibilidad-state disponibilidad-state--${meta.tone}`}>{meta.label}</span>
                      {(item.calibreMin != null || item.calibreMax != null) && (
                        <span className="disp-analysis-tag-info">{item.calibreMin ?? '?'}–{item.calibreMax ?? '?'} uk</span>
                      )}
                      {(item.centroComuna || item.comuna) && (
                        <span className="disp-analysis-tag-info"><MapPin size={10} /> {item.centroComuna || item.comuna}</span>
                      )}
                      {item.contactoNombre && (
                        <span
                          className="disp-analysis-contact-pill"
                          title={[item.contactoNombre, item.contactoTelefono || item.contactoSnapshot?.telefono, item.contactoEmail || item.contactoSnapshot?.email].filter(Boolean).join(' · ')}
                        >
                          <UserRound size={10} /> {item.contactoNombre}
                        </span>
                      )}
                    </div>
                    {(item.observacion || item.motivo) && (
                      <div className="disponibilidad-analysis-detail-obs" title={item.observacion || item.motivo}>
                        {item.observacion || item.motivo}
                      </div>
                    )}
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
