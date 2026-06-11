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

const itemTons = (item) => Number(item.tons || item.tonsDisponible || 0);

export default function DisponibilidadResumen({ items, mes, estadoFiltro, onEdit }) {
  const states = estadoFiltro
    ? DISPONIBILIDAD_ESTADOS.filter((state) => state.value === estadoFiltro)
    : DISPONIBILIDAD_ESTADOS;
  const groups = states.map((state) => {
    const stateItems = items.filter((item) => (item.estado || 'disponible') === state.value);
    return {
      ...state,
      items: stateItems,
      tons: stateItems.reduce((sum, item) => sum + itemTons(item), 0),
    };
  });
  const maxTons = Math.max(...groups.map((group) => group.tons), 1);
  const total = groups.reduce((sum, group) => sum + group.tons, 0);

  return (
    <section className="disponibilidad-summary-card">
      <div className="disponibilidad-summary-header">
        <div>
          <span className="mx-eyebrow">Resumen mensual</span>
          <h3>{mesLabel(mes, true)}</h3>
        </div>
        <strong>{fmtTons(total)} totales</strong>
      </div>

      <div className="disponibilidad-state-groups" aria-label={`Toneladas por estado para ${mesLabel(mes)}`}>
        {groups.map((group) => (
          <article key={group.value} className={`disponibilidad-state-group disponibilidad-state-group--${group.tone}`}>
            <div className="disponibilidad-state-group-header">
              <span className={`disponibilidad-state disponibilidad-state--${group.tone}`}>{group.label}</span>
              <strong>{fmtTons(group.tons)}</strong>
            </div>
            <div className="disponibilidad-bar-track">
              <div className={`disponibilidad-bar-fill disponibilidad-bar-fill--${group.tone}`} style={{ width: `${(group.tons / maxTons) * 100}%` }} />
            </div>

            <div className="disponibilidad-state-records">
              {group.items.length > 0 ? group.items.map((item) => (
                <div key={item._id} className="disponibilidad-state-record">
                  <DisponibilidadProviderCell item={item} />
                  <div className="disponibilidad-state-record-volume">
                    <strong>{fmtTons(itemTons(item))}</strong>
                    <span>{optionLabel(DISPONIBILIDAD_PRODUCTOS, item.producto || 'sin_definir')}</span>
                  </div>
                  <div className="disponibilidad-state-record-meta">
                    <span>Origen: {optionLabel(DISPONIBILIDAD_ORIGENES, item.origen || 'otro')}</span>
                    <span>Responsable: {item.responsable || 'Sin asignar'}</span>
                    <span title={item.observacion || item.motivo || ''}>{item.observacion || item.motivo || 'Sin observación'}</span>
                  </div>
                  <div className="disponibilidad-row-actions">
                    <button type="button" className="mx-btn-icon sm" onClick={() => onEdit(item)} aria-label="Editar disponibilidad"><Pencil size={15} /></button>
                    <button type="button" className="mx-btn-icon sm" disabled title="Crear trato asociado: disponible en próxima fase" aria-label="Crear trato asociado, disponible en próxima fase"><ArrowRight size={15} /></button>
                  </div>
                </div>
              )) : (
                <div className="disponibilidad-state-empty">No hay disponibilidad en este estado.</div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
