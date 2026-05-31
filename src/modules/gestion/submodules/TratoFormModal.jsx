import React, { useState, useEffect } from 'react';
import { Search, X, AlertTriangle, XCircle } from 'lucide-react';

export default function TratoFormModal({
  isOpen,
  editingId,
  form,
  selectedProvider,
  providerSearch,
  loadingProviders,
  filteredProviders,
  responsables,
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
  const [activeTab, setActiveTab] = useState('acuerdo');

  useEffect(() => {
    if (isOpen) setActiveTab('acuerdo');
  }, [isOpen]);

  if (!isOpen) return null;

  const TABS = [
    { key: 'acuerdo',  label: 'Acuerdo' },
    { key: 'gestion',  label: 'Gestión' },
  ];

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal tratos-form-modal">
        <div className="mx-modal-header">
          <h2>{editingId ? 'Editar Negociación' : 'Nueva Negociación'}</h2>
          <button type="button" className="mx-btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={onSubmit} className="mx-form">
          <div className="mx-modal-body">

            {/* ── Proveedor (siempre visible) ── */}
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

            {/* ── Tabs ── */}
            <div className="mx-toggle-group" style={{ marginTop: 10, marginBottom: 2 }}>
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={`mx-toggle-btn${activeTab === tab.key ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Acuerdo ── */}
            {activeTab === 'acuerdo' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div className="mx-form-group" style={{ margin: 0 }}>
                    <label className="mx-label">Tons Acordadas</label>
                    <input
                      type="number"
                      step="1"
                      className="mx-input"
                      value={form.tonsAcordadas}
                      onChange={e => onFormChange({ ...form, tonsAcordadas: e.target.value })}
                    />
                  </div>
                  <div className="mx-form-group" style={{ margin: 0 }}>
                    <label className="mx-label">Inicio probable cosecha</label>
                    <input
                      type="date"
                      className="mx-input"
                      value={form.fechaInicioCosecha}
                      onChange={e => onFormChange({ ...form, fechaInicioCosecha: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label className="mx-label am-mb-8 tratos-conditions-title">
                    Condiciones de Negociación
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
                  const acordadas      = form.condiciones.filter(c => c.estado === 'acordado').length;
                  const pendientes     = form.condiciones.filter(c => c.estado === 'pendiente').length;
                  const rechazadas     = form.condiciones.filter(c => c.estado === 'rechazado').length;
                  const total          = form.condiciones.length;
                  const todasAcordadas = acordadas === total;
                  return (
                    <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 10, background: todasAcordadas ? '#f0fdf4' : '#fffbeb', border: `1px solid ${todasAcordadas ? '#bbf7d0' : '#fde68a'}`, display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                      {todasAcordadas ? (
                        <span style={{ color: '#166534', fontWeight: 600 }}>✓ Todas las condiciones acordadas — al guardar el trato pasará a Acordado.</span>
                      ) : (
                        <>
                          {pendientes > 0 && <span style={{ color: '#92400e', fontWeight: 600 }}>⚠ {pendientes} pendiente{pendientes > 1 ? 's' : ''}</span>}
                          {rechazadas > 0 && <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>✕ {rechazadas} rechazada{rechazadas > 1 ? 's' : ''}</span>}
                          {acordadas > 0 && <span style={{ color: 'var(--color-success)' }}>✓ {acordadas} acordada{acordadas > 1 ? 's' : ''}</span>}
                          <span style={{ marginLeft: 'auto', color: '#92400e' }}>Se guardará como Pendiente hasta acordar todas.</span>
                        </>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {/* ── Tab: Gestión ── */}
            {activeTab === 'gestion' && (
              <>
                <div className="mx-form-group am-mt-16">
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

                {editingId && (
                  <div className="mx-form-group am-mt-16">
                    <label className="mx-label">Estado de negociación</label>
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
              </>
            )}

          </div>
          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mx-btn mx-btn-primary">Guardar Negociación</button>
          </div>
        </form>
      </div>
    </div>
  );
}
