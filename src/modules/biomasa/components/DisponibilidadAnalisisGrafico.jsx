import { useMemo, useState } from 'react';
import { ChevronDown, RotateCcw, Search, X } from 'lucide-react';
import {
  buildDisponibilidadAnnualProjection,
  buildDisponibilidadMonthDetail,
  DISPONIBILIDAD_ESTADOS,
  DISPONIBILIDAD_ORIGENES,
  DISPONIBILIDAD_PRODUCTOS,
  filterDisponibilidadContacts,
  filterDisponibilidadProviders,
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
}) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showComparisonTable, setShowComparisonTable] = useState(false);
  const [showProviderResults, setShowProviderResults] = useState(false);

  const primary = useMemo(() => buildDisponibilidadAnnualProjection(items, year), [items, year]);
  const comparison = useMemo(
    () => buildDisponibilidadAnnualProjection(comparisonItems, comparisonYear || year),
    [comparisonItems, comparisonYear, year]
  );

  const productOptions = [{ value: '', label: 'Todos' }, ...DISPONIBILIDAD_PRODUCTOS];
  const stateOptions = [{ value: '', label: 'Todos', tone: 'total' }, ...DISPONIBILIDAD_ESTADOS];
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
  const providerMatches = useMemo(
    () => filterDisponibilidadProviders(providers, providerFilter, 5),
    [providerFilter, providers]
  );
  const contactMatches = useMemo(
    () => filterDisponibilidadContacts(contacts, providerFilter, 5),
    [contacts, providerFilter]
  );
  const hasProviderQuery = Boolean(providerFilter.trim());

  return (
    <section className="disponibilidad-analysis">
      <div className="disponibilidad-analysis-toolbar">
        <label className="disponibilidad-analysis-control">
          <span>Año principal</span>
          <input className="mx-input" type="number" min="2000" max="2100" value={year} onChange={(event) => onYearChange(event.target.value)} />
        </label>
        <label className="disponibilidad-analysis-control">
          <span>Comparar con</span>
          <select className="mx-select" value={comparisonYear} onChange={(event) => onComparisonYearChange(event.target.value)}>
            <option value="">Ninguno</option>
            {compareOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className="disponibilidad-analysis-control disponibilidad-analysis-control--search">
          <span>Proveedor / contacto</span>
          <div className="disponibilidad-search-input disponibilidad-analysis-search">
            <Search size={16} />
            <input
              value={providerFilter}
              onChange={(event) => { onProviderFilterChange(event.target.value); setShowProviderResults(true); }}
              onFocus={() => setShowProviderResults(true)}
              onBlur={() => setTimeout(() => setShowProviderResults(false), 150)}
              placeholder="Buscar proveedor o contacto"
            />
            {providerFilter && (
              <button type="button" className="disponibilidad-search-clear" onClick={() => { onProviderFilterChange(''); setShowProviderResults(false); }} aria-label="Limpiar proveedor o contacto">
                <X size={14} />
              </button>
            )}
          </div>
          {showProviderResults && hasProviderQuery && (
            <div className="disponibilidad-analysis-search-results">
              {providerMatches.length === 0 && contactMatches.length === 0 ? (
                <div className="disponibilidad-inline-empty">No encontramos proveedores o contactos.</div>
              ) : (
                <>
                  {providerMatches.length > 0 && <span className="disponibilidad-analysis-search-group">Proveedores</span>}
                  {providerMatches.map((provider) => (
                    <button key={`provider-${provider.id}`} type="button" className="disponibilidad-provider-option" onClick={() => { onProviderFilterChange(provider.proveedorNombre); setShowProviderResults(false); }}>
                      <strong>{provider.proveedorNombre}</strong>
                      <span>{provider.comuna || 'Sin comuna'} · {provider.centros.length} centro{provider.centros.length === 1 ? '' : 's'}</span>
                    </button>
                  ))}
                  {contactMatches.length > 0 && <span className="disponibilidad-analysis-search-group">Contactos</span>}
                  {contactMatches.map((contact) => (
                    <button key={`contact-${contact.id}`} type="button" className="disponibilidad-provider-option" onClick={() => { onProviderFilterChange(contact.contactoNombre); setShowProviderResults(false); }}>
                      <strong>{contact.contactoNombre}</strong>
                      <span>{contact.contactoTelefono || contact.contactoEmail || 'Sin teléfono ni email'}{contact.proveedorNombre ? ` · ${contact.proveedorNombre}` : ' · Sin proveedor'}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <button type="button" className="mx-btn mx-btn-outline disponibilidad-analysis-refresh" onClick={onRefresh}>
          <RotateCcw size={15} /> Actualizar
        </button>
      </div>

      <div className="disponibilidad-analysis-summary">
        <div className="disponibilidad-analysis-summary-total">
          <span>Total {year}</span>
          <strong>{fmtTons(primary.annualTotal)}</strong>
          {comparisonYear && (
            <small className={difference >= 0 ? 'is-positive' : 'is-negative'}>
              {difference >= 0 ? '+' : ''}{fmtTons(difference)} vs {comparisonYear}
            </small>
          )}
        </div>
        <div className="disponibilidad-analysis-summary-states">
          {DISPONIBILIDAD_ESTADOS.map((state) => (
            <div key={state.value} className={`disponibilidad-analysis-summary-state disponibilidad-analysis-summary-state--${state.tone}`}>
              <span>{state.label}</span>
              <strong>{fmtTons(primary.totalsByState[state.value])}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="disponibilidad-analysis-chips-row">
        <div className="disp-annual-product-chips">
          <span className="disp-annual-chips-label">Producto</span>
          {productOptions.map((p) => (
            <button key={p.value || 'todos'} type="button" className={`disp-annual-chip${productFilter === p.value ? ' is-active' : ''}`} onClick={() => onProductFilterChange(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="disp-annual-product-chips">
          <span className="disp-annual-chips-label">Estado</span>
          {stateOptions.map((s) => (
            <button key={s.value || 'todos'} type="button" className={`disp-annual-chip${stateFilter === s.value ? ' is-active' : ''}`} onClick={() => onStateFilterChange(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        {providerFilter && (
          <div className="disponibilidad-active-filters">
            <span>Proveedor:</span>
            <strong>"{providerFilter}"</strong>
            <button type="button" onClick={() => onProviderFilterChange('')}>Limpiar</button>
          </div>
        )}
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
                      <DisponibilidadProviderCell item={item} />
                      <strong>{fmtTons(itemTons(item))}</strong>
                    </div>
                    <div className="disponibilidad-analysis-detail-tags">
                      <span>{optionLabel(DISPONIBILIDAD_PRODUCTOS, item.producto || 'sin_definir')}</span>
                      <span className={`disponibilidad-state disponibilidad-state--${meta.tone}`}>{meta.label}</span>
                    </div>
                    <div className="disponibilidad-analysis-detail-meta">
                      <span>Origen: {optionLabel(DISPONIBILIDAD_ORIGENES, item.origen || 'otro')}</span>
                      <span className="disp-res-prod-sep">·</span>
                      <span>Responsable: {item.responsable || 'Sin asignar'}</span>
                      <span className="disp-res-prod-sep">·</span>
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
