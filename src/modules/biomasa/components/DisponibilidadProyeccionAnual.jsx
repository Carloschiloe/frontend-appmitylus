import { useMemo, useState } from 'react';
import { ArrowRight, Eye, Pencil, X } from 'lucide-react';
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

const stateMeta = (value) => DISPONIBILIDAD_ESTADOS.find((state) => state.value === value) || DISPONIBILIDAD_ESTADOS[0];
const itemTons = (item) => Number(item.tons || item.tonsDisponible || 0);

export default function DisponibilidadProyeccionAnual({ items, year, loading, onEdit }) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const { rows, totalsByState, annualTotal } = buildDisponibilidadAnnualProjection(items, year);
  const maxMonthTotal = Math.max(...rows.map((row) => row.total), 1);
  const selectedDetail = useMemo(
    () => buildDisponibilidadMonthDetail(items, selectedMonth),
    [items, selectedMonth]
  );

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
                <th>Detalle</th>
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
                          <th>Estado</th><th>Responsable</th><th>Origen</th><th>Observación</th><th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetail.items.map((item) => {
                          const meta = stateMeta(item.estado || 'disponible');
                          return (
                            <tr key={item._id}>
                              <td className="disponibilidad-provider">{item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || 'Sin proveedor'}</td>
                              <td>{item.centroCodigo || 'Sin centro'}</td>
                              <td className="disponibilidad-tons">{fmtTons(itemTons(item))}</td>
                              <td>{optionLabel(DISPONIBILIDAD_PRODUCTOS, item.producto || 'sin_definir')}</td>
                              <td><span className={`disponibilidad-state disponibilidad-state--${meta.tone}`}>{meta.label}</span></td>
                              <td>{item.responsable || 'Sin asignar'}</td>
                              <td>{optionLabel(DISPONIBILIDAD_ORIGENES, item.origen || 'otro')}</td>
                              <td className="disponibilidad-observation" title={item.observacion || item.motivo || ''}>{item.observacion || item.motivo || 'Sin observación'}</td>
                              <td>
                                <div className="disponibilidad-row-actions">
                                  <button type="button" className="mx-btn-icon sm" onClick={() => onEdit(item)} aria-label="Editar disponibilidad"><Pencil size={15} /></button>
                                  <button type="button" className="mx-btn-icon sm" disabled title="Crear trato asociado: disponible en próxima fase" aria-label="Crear trato asociado, disponible en próxima fase"><ArrowRight size={15} /></button>
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
