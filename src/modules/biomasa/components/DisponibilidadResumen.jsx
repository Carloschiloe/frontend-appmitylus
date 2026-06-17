import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
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

const shiftMes = (mesKey, delta) => {
  const [y, m] = mesKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function DisponibilidadResumen({ items, mes, setMes, estadoFiltro, onEdit, onCreateTrato }) {
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
  const defaultOpenState = estadoFiltro || null;
  const [openStates, setOpenStates] = useState(() => new Set(defaultOpenState ? [defaultOpenState] : []));

  useEffect(() => {
    setOpenStates(new Set(defaultOpenState ? [defaultOpenState] : []));
  }, [defaultOpenState, mes]);

  const toggleState = (stateValue) => {
    setOpenStates((current) => {
      const next = new Set(current);
      if (next.has(stateValue)) next.delete(stateValue);
      else next.add(stateValue);
      return next;
    });
  };

  return (
    <section className="disponibilidad-summary-card">
      <div className="disponibilidad-summary-header">
        <div>
          <span className="mx-eyebrow">Resumen mensual</span>
          <div className="disp-res-mes-nav">
            {setMes && (
              <button type="button" className="disp-res-mes-btn" onClick={() => setMes(shiftMes(mes, -1))} aria-label="Mes anterior">
                <ChevronLeft size={16} />
              </button>
            )}
            <h3>{mesLabel(mes, true)}</h3>
            {setMes && (
              <button type="button" className="disp-res-mes-btn" onClick={() => setMes(shiftMes(mes, 1))} aria-label="Mes siguiente">
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
        <strong>{fmtTons(total)} totales</strong>
      </div>

      {total > 0 && (
        <div className="disp-res-stacked-bar" aria-hidden="true">
          {groups.filter((g) => g.tons > 0).map((g) => (
            <div
              key={g.value}
              className={`disp-res-stacked-segment disp-res-stacked-segment--${g.tone}`}
              style={{ flex: g.tons }}
              title={`${g.label}: ${fmtTons(g.tons)} · ${Math.round((g.tons / total) * 100)}%`}
            />
          ))}
        </div>
      )}

      <div className="disp-res-table" aria-label={`Toneladas por estado para ${mesLabel(mes)}`}>
        {groups.map((group) => {
          const isOpen = openStates.has(group.value);
          const contentId = `disponibilidad-resumen-${group.value}`;
          return (
            <div key={group.value} className={`disp-res-group${isOpen ? ' is-open' : ''}${group.tons === 0 ? ' is-empty' : ''}`}>
              <button
                type="button"
                className={`disp-res-row disp-res-row--${group.tone}`}
                onClick={() => toggleState(group.value)}
                aria-expanded={isOpen}
                aria-controls={contentId}
              >
                <span className="disp-res-col-estado">
                  <span className={`disponibilidad-state disponibilidad-state--${group.tone}`}>{group.label}</span>
                </span>
                <span className="disp-res-col-tons">
                  <strong>{fmtTons(group.tons)}</strong>
                </span>
                <span className="disp-res-col-pct">
                  {total > 0 ? Math.round((group.tons / total) * 100) : 0}%
                </span>
                <span className="disp-res-col-productos">
                  {DISPONIBILIDAD_PRODUCTOS
                    .map((p) => ({ label: p.label, tons: group.items.filter((i) => (i.producto || 'sin_definir') === p.value).reduce((s, i) => s + itemTons(i), 0) }))
                    .filter((p) => p.tons > 0)
                    .map((p, idx) => (
                      <span key={p.label}>
                        {idx > 0 && <span className="disp-res-prod-sep">·</span>}
                        {p.label} <strong>{fmtTons(p.tons)}</strong>
                      </span>
                    ))
                  }
                </span>
                <span className="disp-res-col-bar">
                  <span className="disp-res-bar-track">
                    <span
                      className={`disp-res-bar-fill disp-res-bar-fill--${group.tone}`}
                      style={{ width: `${(group.tons / maxTons) * 100}%` }}
                    />
                  </span>
                </span>
                <span className="disp-res-col-chevron">
                  <ChevronDown size={14} aria-hidden="true" />
                </span>
              </button>
              {isOpen && (
                <div id={contentId} className="disponibilidad-state-records">
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
                        {(item.estado || 'disponible') === 'disponible' && !item.tratoId && (
                          <button type="button" className="mx-btn-icon sm" onClick={() => onCreateTrato(item)} title="Crear trato asociado" aria-label="Crear trato asociado"><ArrowRight size={15} /></button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="disponibilidad-state-empty">No hay disponibilidad en este estado.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
