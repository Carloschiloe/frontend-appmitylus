import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Eye, Pencil, X } from 'lucide-react';
import {
  buildDisponibilidadAnnualProjection,
  buildDisponibilidadMonthDetail,
  DISPONIBILIDAD_ESTADOS,
  DISPONIBILIDAD_PRODUCTOS,
  optionLabel,
} from '../disponibilidad.constants';
import { fmtTons } from '../utils/programaCalculos';
import { mesLabel } from '../utils/fechasChile';
import DisponibilidadProviderCell from './DisponibilidadProviderCell';

const stateMeta = (value) => DISPONIBILIDAD_ESTADOS.find((state) => state.value === value) || DISPONIBILIDAD_ESTADOS[0];
const itemTons = (item) => Number(item.tons || item.tonsDisponible || 0);

export default function DisponibilidadProyeccionAnual({
  items,
  stateBaseItems,
  year,
  loading,
  estadoFiltro,
  onEstadoFiltroChange,
  onEdit,
  onCreateTrato,
}) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [productFilter, setProductFilter] = useState('');
  const [showPastMonths, setShowPastMonths] = useState(false);

  const availableProducts = useMemo(
    () => DISPONIBILIDAD_PRODUCTOS.filter((p) => items.some((i) => (i.producto || 'sin_definir') === p.value)),
    [items]
  );

  const filteredItems = useMemo(
    () => (productFilter ? items.filter((i) => (i.producto || 'sin_definir') === productFilter) : items),
    [items, productFilter]
  );

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { rows, annualTotal } = buildDisponibilidadAnnualProjection(filteredItems, year);
  const pastRows = rows.filter((r) => r.monthKey < currentMonthKey);
  const currentFutureRows = rows.filter((r) => r.monthKey >= currentMonthKey);
  const pastTotal = pastRows.reduce((sum, r) => sum + r.total, 0);
  const {
    totalsByState: kpiTotalsByState,
    annualTotal: kpiAnnualTotal,
  } = buildDisponibilidadAnnualProjection(stateBaseItems || items, year);

  const selectedDetail = useMemo(
    () => buildDisponibilidadMonthDetail(filteredItems, selectedMonth),
    [filteredItems, selectedMonth]
  );

  return (
    <section className="disponibilidad-annual">
      <div className="disponibilidad-kpi-grid disponibilidad-kpi-grid--annual">
        <button
          type="button"
          className={`disponibilidad-kpi disponibilidad-kpi-button disponibilidad-kpi--total${!estadoFiltro ? ' is-active' : ''}`}
          aria-pressed={!estadoFiltro}
          onClick={() => onEstadoFiltroChange('')}
        >
          <span>Total anual</span>
          <strong>{fmtTons(kpiAnnualTotal)}</strong>
        </button>
        {DISPONIBILIDAD_ESTADOS.map((state) => (
          <button
            type="button"
            key={state.value}
            className={`disponibilidad-kpi disponibilidad-kpi-button disponibilidad-kpi--${state.tone}${estadoFiltro === state.value ? ' is-active' : ''}`}
            aria-pressed={estadoFiltro === state.value}
            onClick={() => onEstadoFiltroChange(state.value)}
          >
            <span>{state.label}</span>
            <strong>{fmtTons(kpiTotalsByState[state.value])}</strong>
          </button>
        ))}
      </div>

      {availableProducts.length > 0 && (
        <div className="disp-annual-product-chips">
          <span className="disp-annual-chips-label">Producto</span>
          <button
            type="button"
            className={`disp-annual-chip${!productFilter ? ' is-active' : ''}`}
            onClick={() => setProductFilter('')}
          >Todos</button>
          {availableProducts.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`disp-annual-chip${productFilter === p.value ? ' is-active' : ''}`}
              onClick={() => setProductFilter(p.value)}
            >{p.label}</button>
          ))}
        </div>
      )}

      <div className="mx-table-card disponibilidad-table-card">
        <div className="disponibilidad-table-scroll">
          <table className="mx-table disponibilidad-annual-table">
            <thead>
              <tr>
                <th>Mes</th>
                {DISPONIBILIDAD_ESTADOS.map((state) => <th key={state.value}>{state.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pastRows.length > 0 && (
                <tr className="disp-annual-row--past-toggle">
                  <td colSpan={DISPONIBILIDAD_ESTADOS.length + 2}>
                    <button type="button" className="disp-annual-past-btn" onClick={() => setShowPastMonths((v) => !v)}>
                      {showPastMonths
                        ? <><ChevronUp size={15} /> Ocultar {pastRows.length} mes{pastRows.length !== 1 ? 'es' : ''} anterior{pastRows.length !== 1 ? 'es' : ''}</>
                        : <><ChevronDown size={15} /> Mostrar {pastRows.length} mes{pastRows.length !== 1 ? 'es' : ''} anterior{pastRows.length !== 1 ? 'es' : ''}{pastTotal > 0 ? ` · ${fmtTons(pastTotal)}` : ''}</>
                      }
                    </button>
                  </td>
                </tr>
              )}
              {showPastMonths && pastRows.map((row) => (
                <tr key={row.monthKey} className="disp-annual-row--past">
                  <td className="disponibilidad-annual-month">
                    <strong>{mesLabel(row.monthKey)}</strong>
                  </td>
                  {DISPONIBILIDAD_ESTADOS.map((state) => (
                    <td key={state.value} className={row.stateTons[state.value] > 0 ? `disp-annual-cell--${state.tone}` : 'disp-annual-cell--zero'}>
                      {row.stateTons[state.value] > 0 ? fmtTons(row.stateTons[state.value]) : '—'}
                    </td>
                  ))}
                  <td>
                    <button type="button" className="mx-btn mx-btn-outline sm disponibilidad-detail-button" onClick={() => setSelectedMonth(row.monthKey)}>
                      <Eye size={14} /> Ver proveedores
                    </button>
                  </td>
                </tr>
              ))}
              {currentFutureRows.map((row) => (
                <tr key={row.monthKey} className={row.monthKey === currentMonthKey ? 'disp-annual-row--current' : undefined}>
                  <td className="disponibilidad-annual-month">
                    <strong>{mesLabel(row.monthKey)}</strong>
                  </td>
                  {DISPONIBILIDAD_ESTADOS.map((state) => (
                    <td key={state.value} className={row.stateTons[state.value] > 0 ? `disp-annual-cell--${state.tone}` : 'disp-annual-cell--zero'}>
                      {row.stateTons[state.value] > 0 ? fmtTons(row.stateTons[state.value]) : '—'}
                    </td>
                  ))}
                  <td>
                    <button type="button" className="mx-btn mx-btn-outline sm disponibilidad-detail-button" onClick={() => setSelectedMonth(row.monthKey)}>
                      <Eye size={14} /> Ver proveedores
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {loading && <div className="disponibilidad-annual-loading">Cargando proyección anual...</div>}
      {!loading && items.length === 0 && <div className="disponibilidad-annual-empty">No hay disponibilidades para los filtros seleccionados durante {year}.</div>}

      {selectedMonth && (
        <div className="mx-modal-overlay disponibilidad-month-overlay" onClick={() => setSelectedMonth(null)}>
          <div className="mx-modal disponibilidad-month-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mx-modal-header">
              <div>
                <h3 className="mx-modal-title">Detalle {mesLabel(selectedMonth, true)}</h3>
                <p className="disponibilidad-modal-subtitle">Proveedores con biomasa informada para este mes.</p>
              </div>
              <button type="button" className="mx-modal-close" onClick={() => setSelectedMonth(null)} aria-label="Cerrar detalle mensual"><X size={18} /></button>
            </div>

            <div className="mx-modal-body disponibilidad-month-body">
              <div className="disponibilidad-kpi-grid disponibilidad-kpi-grid--month-detail">
                <article className="disponibilidad-kpi disponibilidad-kpi--total">
                  <span>Total mes</span>
                  <strong>{fmtTons(selectedDetail.total)}</strong>
                </article>
                {DISPONIBILIDAD_ESTADOS.map((state) => (
                  <article key={state.value} className={`disponibilidad-kpi disponibilidad-kpi--${state.tone}`}>
                    <span>{state.label}</span>
                    <strong>{fmtTons(selectedDetail.totalsByState[state.value])}</strong>
                  </article>
                ))}
              </div>

              {selectedDetail.items.length > 0 ? (
                <div className="mx-table-card disponibilidad-table-card">
                  <div className="disponibilidad-table-scroll">
                    <table className="mx-table disponibilidad-month-table">
                      <thead>
                        <tr>
                          <th>Proveedor</th><th>Centro</th><th>Toneladas</th><th>Producto</th>
                          <th>Calibres</th><th>Observación</th><th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetail.items.map((item) => {
                          const meta = stateMeta(item.estado || 'disponible');
                          return (
                            <tr key={item._id}>
                              <td className="disponibilidad-provider"><DisponibilidadProviderCell item={item} /></td>
                              <td>{item.centroOrigenCodigo || item.centroCodigo || 'Sin centro'}</td>
                              <td className="disponibilidad-tons">
                                <div>{fmtTons(itemTons(item))}</div>
                                <span className={`disponibilidad-state disponibilidad-state--${meta.tone}`}>{meta.label}</span>
                              </td>
                              <td>{optionLabel(DISPONIBILIDAD_PRODUCTOS, item.producto || 'sin_definir')}</td>
                              <td className="disp-calibre-cell">
                                {item.calibreMin || item.calibreMax
                                  ? `${item.calibreMin ?? '?'}–${item.calibreMax ?? '?'} uk`
                                  : '—'}
                              </td>
                              <td className="disponibilidad-observation" title={item.observacion || item.motivo || ''}>{item.observacion || item.motivo || 'Sin observación'}</td>
                              <td>
                                <div className="disponibilidad-row-actions">
                                  <button type="button" className="mx-btn-icon sm" onClick={() => onEdit(item)} aria-label="Editar disponibilidad"><Pencil size={15} /></button>
                                  {(item.estado || 'disponible') === 'disponible' && !item.tratoId && (
                                    <button type="button" className="mx-btn-icon sm" onClick={() => onCreateTrato(item)} title="Crear trato asociado" aria-label="Crear trato asociado"><ArrowRight size={15} /></button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="disponibilidad-month-empty">No hay disponibilidad registrada para este mes.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
