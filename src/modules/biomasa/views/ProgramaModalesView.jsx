import { createPortal } from 'react-dom';
import {
  X, AlertTriangle, CheckCircle2, Pause,
  Calendar as CalendarIcon, Truck, Building2, Plus, Trash,
} from 'lucide-react';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import { calcTerminoPrograma, fmtNumber, ADJUST_MOTIVOS } from '../utils/programaCalculos';

export default function ProgramaModalesView({
  // AdjustModal
  showAdjustModal, setShowAdjustModal,
  adjustProgram, adjustForm, setAdjustForm,
  adjustMaxCamiones, handleAdjustSave,
  // SegModal
  showSegModal, setShowSegModal,
  segNota, setSegNota,
  segEstado, setSegEstado,
  handleSegSave,
  // ProgramaFormModal + ConfirmModal (estado compartido)
  showModal, setShowModal,
  showConfirm, setShowConfirm,
  formData, setFormData,
  editingId,
  tratoSaldo, tratoLimites, setTratoLimites,
  tratosAcordados, tiposTransporte,
  computeTratoLimites, fetchTratoSaldo,
  handleSave,
  submitAttempted, setSubmitAttempted,
  // PauseModal
  pauseModal, setPauseModal,
  pauseForm, setPauseForm,
  handlePauseConfirm,
  // ConfirmDeleteModal
  confirmDelete, setConfirmDelete,
  handleDelete,
  // FinalizeModal
  showFinalizeModal, setShowFinalizeModal,
  finalizingProgram,
  finalizeForm, setFinalizeForm,
  handleFinalizarConfirm,
  // ContinuityModal
  showContinuityModal, setShowContinuityModal,
  continuitySource,
  handleCrearContinuidad,
  // NotaPopover
  notaPopover, setNotaPopover,
  notasDia,
  handleUpsertNotaDia, handleDeleteNotaDia,
  // SuspendPopover
  suspendPopover, setSuspendPopover,
  handleSuspendDay,
}) {
  // Derivados para ProgramaFormModal y ConfirmModal
  const totalPrograma     = formData.transportesAvanzados.reduce((s, t) => s + (Number(t.camionesTotales)||0) * (Number(t.toneladasPorCamion)||0), 0);
  const totalToneladasDia = formData.transportesAvanzados.reduce((s, t) => s + (Number(t.cantidadDia)||0)    * (Number(t.toneladasPorCamion)||0), 0);
  const saldoRestante     = tratoSaldo?.tonsDisponibles != null ? tratoSaldo.tonsDisponibles - totalPrograma : null;
  const programaExcedido  = tratoSaldo?.tonsDisponibles != null && totalPrograma > 0 && totalPrograma > tratoSaldo.tonsDisponibles;
  const ritmoExcesivo     = totalToneladasDia > 0 && totalPrograma > 0 && totalToneladasDia > totalPrograma;
  const syntheticTpts     = formData.transportesAvanzados.map(t => ({ cantidadDia: t.cantidadDia, toneladasPorCamion: t.toneladasPorCamion }));
  const terminoEstimado   = calcTerminoPrograma(formData.vigenciaDesde, totalPrograma, syntheticTpts, formData.diasSemana);
  const diasEfectivos     = totalToneladasDia > 0 && totalPrograma > 0 ? Math.ceil(totalPrograma / totalToneladasDia) : null;
  const rowsValid = formData.transportesAvanzados.every(t =>
    t.tipoTransporteId && Number(t.camionesTotales) > 0 && Number(t.cantidadDia) > 0 && Number(t.toneladasPorCamion) > 0
  );
  const canSubmit = !!formData.tratoId && !!formData.vigenciaDesde
    && formData.tipoProducto !== 'sin_definir'
    && rowsValid && totalPrograma > 0
    && !programaExcedido && !ritmoExcesivo
    && formData.diasSemana.length > 0 && totalToneladasDia > 0;
  const transportErrors = formData.transportesAvanzados.map(t => ({
    tipo:               submitAttempted && !t.tipoTransporteId                  ? 'Tipo requerido' : null,
    camionesTotales:    submitAttempted && !(Number(t.camionesTotales) > 0)     ? 'Requerido' : null,
    cantidadDia:        submitAttempted && !(Number(t.cantidadDia) > 0)         ? 'Requerido' : null,
    toneladasPorCamion: submitAttempted && !(Number(t.toneladasPorCamion) > 0) ? 'Requerido' : null,
  }));
  const errProducto   = submitAttempted && formData.tipoProducto === 'sin_definir';
  const errFecha      = submitAttempted && !formData.vigenciaDesde;
  const errDiasSemana = submitAttempted && formData.diasSemana.length === 0;
  const hasAnyError   = submitAttempted && !canSubmit;

  // Derivados para ConfirmModal
  const selTrato   = tratosAcordados.find(t => String(t._id) === String(formData.tratoId));
  const provNombre = selTrato?.proveedorNombre || '';
  const centroStr  = [selTrato?.centroCodigo, selTrato?.centroNombre].filter(Boolean).join(' · ') || '';
  const saldo      = tratoSaldo?.tonsDisponibles != null ? tratoSaldo.tonsDisponibles - totalPrograma : null;
  const dias       = totalToneladasDia > 0 && totalPrograma > 0 ? Math.ceil(totalPrograma / totalToneladasDia) : null;
  const prodLabel  = { entero: 'Entero', carne: 'Carne', mc: 'Media Concha', sin_definir: 'Sin definir' }[formData.tipoProducto] || formData.tipoProducto;
  const fmtDate    = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  };
  const S = {
    card:         { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16 },
    label:        { fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6, display: 'block' },
    valLg:        { fontSize: 22, fontWeight: 900, lineHeight: 1.1, color: '#0F172A' },
    valMd:        { fontSize: 16, fontWeight: 800, color: '#0F172A' },
    iconCircle:   (bg) => ({ width: 42, height: 42, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
    sectionTitle: { fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8, marginTop: 4 },
  };

  const NC = ({ n }) => (
    <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{n}</div>
  );

  return (
    <>
      {/* ── MODAL AJUSTE DIARIO ── */}
      {showAdjustModal && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '560px' }}>
            <div className="mx-modal-header">
              <h2>Ajuste diario de cosecha</h2>
              <button className="mx-btn-icon" onClick={() => setShowAdjustModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdjustSave} className="mx-form">
              <div className="mx-modal-body">
                <div className="harvest-adjust-context">
                  <strong>{adjustProgram?.proveedorNombre}</strong>
                  <span>
                    {adjustProgram?.centroNombre || 'Sin centro definido'} — base {adjustProgram?.camionesDefault || 0} cam/día
                    {adjustMaxCamiones != null && ` · acordado: ${adjustMaxCamiones} cam/día`}
                  </span>
                </div>
                <div className="mx-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="mx-form-group">
                    <label className="mx-label">Fecha</label>
                    <input type="date" className="mx-input" value={adjustForm.fecha} required
                      onChange={e => setAdjustForm({ ...adjustForm, fecha: e.target.value })} />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Accion</label>
                    <select className="mx-select" value={adjustForm.accion}
                      onChange={e => setAdjustForm({ ...adjustForm, accion: e.target.value })}>
                      <option value="set_total">Cambiar total del dia</option>
                      <option value="sumar">Sumar camion</option>
                      <option value="suspender">Suspender camion</option>
                      <option value="suspender_dia">Suspender dia completo</option>
                    </select>
                  </div>
                  {adjustForm.accion !== 'suspender_dia' && (
                    <div className="mx-form-group">
                      <label className="mx-label">{adjustForm.accion === 'set_total' ? 'Total camiones del dia' : 'Camiones'}</label>
                      <input type="number" className="mx-input" min="0" value={adjustForm.camiones} required
                        onChange={e => setAdjustForm({ ...adjustForm, camiones: e.target.value })} />
                    </div>
                  )}
                  <div className="mx-form-group">
                    <label className="mx-label">Motivo</label>
                    <select className="mx-select" value={adjustForm.motivo}
                      onChange={e => setAdjustForm({ ...adjustForm, motivo: e.target.value })}>
                      {ADJUST_MOTIVOS.map((motivo) => (
                        <option key={motivo} value={motivo}>{motivo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mx-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Nota operacional</label>
                    <textarea className="mx-textarea" value={adjustForm.nota} rows="3"
                      placeholder="Ej: Se suspendio un camion por falta de ventana en planta."
                      onChange={e => setAdjustForm({ ...adjustForm, nota: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowAdjustModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  <CheckCircle2 size={18} /> Guardar ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL SEGUIMIENTO / NOVEDAD ── */}
      {showSegModal && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '500px' }}>
            <div className="mx-modal-header">
              <h2>Registrar Novedad</h2>
              <button className="mx-btn-icon" onClick={() => setShowSegModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSegSave} className="mx-form">
              <div className="mx-modal-body">
                <div className="mx-form-group">
                  <label className="mx-label">Estado de Cosecha</label>
                  <select className="mx-select" value={segEstado} required
                    onChange={e => setSegEstado(e.target.value)}>
                    <option value="">Seleccionar</option>
                    <option value="en_plan">En plan</option>
                    <option value="con_retrasos">Con retrasos</option>
                    <option value="detenido">Detenido</option>
                  </select>
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Nota / Observación de Cosecha</label>
                  <textarea className="mx-textarea" value={segNota} required
                    placeholder="Describe lo ocurrido (ej: retraso por clima, cambio de logística...)"
                    onChange={e => setSegNota(e.target.value)} />
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowSegModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  <CheckCircle2 size={18} /> Registrar Novedad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL PROGRAMA (crear / editar) ── */}
      {showModal && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '560px' }}>
            <div className="mx-modal-header">
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>{editingId ? 'Editar Programa' : 'Nuevo Programa de Cosecha'}</h2>
              <button className="mx-btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="mx-form">
              <div className="mx-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {hasAnyError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <AlertTriangle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>Revisa los campos marcados antes de continuar.</span>
                  </div>
                )}

                {/* ══ BLOQUE 1 — Cabecera del trato ══ */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 148px', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Proveedor / Trato acordado</label>
                      <select className="mx-select" value={formData.tratoId} required
                        onChange={e => {
                          const t = tratosAcordados.find(x => x._id === e.target.value);
                          const limites = computeTratoLimites(t);
                          setTratoLimites(limites);
                          setFormData({ ...formData, tratoId: e.target.value, vigenciaDesde: limites.vigenciaDesde || formData.vigenciaDesde, vigenciaHasta: limites.vigenciaHasta || formData.vigenciaHasta, tipoProducto: t?.tipoProducto || t?.tipoProductoSugerido || formData.tipoProducto || 'sin_definir' });
                          fetchTratoSaldo(e.target.value, editingId);
                        }}>
                        <option value="">— Seleccionar trato —</option>
                        {tratosAcordados.map(t => (
                          <option key={t._id} value={t._id}>{t.proveedorNombre} — {t.tonsAcordadas} t{t.centroCodigo ? ` (${t.centroCodigo})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: errFecha ? '#EF4444' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Desde</label>
                      <input type="date" className="mx-input" value={formData.vigenciaDesde} required
                        min={tratoLimites.vigenciaDesde || undefined}
                        style={errFecha ? { borderColor: '#EF4444', background: '#FEF2F2' } : {}}
                        onChange={e => setFormData({ ...formData, vigenciaDesde: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #F1F5F9', paddingTop: 10, gap: 8 }}>
                    {[
                      { label: 'Acordado',    value: tratoSaldo ? `${fmtNumber(tratoSaldo.tonsAcordadas, 0)} t`    : '—', color: '#1e293b' },
                      { label: 'Programado',  value: tratoSaldo ? `${fmtNumber(tratoSaldo.tonsYaProgramadas, 0)} t` : '—', color: '#64748b' },
                      { label: 'Disponible',  value: tratoSaldo ? `${fmtNumber(tratoSaldo.tonsDisponibles, 0)} t`  : '—', color: tratoSaldo?.tonsDisponibles > 0 ? '#10B981' : '#DC2626' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginTop: 3, letterSpacing: '0.04em' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ══ BLOQUE 2 — ¿Qué vamos a programar? ══ */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <NC n={1} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>¿Qué vamos a programar?</span>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>Producto</label>
                    <select className="mx-select" style={{ maxWidth: 200, ...(errProducto ? { borderColor: '#EF4444', background: '#FEF2F2' } : {}) }}
                      value={formData.tipoProducto}
                      onChange={e => setFormData({ ...formData, tipoProducto: e.target.value })}>
                      <option value="sin_definir">— Selecciona un producto —</option>
                      <option value="entero">Entero</option>
                      <option value="carne">Carne</option>
                      <option value="mc">Media Concha</option>
                    </select>
                    {errProducto && <div style={{ marginTop: 4, fontSize: 12, color: '#EF4444', fontWeight: 500 }}>Selecciona un producto.</div>}
                  </div>
                  <div style={{ margin: '10px 0 12px', height: 1, background: '#F1F5F9' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Tipos de camión</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {['Tipo camión', 'Cam. totales', 'Cam/día', 'T/camión', 'Total'].map((h, i) => (
                            <th key={i} style={{ padding: '4px 6px', textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                          <th style={{ width: 28, borderBottom: '2px solid #E2E8F0' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {formData.transportesAvanzados.map((t, idx) => {
                          const tTotales = (Number(t.camionesTotales)||0) * (Number(t.toneladasPorCamion)||0);
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '5px 4px 5px 0' }}>
                                <select
                                  style={{ width: '100%', height: 30, padding: '2px 6px', fontSize: 12, border: `1px solid ${transportErrors[idx]?.tipo ? '#EF4444' : '#E2E8F0'}`, borderRadius: 7, background: transportErrors[idx]?.tipo ? '#FEF2F2' : '#fff', color: t.tipoTransporteId ? '#0F172A' : '#94a3b8' }}
                                  value={t.tipoTransporteId}
                                  onChange={e => {
                                    const tipo = tiposTransporte.find(x => x._id === e.target.value);
                                    const tonsAuto = tipo?.maxisPorUnidad && tipo?.kgPorMaxiRef ? Math.round((tipo.maxisPorUnidad * tipo.kgPorMaxiRef) / 100) / 10 : null;
                                    const next = [...formData.transportesAvanzados];
                                    
                                    let newTonsPerCamion = tonsAuto ?? t.toneladasPorCamion;
                                    let newCamionesTotales = t.camionesTotales;

                                    if (newTonsPerCamion > 0 && tratoSaldo?.tonsDisponibles != null && !t.camionesTotales) {
                                      const otherRowsTotal = formData.transportesAvanzados.reduce((sum, row, i) => {
                                        if (i === idx) return sum;
                                        return sum + (Number(row.camionesTotales) || 0) * (Number(row.toneladasPorCamion) || 0);
                                      }, 0);
                                      const available = Math.max(0, tratoSaldo.tonsDisponibles - otherRowsTotal);
                                      newCamionesTotales = Math.floor(available / newTonsPerCamion);
                                    }

                                    next[idx] = { 
                                      ...t, 
                                      tipoTransporteId: e.target.value, 
                                      tipoTransporteNombre: tipo?.nombre || '', 
                                      toneladasPorCamion: newTonsPerCamion,
                                      camionesTotales: newCamionesTotales
                                    };
                                    setFormData({ ...formData, transportesAvanzados: next });
                                  }}>
                                  <option value="">Sin tipo</option>
                                  {tiposTransporte.map(x => <option key={x._id} value={x._id}>{x.nombre}</option>)}
                                </select>
                              </td>
                              {[['camionesTotales','total'],['cantidadDia','p/día'],['toneladasPorCamion','t/cam']].map(([field, ph]) => {
                                const hasErr = !!transportErrors[idx]?.[field];
                                return (
                                  <td key={field} style={{ padding: '5px 4px', textAlign: 'center' }}>
                                    <input type="number" min="0" step={field === 'toneladasPorCamion' ? '0.1' : '1'}
                                      style={{ width: 58, height: 30, padding: '2px 4px', textAlign: 'center', fontSize: 12, border: `1px solid ${hasErr ? '#EF4444' : '#E2E8F0'}`, borderRadius: 7, background: hasErr ? '#FEF2F2' : '#fff', color: '#0F172A' }}
                                      placeholder={ph} value={t[field]}
                                      onChange={e => {
                                        const next = [...formData.transportesAvanzados];
                                        let newValue = e.target.value;
                                        let newCamionesTotales = t.camionesTotales;

                                        if (field === 'toneladasPorCamion') {
                                          const newTons = Number(newValue);
                                          if (newTons > 0 && tratoSaldo?.tonsDisponibles != null && (!t.camionesTotales || t.camionesTotales === '')) {
                                            const otherRowsTotal = formData.transportesAvanzados.reduce((sum, row, i) => {
                                              if (i === idx) return sum;
                                              return sum + (Number(row.camionesTotales) || 0) * (Number(row.toneladasPorCamion) || 0);
                                            }, 0);
                                            const available = Math.max(0, tratoSaldo.tonsDisponibles - otherRowsTotal);
                                            newCamionesTotales = Math.floor(available / newTons);
                                          }
                                        }

                                        next[idx] = { ...t, [field]: newValue };
                                        if (field === 'toneladasPorCamion' && newCamionesTotales !== t.camionesTotales) {
                                          next[idx].camionesTotales = newCamionesTotales;
                                        }

                                        setFormData({ ...formData, transportesAvanzados: next });
                                      }} />
                                  </td>
                                );
                              })}
                              <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 700, color: tTotales > 0 ? 'var(--color-primary)' : '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                                {tTotales > 0 ? `${fmtNumber(tTotales, 0)} t` : '—'}
                              </td>
                              <td style={{ padding: '5px 0 5px 4px', textAlign: 'center' }}>
                                {formData.transportesAvanzados.length > 1 && (
                                  <button type="button"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: 'none', background: '#FEE2E2', borderRadius: 7, color: '#DC2626', cursor: 'pointer' }}
                                    onClick={() => setFormData({ ...formData, transportesAvanzados: formData.transportesAvanzados.filter((_, i) => i !== idx) })}>
                                    <Trash size={12} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button type="button" className="mx-btn mx-btn-outline" style={{ fontSize: 12, height: 30, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      onClick={() => setFormData({ ...formData, transportesAvanzados: [...formData.transportesAvanzados, { tipoTransporteId: '', tipoTransporteNombre: '', camionesTotales: '', cantidadDia: '', toneladasPorCamion: '' }] })}>
                      <Plus size={12} /> Agregar tipo de camión
                    </button>
                  </div>
                  {totalPrograma > 0 && (
                    <div style={{ marginTop: 10, background: programaExcedido ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${programaExcedido ? '#FECACA' : '#BBF7D0'}`, borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Total a programar</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: programaExcedido ? '#DC2626' : '#10B981', lineHeight: 1 }}>{fmtNumber(totalPrograma, 0)} t</div>
                        </div>
                        {saldoRestante != null && (
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Saldo restante</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: saldoRestante >= 0 ? '#10B981' : '#DC2626', lineHeight: 1 }}>{fmtNumber(Math.max(0, saldoRestante), 0)} t</div>
                          </div>
                        )}
                      </div>
                      {programaExcedido && tratoSaldo && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                          <AlertTriangle size={13} />
                          No puedes programar {fmtNumber(totalPrograma, 0)} t. Disponible del trato: {fmtNumber(tratoSaldo.tonsDisponibles, 0)} t.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ══ BLOQUE 3 — ¿Cómo lo vamos a sacar? ══ */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <NC n={2} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>¿Cómo lo vamos a sacar?</span>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Días de cosecha</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => {
                        const activo = formData.diasSemana.includes(i);
                        return (
                          <label key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: activo ? 700 : 400, cursor: 'pointer', background: activo ? 'var(--color-primary)' : '#fff', border: `1px solid ${activo ? 'var(--color-primary)' : (errDiasSemana ? '#EF4444' : '#E2E8F0')}`, color: activo ? '#fff' : '#64748b', transition: 'all 0.12s ease', userSelect: 'none' }}>
                            <input type="checkbox" style={{ display: 'none' }} checked={activo}
                              onChange={() => setFormData({ ...formData, diasSemana: activo ? formData.diasSemana.filter(x => x !== i) : [...formData.diasSemana, i] })} />
                            {d}
                          </label>
                        );
                      })}
                    </div>
                    {errDiasSemana && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#EF4444', fontWeight: 500, display: 'flex', gap: 5, alignItems: 'center' }}>
                        <AlertTriangle size={12} /> Selecciona al menos un día de cosecha.
                      </div>
                    )}
                  </div>
                  {(totalToneladasDia > 0 || diasEfectivos != null || terminoEstimado) ? (
                    <div style={{ background: ritmoExcesivo ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${ritmoExcesivo ? '#FECACA' : '#E2E8F0'}`, borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Total diario',      value: totalToneladasDia > 0 ? `${fmtNumber(totalToneladasDia, 0)} t/día` : '—' },
                          { label: 'Días efectivos',    value: diasEfectivos != null ? String(diasEfectivos) : '—' },
                          { label: 'Término estimado',  value: terminoEstimado || 'Pendiente' },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2, letterSpacing: '0.04em' }}>{label}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      {ritmoExcesivo && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                          <AlertTriangle size={12} />
                          El ritmo ({fmtNumber(totalToneladasDia, 0)} t/día) supera el total. Reduce los camiones por día.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Completa los datos para ver el resumen.</div>
                  )}
                </div>

                {/* ══ BLOQUE 4 — Notas ══ */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <NC n={3} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                      Notas / Observaciones <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>(opcional)</span>
                    </span>
                  </div>
                  <textarea className="mx-textarea" value={formData.notas} rows="2" placeholder="Escribe aquí..."
                    onChange={e => setFormData({ ...formData, notas: e.target.value })}
                    style={{ resize: 'vertical', minHeight: 60 }} />
                </div>

              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => { setShowModal(false); setSubmitAttempted(false); }}>Cancelar</button>
                <button type="button" className="mx-btn mx-btn-primary"
                  onClick={() => { setSubmitAttempted(true); if (canSubmit) setShowConfirm(true); }}>
                  <CheckCircle2 size={18} /> {editingId ? 'Guardar Cambios' : 'Crear Programa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR PROGRAMA (portal) ── */}
      {showConfirm && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            style={{ background: '#F8FAFC', borderRadius: 24, boxShadow: '0 25px 60px -10px rgba(15,23,42,0.22)', width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#fff', padding: '20px 24px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>{editingId ? 'Confirmar cambios' : 'Confirmar programa'}</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Revisa el resumen antes de {editingId ? 'guardar.' : 'crear el programa.'}</p>
              </div>
              <button type="button" onClick={() => setShowConfirm(false)}
                style={{ border: 'none', background: '#F1F5F9', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', flexShrink: 0, marginLeft: 16 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={S.iconCircle('#EFF6FF')}><Building2 size={20} color="#2563EB" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ ...S.label, marginBottom: 3 }}>Proveedor</span>
                  <div style={{ ...S.valMd, fontSize: 17 }}>{provNombre || '—'}</div>
                  {centroStr && <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{centroStr}</div>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                <div style={{ ...S.card, textAlign: 'center' }}>
                  <span style={S.label}>Total programado</span>
                  <div style={{ ...S.valLg, color: '#2563EB' }}>{totalPrograma > 0 ? `${fmtNumber(totalPrograma, 0)} t` : '—'}</div>
                </div>
                <div style={{ ...S.card, textAlign: 'center' }}>
                  <span style={S.label}>Saldo del trato</span>
                  <div style={{ ...S.valLg, color: saldo != null && saldo < 0 ? '#EF4444' : '#10B981' }}>
                    {saldo != null ? `${fmtNumber(Math.max(0, saldo), 0)} t` : '—'}
                  </div>
                </div>
                <div style={{ ...S.card, textAlign: 'center' }}>
                  <span style={S.label}>Producto</span>
                  <div style={{ ...S.valMd }}>{prodLabel}</div>
                </div>
                <div style={{ ...S.card, textAlign: 'center' }}>
                  <span style={S.label}>Inicio</span>
                  <div style={{ ...S.valMd }}>{fmtDate(formData.vigenciaDesde)}</div>
                </div>
                <div style={{ ...S.card, textAlign: 'center' }}>
                  <span style={S.label}>Total diario</span>
                  <div style={{ ...S.valMd }}>{totalToneladasDia > 0 ? `${fmtNumber(totalToneladasDia, 0)} t/día` : '—'}</div>
                </div>
                <div style={{ ...S.card, textAlign: 'center' }}>
                  <span style={S.label}>Días efectivos</span>
                  <div style={{ ...S.valMd }}>{dias != null ? `${dias} días` : '—'}</div>
                </div>
              </div>
              {terminoEstimado && (
                <div style={{ ...S.card, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={S.iconCircle('#DBEAFE')}><CalendarIcon size={20} color="#2563EB" /></div>
                  <div>
                    <span style={{ ...S.label, color: '#3B82F6', marginBottom: 3 }}>Término estimado</span>
                    <div style={{ ...S.valMd, fontSize: 18, color: '#1D4ED8' }}>{terminoEstimado}</div>
                  </div>
                </div>
              )}
              <div>
                <div style={S.sectionTitle}>Desglose de transporte</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {formData.transportesAvanzados.map((t, i) => {
                    const tt = (Number(t.camionesTotales)||0) * (Number(t.toneladasPorCamion)||0);
                    return (
                      <div key={i} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={S.iconCircle('#F1F5F9')}><Truck size={18} color="#475569" /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{t.tipoTransporteNombre || 'Sin tipo'}</div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            {t.camionesTotales} camiones totales &middot; {t.cantidadDia} por día &middot; {t.toneladasPorCamion} t/camión
                          </div>
                        </div>
                        {tt > 0 && <div style={{ fontSize: 18, fontWeight: 900, color: '#2563EB', flexShrink: 0 }}>{fmtNumber(tt, 0)} t</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={S.sectionTitle}>Días de cosecha</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d, i) => (
                    formData.diasSemana.includes(i) && (
                      <span key={i} style={{ padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: '#2563EB', color: '#fff', letterSpacing: '0.01em' }}>{d}</span>
                    )
                  ))}
                </div>
              </div>
              {formData.notas?.trim() && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '12px 16px' }}>
                  <span style={{ ...S.label, color: '#92400E' }}>Notas</span>
                  <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>{formData.notas}</div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '11px 14px' }}>
                <AlertTriangle size={16} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>
                  Este programa se {editingId ? 'actualizará' : 'creará'} para <strong>{provNombre}</strong>{centroStr ? ` · ${centroStr}` : ''}.
                </span>
              </div>
            </div>
            <div style={{ background: '#fff', padding: '14px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowConfirm(false)}>← Volver a editar</button>
              <button type="button" className="mx-btn mx-btn-primary" onClick={handleSave}>
                <CheckCircle2 size={16} /> {editingId ? 'Confirmar y guardar' : 'Confirmar y crear'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL PAUSAR PROGRAMA ── */}
      {pauseModal && (
        <div className="mx-modal-overlay" onClick={() => setPauseModal(null)}>
          <div className="mx-modal pause-modal" onClick={e => e.stopPropagation()}>
            <div className="mx-modal-header">
              <h2>Pausar programa</h2>
              <button className="mx-modal-close" onClick={() => setPauseModal(null)}>✕</button>
            </div>
            <div className="mx-modal-body">
              <p className="pause-modal-desc">
                <strong>{pauseModal.proveedorNombre}</strong> — los días desde la fecha de pausa no se proyectarán en el calendario. Los datos históricos se conservan.
              </p>
              <div className="mx-form-group">
                <label className="mx-label">Pausado desde</label>
                <input type="date" className="mx-input" value={pauseForm.pausadoDesde}
                  onChange={e => setPauseForm(f => ({ ...f, pausadoDesde: e.target.value }))} />
              </div>
              <div className="mx-form-group">
                <label className="mx-label">Motivo (opcional)</label>
                <textarea className="mx-input" rows={3} placeholder="Ej: problema sanitario, falta de biomasa..."
                  value={pauseForm.motivoPausa}
                  onChange={e => setPauseForm(f => ({ ...f, motivoPausa: e.target.value }))} />
              </div>
            </div>
            <div className="mx-modal-footer">
              <button className="mx-btn mx-btn-outline" onClick={() => setPauseModal(null)}>Cancelar</button>
              <button className="mx-btn mx-btn-warning" onClick={handlePauseConfirm}>
                <Pause size={14} /> Pausar programa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR ELIMINACIÓN ── */}
      <ConfirmDeleteModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="¿Eliminar programa?"
        description={confirmDelete ? `Estás a punto de borrar el programa de cosecha de "${confirmDelete.proveedorNombre}". Esta acción es irreversible.` : ''}
      />

      {/* ── MODAL FINALIZAR PROGRAMA ── */}
      {showFinalizeModal && finalizingProgram && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: 500 }}>
            <div className="mx-modal-header">
              <h2>Finalizar programa</h2>
              <button className="mx-btn-icon" onClick={() => setShowFinalizeModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleFinalizarConfirm} className="mx-form">
              <div className="mx-modal-body">
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
                  {finalizingProgram.proveedorNombre}{finalizingProgram.centroNombre ? ` · ${finalizingProgram.centroNombre}` : ''}
                </p>
                <div className="mx-form-group">
                  <label className="mx-label">Fecha real de cierre *</label>
                  <input type="date" className="mx-input" value={finalizeForm.fechaCierre} required
                    onChange={e => setFinalizeForm(f => ({ ...f, fechaCierre: e.target.value }))} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-subtle)', marginTop: 4, display: 'block' }}>
                    Esta fecha queda registrada como el último día real de cosecha.
                  </span>
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Motivo de cierre *</label>
                  <select className="mx-select" value={finalizeForm.motivoCierre} required
                    onChange={e => setFinalizeForm(f => ({ ...f, motivoCierre: e.target.value }))}>
                    <option value="">Selecciona motivo...</option>
                    <option value="cumplido">Cumplido — cosecha completada</option>
                    <option value="cambio_condiciones">Cambio de condiciones — nuevo precio u acuerdo</option>
                    <option value="pausa_operacional">Pausa operacional — retoma con nuevo programa</option>
                    <option value="sin_biomasa">Sin biomasa — stock agotado</option>
                    <option value="reemplazado_por_nuevo">Reemplazado por nuevo programa</option>
                  </select>
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Nota (opcional)</label>
                  <textarea className="mx-textarea" rows={3} placeholder="Observaciones sobre el cierre..."
                    value={finalizeForm.nota}
                    onChange={e => setFinalizeForm(f => ({ ...f, nota: e.target.value }))} />
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowFinalizeModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary" disabled={!finalizeForm.motivoCierre || !finalizeForm.fechaCierre}>
                  Finalizar programa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONTINUIDAD ── */}
      {showContinuityModal && continuitySource && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: 440 }}>
            <div className="mx-modal-header">
              <h2>Programa finalizado</h2>
              <button className="mx-btn-icon" onClick={() => setShowContinuityModal(false)}><X size={20} /></button>
            </div>
            <div className="mx-modal-body" style={{ textAlign: 'center', padding: '24px' }}>
              <CheckCircle2 size={40} style={{ color: 'var(--color-success)', marginBottom: 16 }} />
              <p style={{ color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
                ¿Crear un programa de continuidad para <strong>{continuitySource.proveedorNombre}</strong>? Se abre el formulario pre-llenado con los datos del programa anterior.
              </p>
            </div>
            <div className="mx-modal-footer">
              <button className="mx-btn mx-btn-outline" onClick={() => setShowContinuityModal(false)}>No, gracias</button>
              <button className="mx-btn mx-btn-primary" onClick={handleCrearContinuidad}>Sí, crear continuidad</button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPOVER NOTA DEL DÍA ── */}
      {notaPopover && (
        <>
          <div className="suspend-popover-backdrop" onClick={() => setNotaPopover(null)} />
          <div className="suspend-popover nota-popover" style={{ left: notaPopover.x, top: notaPopover.y }}>
            <div className="suspend-popover-title">Nota del día · {notaPopover.fechaKey}</div>
            <textarea className="mx-textarea" rows={3} autoFocus
              placeholder="Ej: Se compensó camión de Algemarín con García por clima..."
              value={notaPopover.nota}
              onChange={e => setNotaPopover(p => ({ ...p, nota: e.target.value }))} />
            <div className="suspend-popover-footer">
              {notasDia?.[notaPopover.fechaKey] && (
                <button className="mx-btn mx-btn-danger sm" onClick={() => handleDeleteNotaDia(notaPopover.fechaKey)}>Eliminar</button>
              )}
              <button className="mx-btn mx-btn-outline sm" onClick={() => setNotaPopover(null)}>Cancelar</button>
              <button className="mx-btn mx-btn-primary sm" disabled={!notaPopover.nota?.trim()}
                onClick={() => handleUpsertNotaDia(notaPopover.fechaKey, notaPopover.nota)}>Guardar</button>
            </div>
          </div>
        </>
      )}

      {/* ── POPOVER SUSPENDER DÍA ── */}
      {suspendPopover && (
        <>
          <div className="suspend-popover-backdrop" onClick={() => setSuspendPopover(null)} />
          <div className="suspend-popover" style={{ left: suspendPopover.x, top: suspendPopover.y }}>
            <div className="suspend-popover-title">Suspender día</div>
            <select className="mx-select" value={suspendPopover.motivo}
              onChange={e => setSuspendPopover(p => ({ ...p, motivo: e.target.value }))}>
              {ADJUST_MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input className="mx-input" placeholder="Nota (opcional)" value={suspendPopover.nota}
              onChange={e => setSuspendPopover(p => ({ ...p, nota: e.target.value }))} />
            <div className="suspend-popover-footer">
              <button className="mx-btn mx-btn-outline sm" onClick={() => setSuspendPopover(null)}>Cancelar</button>
              <button className="mx-btn mx-btn-danger sm"
                onClick={() => handleSuspendDay(suspendPopover.programa, suspendPopover.fecha, suspendPopover.motivo, suspendPopover.nota)}>
                Suspender
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
