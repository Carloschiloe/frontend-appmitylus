import React from 'react';
import { Search, X, AlertTriangle, XCircle, Plus, Trash2 } from 'lucide-react';
import { calcularFechaTermino, calcularTonsDiarias, formatDateOnlySafe, parseNumberOrNull } from './tratos.helpers';

export default function TratoFormModal({
  isOpen,
  editingId,
  form,
  selectedProvider,
  providerSearch,
  loadingProviders,
  filteredProviders,
  responsables,
  tiposTransporte = [],
  onClose,
  onSubmit,
  onFormChange,
  onProviderSearchChange,
  onClearSelectedProvider,
  onSelectProvider,
  onConditionModeChange,
  onConditionValueChange,
  onConditionStatusChange,
}) {
  if (!isOpen) return null;

  const transportes = form.transportes || [];
  const diasConfig  = form.diasHabilesConfig || { vie: false, sab: false };

  const addTransporte = () => onFormChange({
    ...form,
    transportes: [...transportes, { tipoTransporteId: '', nombre: '', modo: null, cantidadDiaria: '', maxisPorUnidad: '', kgPorMaxiRef: '' }],
  });

  const removeTransporte = (idx) => onFormChange({
    ...form,
    transportes: transportes.filter((_, i) => i !== idx),
  });

  const updateTransporte = (idx, patch) => {
    const next = transportes.map((t, i) => i === idx ? { ...t, ...patch } : t);
    onFormChange({ ...form, transportes: next });
  };

  const handleTipoChange = (idx, tipoId) => {
    const tipo = tiposTransporte.find(t => t._id === tipoId);
    updateTransporte(idx, {
      tipoTransporteId: tipoId,
      nombre: tipo?.nombre || '',
      modo: tipo?.modo || null,
      maxisPorUnidad: tipo?.maxisPorUnidad ?? transportes[idx].maxisPorUnidad,
      kgPorMaxiRef:   tipo?.kgPorMaxiRef   ?? transportes[idx].kgPorMaxiRef,
    });
  };

  const toggleDia = (dia) => onFormChange({
    ...form,
    diasHabilesConfig: { ...diasConfig, [dia]: !diasConfig[dia] },
  });

  const tonsDia   = calcularTonsDiarias(transportes);
  const tonsTotal = parseNumberOrNull(form.tonsAcordadas);
  const diasNecesarios = (tonsDia > 0 && tonsTotal > 0) ? Math.ceil(tonsTotal / tonsDia) : null;
  const fechaTermino   = calcularFechaTermino(form.fechaInicioCosecha, tonsTotal, transportes, diasConfig);

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal tratos-form-modal">
        <div className="mx-modal-header">
          <h2>{editingId ? 'Editar Trato' : 'Nuevo Trato'}</h2>
          <button type="button" className="mx-btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={onSubmit} className="mx-form">
          <div className="mx-modal-body">
            <div className="mx-form-group">
              <label className="mx-label">Proveedor</label>
              {editingId ? (
                <div className="tratos-provider-readonly">
                  <strong>{form.proveedorNombre || 'Proveedor sin nombre'}</strong>
                  <span>
                    {selectedProvider?.contactoNombre || 'Proveedor ya asociado'}
                    {selectedProvider?.comuna ? ` - ${selectedProvider.comuna}` : ''}
                  </span>
                </div>
              ) : (
                <>
                  <div className="tratos-provider-search">
                    <Search size={18} className="tratos-search-icon" />
                    <input
                      type="text"
                      placeholder="Buscar empresa, comuna o contacto..."
                      value={providerSearch}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        onProviderSearchChange(nextValue);
                        onFormChange({ ...form, proveedorNombre: nextValue });
                        if (selectedProvider && nextValue.trim() !== (selectedProvider.proveedorNombre || '').trim()) {
                          onClearSelectedProvider();
                        }
                      }}
                    />
                  </div>
                  <div className="tratos-provider-results">
                    {loadingProviders ? (
                      <div className="gs-empty-inline">Cargando proveedores...</div>
                    ) : filteredProviders.length === 0 ? (
                      <div className="gs-empty-inline">No encontramos coincidencias en el directorio.</div>
                    ) : (
                      filteredProviders.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`tratos-provider-option ${selectedProvider?.id === item.id ? 'is-selected' : ''}`}
                          onClick={() => onSelectProvider(item)}
                        >
                          <strong>{item.proveedorNombre || 'Proveedor'}</strong>
                          <span>
                            {item.contactoNombre || 'Primer contacto'}
                            {item.contactoTelefono ? ` - ${item.contactoTelefono}` : ''}
                            {item.comuna ? ` - ${item.comuna}` : ''}
                            {item.centros ? ` - ${item.centros} centro${item.centros > 1 ? 's' : ''}` : ''}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="mx-form-group">
              <label className="mx-label">Tons Acordadas</label>
              <input
                type="number"
                step="1"
                className="mx-input"
                value={form.tonsAcordadas}
                onChange={e => onFormChange({ ...form, tonsAcordadas: e.target.value })}
              />
            </div>

            <div className="am-mt-16">
              <label className="mx-label am-mb-8 tratos-conditions-title">
                Condiciones de Negociacion (Maestros)
              </label>
              <div className="mx-conditions-checklist tratos-conditions-list">
                {form.condiciones.length === 0 ? (
                  <p className="tratos-conditions-empty">No hay condiciones configuradas en maestros.</p>
                ) : (
                  form.condiciones.map((c, idx) => (
                    <div key={idx} className="tratos-condition-row">
                      <span className="tratos-condition-name">{c.nombre}</span>

                      {c.tipoValor === 'porcentaje' && (
                        <select
                          className="mx-input tratos-condition-control tratos-condition-control-auto"
                          value={c.modoCondicion || 'normal'}
                          onChange={(e) => onConditionModeChange(idx, e.target.value)}
                        >
                          <option value="normal">Normal</option>
                          <option value="fijo">Fijo</option>
                        </select>
                      )}

                      {!(c.tipoValor === 'porcentaje' && (!c.modoCondicion || c.modoCondicion === 'normal')) && (
                        <input
                          type={['numero', 'moneda', 'porcentaje', 'dias'].includes(c.tipoValor) ? 'number' : 'text'}
                          className="mx-input tratos-condition-control tratos-condition-value"
                          placeholder={c.tipoValor === 'moneda' ? '$ Valor' : c.tipoValor === 'porcentaje' ? '% Valor' : 'Valor'}
                          value={c.valor || ''}
                          onChange={(e) => onConditionValueChange(idx, e.target.value)}
                        />
                      )}

                      <select
                        className="mx-input tratos-condition-control tratos-condition-control-auto"
                        value={c.estado}
                        onChange={(e) => onConditionStatusChange(idx, e.target.value)}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="acordado">Acordado</option>
                        <option value="rechazado">Rechazado</option>
                      </select>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mx-form-group am-mt-16">
              <label className="mx-label">Fecha probable inicio cosecha</label>
              <input
                type="date"
                className="mx-input"
                value={form.fechaInicioCosecha}
                onChange={e => onFormChange({ ...form, fechaInicioCosecha: e.target.value })}
              />
            </div>

            {/* ── Transportes de cosecha ── */}
            <div className="mx-form-group am-mt-16">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="mx-label tratos-conditions-title" style={{ marginBottom: 0 }}>
                  Transportes de Cosecha
                </label>
                <button type="button" className="mx-btn mx-btn-outline" style={{ height: 28, fontSize: '0.78rem', padding: '0 10px' }} onClick={addTransporte}>
                  <Plus size={13} /> Agregar
                </button>
              </div>

              <div className="tratos-conditions-list">
                {transportes.length === 0 ? (
                  <p className="tratos-conditions-empty">Sin transportes. Agrégalos para calcular la fecha de término.</p>
                ) : (
                  <>
                    {transportes.map((t, idx) => {
                      const tonsPorUnidad = ((Number(t.maxisPorUnidad) || 0) * (Number(t.kgPorMaxiRef) || 0)) / 1000;
                      const tonsDiaFila   = (Number(t.cantidadDiaria) || 0) * tonsPorUnidad;
                      return (
                        <div key={idx} className="tratos-transporte-row">
                          <select
                            className="mx-input tratos-condition-control"
                            value={t.tipoTransporteId || ''}
                            onChange={(e) => handleTipoChange(idx, e.target.value)}
                          >
                            <option value="">Tipo...</option>
                            {tiposTransporte.map(tt => (
                              <option key={tt._id} value={tt._id}>{tt.nombre}</option>
                            ))}
                          </select>
                          <input
                            type="number" min="1" step="1"
                            className="mx-input tratos-condition-control tratos-transporte-num"
                            placeholder="Cant/día"
                            value={t.cantidadDiaria ?? ''}
                            onChange={(e) => updateTransporte(idx, { cantidadDiaria: e.target.value })}
                          />
                          <input
                            type="number" min="1" step="1"
                            className="mx-input tratos-condition-control tratos-transporte-num"
                            placeholder="Maxis/un."
                            value={t.maxisPorUnidad ?? ''}
                            onChange={(e) => updateTransporte(idx, { maxisPorUnidad: e.target.value })}
                          />
                          <input
                            type="number" min="1" step="1"
                            className="mx-input tratos-condition-control tratos-transporte-num"
                            placeholder="Kg/maxi"
                            value={t.kgPorMaxiRef ?? ''}
                            onChange={(e) => updateTransporte(idx, { kgPorMaxiRef: e.target.value })}
                          />
                          <span className="tratos-transporte-tons">
                            {tonsDiaFila > 0 ? `${tonsDiaFila.toFixed(1)} t` : '—'}
                          </span>
                          <button type="button" className="mx-btn-icon" onClick={() => removeTransporte(idx)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                    {tonsDia > 0 && (
                      <div className="tratos-transporte-total">
                        <span>Total: <strong>{tonsDia.toFixed(1)} t/día</strong></span>
                        {diasNecesarios && <span>{diasNecesarios} días hábiles estimados</span>}
                      </div>
                    )}
                  </>
                )}

                {/* Días hábiles */}
                <div className="tratos-dias-wrap">
                  <span className="tratos-dias-label">Días de cosecha:</span>
                  <div className="tratos-dias-row">
                    {['Dom','Lun','Mar','Mié','Jue'].map(d => (
                      <span key={d} className="tratos-dia-pill tratos-dia-fixed">{d}</span>
                    ))}
                    {[['vie','Vie'],['sab','Sáb']].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`tratos-dia-pill tratos-dia-toggle${diasConfig[key] ? ' is-active' : ''}`}
                        onClick={() => toggleDia(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fecha término */}
                {fechaTermino && (
                  <div className="tratos-termino-banner">
                    <span>Término estimado:</span>
                    <strong>{formatDateOnlySafe(fechaTermino)}</strong>
                    {diasNecesarios && <span style={{ marginLeft: 'auto', fontSize: '0.78rem', opacity: 0.8 }}>({diasNecesarios} días)</span>}
                  </div>
                )}
              </div>
            </div>

            {editingId && (
              <div className="mx-form-group am-mt-16">
                <label className="mx-label">Cierre de negociación</label>
                <p style={{ margin: '4px 0 10px', fontSize: '0.82rem', color: 'var(--color-text-subtle)' }}>
                  Solo marcar si la negociación terminó. El estado activo se determina por las condiciones.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {[
                    { val: 'perdido',    label: 'Perdido',    sub: 'El proveedor no quiso', Icon: XCircle,       color: 'var(--color-danger)' },
                    { val: 'descartado', label: 'Descartado', sub: 'Nosotros no quisimos',  Icon: AlertTriangle, color: '#d97706' },
                  ].map(({ val, label, sub, Icon, color }) => {
                    const active = form.estadoCierre === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => onFormChange({ ...form, estadoCierre: active ? '' : val, motivoCierre: '' })}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          padding: '10px 6px', borderRadius: 12, cursor: 'pointer',
                          border: active ? `2px solid ${color}` : '1px solid var(--color-border)',
                          background: active ? `${color}14` : 'white',
                          color: active ? color : 'var(--color-text-subtle)',
                        }}
                      >
                        <Icon size={16} />
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{label}</span>
                        <span style={{ fontSize: '0.72rem', textAlign: 'center', lineHeight: 1.3 }}>{sub}</span>
                      </button>
                    );
                  })}
                </div>
                {(form.estadoCierre === 'perdido' || form.estadoCierre === 'descartado') && (
                  <div style={{ marginTop: 10 }}>
                    <label className="mx-label">
                      Motivo <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      className="mx-input"
                      value={form.motivoCierre}
                      onChange={e => onFormChange({ ...form, motivoCierre: e.target.value })}
                      placeholder={form.estadoCierre === 'perdido' ? 'Ej: No le convenció el precio' : 'Ej: Calidad del producto no cumple'}
                      required
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mx-form-group">
              <label className="mx-label">Responsable</label>
              <select
                className="mx-select"
                value={form.responsableNombre}
                onChange={e => onFormChange({ ...form, responsableNombre: e.target.value })}
              >
                <option value="">Sin asignar</option>
                {(responsables || []).map(r => (
                  <option key={r._id || r.nombre} value={r.nombre}>{r.nombre}</option>
                ))}
              </select>
            </div>

            <div className="mx-form-group">
              <label className="mx-label">Notas</label>
              <textarea
                className="mx-textarea"
                value={form.notas}
                onChange={e => onFormChange({ ...form, notas: e.target.value })}
                rows="3"
              />
            </div>
          </div>
          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mx-btn mx-btn-primary">Guardar Negociacion</button>
          </div>
        </form>
      </div>
    </div>
  );
}
