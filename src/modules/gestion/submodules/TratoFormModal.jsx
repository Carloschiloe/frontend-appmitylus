import React from 'react';
import { Search, X } from 'lucide-react';
import { formatDateOnlySafe } from './tratos.helpers';

export default function TratoFormModal({
  isOpen,
  editingId,
  form,
  fechaTerminoEstimada,
  selectedProvider,
  providerSearch,
  loadingProviders,
  filteredProviders,
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
