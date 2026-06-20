import React, { useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { formatDateOnlySafe, isCondicionCamionesDia, normalizeText } from './tratos.helpers';

export default function TratoFormModal({
  isOpen,
  editingId,
  form,
  fechaTerminoEstimada,
  selectedProvider,
  providerSearch,
  loadingProviders,
  filteredProviders,
  tiposTransporte,
  centrosProveedor,
  loadingCentros,
  onClose,
  onSubmit,
  onFormChange,
  onProviderSearchChange,
  onClearSelectedProvider,
  onSelectProvider,
  onTransporteChange,
  onConditionModeChange,
  onConditionValueChange,
  onConditionStatusChange,
}) {
  useEffect(() => {
    if (!isOpen || !tiposTransporte || !tiposTransporte.length || form.transporteTrato) return;

    const cCamiones = form.condiciones.find(c => isCondicionCamionesDia(c.nombre));
    if (!cCamiones) return;

    const tSimple = tiposTransporte.find(t => normalizeText(t.nombre || t.label).includes('simple')) || tiposTransporte[0];
    if (tSimple) {
      onTransporteChange({
        tipoTransporteId: tSimple._id || tSimple.id,
        nombre: tSimple.nombre || tSimple.label,
        cantidadDiaria: cCamiones.valor ? Number(cCamiones.valor) : null,
        maxisPorUnidad: tSimple.maxisPorUnidad,
        kgPorMaxiRef: tSimple.kgPorMaxiRef,
        capacidadToneladas: tSimple.totalRef || (tSimple.maxisPorUnidad && tSimple.kgPorMaxiRef ? (tSimple.maxisPorUnidad * tSimple.kgPorMaxiRef) / 1000 : 11),
      });
    }
  }, [isOpen, tiposTransporte, form.condiciones, form.transporteTrato, onTransporteChange]);

  if (!isOpen) return null;

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

            <div className="mx-form-group" style={{ marginTop: 10 }}>
              <label className="mx-label">Centro de cultivo</label>
              <select
                className="mx-select"
                value={form.centroCodigo || ''}
                onChange={e => onFormChange({ ...form, centroCodigo: e.target.value })}
                disabled={loadingCentros}
              >
                <option value="">— Sin centro específico —</option>
                {(centrosProveedor || []).map(c => (
                  <option key={c._id} value={c.code}>
                    {c.code}{c.areaPSMB ? ` · ${c.areaPSMB}` : ''}{c.comuna ? ` (${c.comuna})` : ''}
                  </option>
                ))}
              </select>
              {loadingCentros && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>Cargando centros...</span>}
            </div>

            <div className="tratos-form-row" style={{ marginTop: 10 }}>
              <div className="tratos-form-row-item">
                <label className="mx-label">Tons acordadas</label>
                <input
                  type="number"
                  step="1"
                  className="mx-input"
                  value={form.tonsAcordadas}
                  onChange={e => onFormChange({ ...form, tonsAcordadas: e.target.value })}
                />
              </div>
              <div className="tratos-form-row-item">
                <label className="mx-label">Inicio probable cosecha</label>
                <input
                  type="date"
                  className="mx-input"
                  value={form.fechaInicioCosecha}
                  onChange={e => onFormChange({ ...form, fechaInicioCosecha: e.target.value })}
                />
              </div>
            </div>

            <div className="tratos-form-row" style={{ marginTop: 10 }}>
              <div className="tratos-form-row-item">
                <label className="mx-label">Término estimado</label>
                <div className="tratos-readonly-field">
                  {fechaTerminoEstimada ? formatDateOnlySafe(fechaTerminoEstimada) : 'Pendiente'}
                </div>
              </div>
              <div className="tratos-form-row-item">
                <label className="mx-label">Responsable</label>
                <div className="tratos-readonly-field">
                  {form.responsableNombre || 'Se asignara al guardar'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className="mx-label am-mb-8 tratos-conditions-title">
                Condiciones de Negociacion
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
                        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                          {isCondicionCamionesDia(c.nombre) && tiposTransporte && (
                            <select
                              className="mx-input tratos-condition-control"
                              style={{ flex: 1, minWidth: 140 }}
                              value={form.transporteTrato?.tipoTransporteId || ''}
                              onChange={(e) => {
                                const selected = tiposTransporte.find(t => t._id === e.target.value || t.id === e.target.value);
                                if (selected) {
                                  onTransporteChange({
                                    tipoTransporteId: selected._id || selected.id,
                                    nombre: selected.nombre || selected.label,
                                    cantidadDiaria: c.valor ? Number(c.valor) : null,
                                    maxisPorUnidad: selected.maxisPorUnidad,
                                    kgPorMaxiRef: selected.kgPorMaxiRef,
                                    capacidadToneladas: selected.totalRef || (selected.maxisPorUnidad && selected.kgPorMaxiRef ? (selected.maxisPorUnidad * selected.kgPorMaxiRef) / 1000 : 11),
                                  });
                                } else {
                                  onTransporteChange(null);
                                }
                              }}
                            >
                              {(!tiposTransporte || tiposTransporte.length === 0) ? (
                                <option value="">Camion Simple (11 t)</option>
                              ) : (
                                tiposTransporte.map(t => {
                                  const cap = t.totalRef || (t.maxisPorUnidad && t.kgPorMaxiRef ? (t.maxisPorUnidad * t.kgPorMaxiRef) / 1000 : null);
                                  const labelCap = cap ? ` (${cap} t)` : '';
                                  return (
                                    <option key={t._id || t.id} value={t._id || t.id}>
                                      {t.nombre || t.label}{labelCap}
                                    </option>
                                  );
                                })
                              )}
                            </select>
                          )}
                          <input
                            type={['numero', 'moneda', 'porcentaje', 'dias'].includes(c.tipoValor) ? 'number' : 'text'}
                            className="mx-input tratos-condition-control tratos-condition-value"
                            style={{ flex: isCondicionCamionesDia(c.nombre) ? '0 0 80px' : 1 }}
                            placeholder={c.tipoValor === 'moneda' ? '$ Valor' : c.tipoValor === 'porcentaje' ? '% Valor' : 'Valor'}
                            value={c.valor || ''}
                            onChange={(e) => {
                              onConditionValueChange(idx, e.target.value);
                              if (isCondicionCamionesDia(c.nombre) && form.transporteTrato) {
                                onTransporteChange({
                                  ...form.transporteTrato,
                                  cantidadDiaria: e.target.value ? Number(e.target.value) : null,
                                });
                              }
                            }}
                          />
                        </div>
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

            {form.condiciones.length > 0 && (() => {
              const acordadas = form.condiciones.filter(c => c.estado === 'acordado').length;
              const pendientes = form.condiciones.filter(c => c.estado === 'pendiente').length;
              const rechazadas = form.condiciones.filter(c => c.estado === 'rechazado').length;
              const total = form.condiciones.length;
              const todasAcordadas = acordadas === total;
              return (
                <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 10, background: todasAcordadas ? '#f0fdf4' : '#fffbeb', border: `1px solid ${todasAcordadas ? '#bbf7d0' : '#fde68a'}`, display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                  {todasAcordadas ? (
                    <span style={{ color: '#166534', fontWeight: 600 }}>Todas las condiciones acordadas - al guardar el trato pasara a Acordado.</span>
                  ) : (
                    <>
                      {pendientes > 0 && <span style={{ color: '#92400e', fontWeight: 600 }}>{pendientes} pendiente{pendientes > 1 ? 's' : ''}</span>}
                      {rechazadas > 0 && <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{rechazadas} rechazada{rechazadas > 1 ? 's' : ''}</span>}
                      {acordadas > 0 && <span style={{ color: 'var(--color-success)' }}>{acordadas} acordada{acordadas > 1 ? 's' : ''}</span>}
                      <span style={{ marginLeft: 'auto', color: '#92400e' }}>Se guardara como Pendiente hasta acordar todas.</span>
                    </>
                  )}
                </div>
              );
            })()}

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
            <button type="submit" className="mx-btn mx-btn-primary">Guardar Trato</button>
          </div>
        </form>
      </div>
    </div>
  );
}
