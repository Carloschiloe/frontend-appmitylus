import { ArrowRight, Pencil } from 'lucide-react';
import {
  DISPONIBILIDAD_ESTADOS,
  DISPONIBILIDAD_ORIGENES,
  DISPONIBILIDAD_PRODUCTOS,
  optionLabel,
} from '../disponibilidad.constants';
import { fmtTons } from '../utils/programaCalculos';
import { mesLabel } from '../utils/fechasChile';
import DisponibilidadProviderCell from './DisponibilidadProviderCell';

const stateMeta = (value) => DISPONIBILIDAD_ESTADOS.find((state) => state.value === value) || DISPONIBILIDAD_ESTADOS[0];

export default function DisponibilidadResumen({ items, mes, onEdit }) {
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

      <div className="disponibilidad-summary-detail">
        <div className="disponibilidad-summary-detail-header">
          <h4>Detalle del mes</h4>
          <p>Proveedores y contactos con biomasa informada para este mes.</p>
        </div>
        {items.length > 0 ? (
          <div className="mx-table-card disponibilidad-table-card">
            <div className="disponibilidad-table-scroll">
              <table className="mx-table disponibilidad-summary-table">
                <thead>
                  <tr>
                    <th>Proveedor / Contacto</th><th>Centro</th><th>Toneladas</th><th>Producto</th>
                    <th>Estado</th><th>Responsable</th><th>Origen</th><th>Observación</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const meta = stateMeta(item.estado || 'disponible');
                    return (
                      <tr key={item._id}>
                        <td className="disponibilidad-provider"><DisponibilidadProviderCell item={item} /></td>
                        <td>{item.centroCodigo || 'Sin centro'}</td>
                        <td className="disponibilidad-tons">{fmtTons(item.tons || item.tonsDisponible || 0)}</td>
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
    </section>
  );
}
