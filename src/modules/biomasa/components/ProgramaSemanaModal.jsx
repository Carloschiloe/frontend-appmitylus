import { useState, useEffect } from 'react';
import { X, CalendarCheck } from 'lucide-react';
import { esFechaEnVigencia } from '../utils/programaImpacto';
import { fmtTonsInt } from '../utils/programaCalculos';

const DAY_LABELS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

function calcTonsPerTruck(programa) {
  if (Array.isArray(programa?.transportes) && programa.transportes.length) {
    const totalCam = programa.transportes.reduce((s, t) => s + (Number(t.cantidadDia) || 0), 0);
    const totalTons = programa.transportes.reduce((s, t) => s + (Number(t.cantidadDia) || 0) * (Number(t.toneladasPorCamion) || 0), 0);
    if (totalCam > 0 && totalTons > 0) return totalTons / totalCam;
  }
  if (Number(programa?.toneladasPorCamion) > 0) return Number(programa.toneladasPorCamion);
  return 11;
}

export default function ProgramaSemanaModal({
  show,
  onClose,
  programa,
  weekDays,
  diasActuales,
  onAplicar,
}) {
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [camiones, setCamiones] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!show || !programa || !weekDays?.length) return;
    const presel = new Set(weekDays.filter((d) => (diasActuales?.[d] || 0) > 0));
    setSeleccionados(presel);
    setCamiones(programa.camionesDefault || programa.camionesXDia || 1);
    setSubmitting(false);
  }, [show, programa?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show || !programa) return null;

  const toggleDia = (day) => {
    if (!esFechaEnVigencia(programa, day)) return;
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const diasEfectivos = seleccionados.size;
  const tonsPerTruck = calcTonsPerTruck(programa);
  const tonsTotal = camiones * tonsPerTruck * diasEfectivos;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const diasConf = weekDays
      .filter((d) => esFechaEnVigencia(programa, d))
      .map((d) => ({
        fecha: d,
        accion: seleccionados.has(d) ? 'set_total' : 'suspender_dia',
        camiones: seleccionados.has(d) ? Math.max(1, camiones) : 0,
      }));
    setSubmitting(true);
    try {
      await onAplicar(programa, diasConf);
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal" style={{ maxWidth: 460 }}>
        <div className="mx-modal-header">
          <div>
            <h2 style={{ margin: 0 }}>Planificar semana</h2>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {programa.proveedorNombre}
            </div>
          </div>
          <button type="button" className="mx-btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="mx-form">
          <div className="mx-modal-body">

            <div className="semana-modal-section-label">Días de cosecha</div>
            <div className="semana-dia-pills">
              {weekDays.map((d, i) => {
                const enVigencia = esFechaEnVigencia(programa, d);
                const activo = seleccionados.has(d);
                const dayNum = d.split('-')[2];
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!enVigencia}
                    onClick={() => toggleDia(d)}
                    className={`semana-dia-pill${activo ? ' semana-dia-pill--on' : ''}${!enVigencia ? ' semana-dia-pill--off' : ''}`}
                  >
                    <span>{DAY_LABELS[i]}</span>
                    <small>{dayNum}</small>
                  </button>
                );
              })}
            </div>

            <div className="semana-modal-section-label" style={{ marginTop: 16 }}>Camiones por día</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                className="mx-btn mx-btn-outline sm"
                onClick={() => setCamiones((v) => Math.max(1, v - 1))}
              >−</button>
              <input
                type="number"
                className="mx-input"
                style={{ width: 72, textAlign: 'center' }}
                min="1"
                value={camiones}
                onChange={(e) => setCamiones(Math.max(1, Number(e.target.value) || 1))}
              />
              <button
                type="button"
                className="mx-btn mx-btn-outline sm"
                onClick={() => setCamiones((v) => v + 1)}
              >+</button>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                ≈ {fmtTonsInt(camiones * tonsPerTruck)} t/día
              </span>
            </div>

            <div className="semana-modal-resumen">
              <div className="semana-modal-kpi">
                <strong>{diasEfectivos}</strong>
                <span>Días efectivos</span>
              </div>
              <div className="semana-modal-kpi">
                <strong>{camiones * diasEfectivos}</strong>
                <span>Camiones semana</span>
              </div>
              <div className="semana-modal-kpi">
                <strong>{fmtTonsInt(tonsTotal)}</strong>
                <span>Tons estimadas</span>
              </div>
            </div>

          </div>

          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button
              type="submit"
              className="mx-btn mx-btn-primary"
              disabled={submitting || diasEfectivos === 0}
            >
              <CalendarCheck size={15} />
              {submitting ? 'Aplicando...' : 'Aplicar semana'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
