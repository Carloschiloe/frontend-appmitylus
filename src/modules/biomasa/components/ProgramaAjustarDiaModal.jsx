import { useEffect, useState } from 'react';
import { X, Plus, CheckCircle2 } from 'lucide-react';
import { fmtTonsInt } from '../utils/programaCalculos';
import { getTipoProductoLabel } from '../utils/productoLabels';
import { tiposDescontables } from '../utils/programaImpacto';

// Modal único de ajuste diario: Sumar camión / Descontar camión / Suspender día.
// Reutiliza el endpoint ajuste-diario via onAplicar(payload). La validación final
// (tipos descontables, no negativos, recálculo de vigencia) la hace el backend.

const ADJUST_MOTIVOS = ['Planta', 'Clima', 'Transporte', 'Proveedor', 'Sanitario', 'Calidad', 'Comercial', 'Otro'];
const SUSPEND_MOTIVOS = ['Clima', 'Planta', 'Logística', 'Proveedor', 'Otro'];

const fmtFechaLarga = (fecha) => {
  if (!fecha) return '';
  const d = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .replace(/^./, (c) => c.toUpperCase());
};

export default function ProgramaAjustarDiaModal({
  show,
  onClose,
  programa,
  fecha,
  composicionDia = [],
  accionInicial = 'sumar',
  tiposTransporte = [],
  onAplicar,
}) {
  const [accion, setAccion] = useState(accionInicial);
  const [tipoTransporteId, setTipoTransporteId] = useState('');
  const [tipoTransporteNombre, setTipoTransporteNombre] = useState('');
  const [toneladasPorCamion, setToneladasPorCamion] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState('Planta');
  const [nota, setNota] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset al abrir / cambiar de día o acción inicial.
  useEffect(() => {
    if (!show) return;
    setAccion(accionInicial);
    setTipoTransporteId('');
    setTipoTransporteNombre('');
    setToneladasPorCamion('');
    setCantidad(1);
    setMotivo(accionInicial === 'suspender' ? 'Clima' : 'Planta');
    setNota('');
    setSubmitting(false);
  }, [show, accionInicial, fecha, programa?._id]);

  if (!show || !programa) return null;

  const removibles = tiposDescontables(composicionDia);
  const totalDia = (composicionDia || []).reduce((s, l) => s + Number(l.cantidad || 0), 0);
  const totalTonsDia = (composicionDia || []).reduce((s, l) => s + Number(l.cantidad || 0) * Number(l.toneladasPorCamion || 0), 0);
  const productoLabel = getTipoProductoLabel(programa.tipoProducto || programa.tipoProductoSugerido || 'sin_definir');

  const selLine = removibles.find((l) => String(l.tipoTransporteId) === String(tipoTransporteId));
  const puedeDescontar = accion !== 'restar' || !!selLine;

  const cambiarAccion = (next) => {
    setAccion(next);
    setTipoTransporteId('');
    setTipoTransporteNombre('');
    setToneladasPorCamion('');
    setCantidad(1);
    setMotivo(next === 'suspender' ? 'Clima' : 'Planta');
  };

  const elegirTipoSumar = (id) => {
    const t = (tiposTransporte || []).find((x) => String(x._id) === id);
    const tpc = t ? ((Number(t.maxisPorUnidad) || 0) * (Number(t.kgPorMaxiRef) || 0)) / 1000 : '';
    setTipoTransporteId(id);
    setTipoTransporteNombre(t?.nombre || '');
    setToneladasPorCamion(tpc || '');
  };

  const elegirTipoRestar = (id) => {
    const l = removibles.find((x) => String(x.tipoTransporteId) === id);
    setTipoTransporteId(id);
    setTipoTransporteNombre(l?.tipoTransporteNombre || '');
    setToneladasPorCamion(l?.toneladasPorCamion ?? '');
  };

  const confirmDisabled = submitting
    || (accion === 'sumar' && (!tipoTransporteId || Number(cantidad) < 1))
    || (accion === 'restar' && (!tipoTransporteId || !puedeDescontar))
    || (accion === 'suspender' && !motivo);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (confirmDisabled) return;
    let payload;
    if (accion === 'sumar') {
      payload = {
        fecha, accion: 'sumar', camiones: Math.max(1, Number(cantidad) || 1), motivo, nota,
        tipoTransporteId, tipoTransporteNombre, toneladasPorCamion: toneladasPorCamion === '' ? null : Number(toneladasPorCamion),
      };
    } else if (accion === 'restar') {
      payload = {
        fecha, accion: 'suspender', camiones: 1, motivo, nota,
        tipoTransporteId, tipoTransporteNombre, toneladasPorCamion: toneladasPorCamion === '' ? null : Number(toneladasPorCamion),
      };
    } else {
      payload = { fecha, accion: 'suspender_dia', camiones: 0, motivo, nota };
    }
    setSubmitting(true);
    try {
      await onAplicar(payload);
    } catch {
      setSubmitting(false); // el padre ya notificó el error; mantener el modal abierto
    }
  };

  const accionBtn = (key, label) => (
    <button
      type="button"
      className={`mx-btn ${accion === key ? (key === 'suspender' ? 'mx-btn-danger' : 'mx-btn-primary') : 'mx-btn-ghost'}`}
      style={{ flex: 1 }}
      onClick={() => cambiarAccion(key)}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal" style={{ maxWidth: 500 }}>
        <div className="mx-modal-header">
          <div>
            <h2 style={{ margin: 0 }}>Ajustar día</h2>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {programa.proveedorNombre} · {fmtFechaLarga(fecha)} · {productoLabel}
            </div>
          </div>
          <button type="button" className="mx-btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="mx-form">
          <div className="mx-modal-body">
            {/* Estado actual del día */}
            <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Estado actual del día
              </div>
              {removibles.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {totalDia === 0 ? 'Día sin camiones programados (suspendido o sin cosecha).' : 'Sin desglose por tipo.'}
                </div>
              ) : (
                <>
                  {removibles.map((l) => (
                    <div key={String(l.tipoTransporteId)} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{Number(l.cantidad)} {l.tipoTransporteNombre || 'Sin tipo'}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>{fmtTonsInt(Number(l.cantidad || 0) * Number(l.toneladasPorCamion || 0))}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 4 }}>
                    <span>Total</span><span>{totalDia} cam · {fmtTonsInt(totalTonsDia)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Selector de acción */}
            <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 600 }}>¿Qué necesitas hacer?</div>
            <div style={{ display: 'flex', gap: 8, background: 'var(--color-surface-2)', padding: 4, borderRadius: 8, marginBottom: 14 }}>
              {accionBtn('sumar', 'Sumar camión')}
              {accionBtn('restar', 'Descontar camión')}
              {accionBtn('suspender', 'Suspender día')}
            </div>

            {/* A) SUMAR */}
            {accion === 'sumar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label className="mx-label" style={{ fontWeight: 700 }}>Tipo de camión <span style={{ color: 'var(--color-error)' }}>*</span></label>
                    <select className="mx-select" required value={tipoTransporteId} onChange={(e) => elegirTipoSumar(e.target.value)}>
                      <option value="">— Selecciona —</option>
                      {(Array.isArray(tiposTransporte) ? tiposTransporte : []).map((t) => {
                        const tpc = t.maxisPorUnidad && t.kgPorMaxiRef ? ((t.maxisPorUnidad * t.kgPorMaxiRef) / 1000).toFixed(1) : null;
                        return <option key={String(t._id)} value={String(t._id)}>{t.nombre}{tpc ? ` — ${tpc} t` : ''}</option>;
                      })}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label className="mx-label" style={{ fontWeight: 700 }}>Cantidad</label>
                    <input className="mx-input" type="number" min="1" value={cantidad}
                      onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                  Esto aumentará la capacidad del día y podría adelantar la fecha de término.
                </p>
              </div>
            )}

            {/* B) DESCONTAR */}
            {accion === 'restar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="mx-label" style={{ fontWeight: 700 }}>Tipo de camión a descontar <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select className="mx-select" required value={tipoTransporteId}
                  disabled={removibles.length === 0}
                  onChange={(e) => elegirTipoRestar(e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {removibles.map((l) => (
                    <option key={String(l.tipoTransporteId)} value={String(l.tipoTransporteId)}>
                      {l.tipoTransporteNombre || 'Sin tipo'} ({Number(l.cantidad)})
                    </option>
                  ))}
                </select>
                {removibles.length === 0 ? (
                  <span style={{ fontSize: 11, color: 'var(--color-error)' }}>No hay camiones de este tipo para descontar.</span>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                    Solo puedes descontar camiones que existen actualmente en este día.
                  </p>
                )}
              </div>
            )}

            {/* C) SUSPENDER DÍA */}
            {accion === 'suspender' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className="mx-label" style={{ fontWeight: 700 }}>Motivo <span style={{ color: 'var(--color-error)' }}>*</span></label>
                  <select className="mx-select" required value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                    {SUSPEND_MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#991b1b' }}>
                  Este día quedará sin cosecha y el programa se recalculará automáticamente.
                </div>
              </div>
            )}

            {/* Motivo para sumar/restar */}
            {accion !== 'suspender' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
                <label className="mx-label">Motivo del ajuste <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select className="mx-select" required value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                  {ADJUST_MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
              <label className="mx-label">Nota operacional (opcional)</label>
              <textarea className="mx-textarea" rows="2" value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
          </div>

          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button
              type="submit"
              className={`mx-btn ${accion === 'suspender' ? 'mx-btn-danger' : 'mx-btn-primary'}`}
              disabled={confirmDisabled}
              title={accion === 'restar' && !puedeDescontar ? 'No hay camiones de este tipo para descontar.' : undefined}
            >
              {accion === 'sumar' && <><Plus size={16} /> Sumar camión</>}
              {accion === 'restar' && <><CheckCircle2 size={16} /> Descontar camión</>}
              {accion === 'suspender' && <><CheckCircle2 size={16} /> Suspender día</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
