import React from 'react';
import { Search, X } from 'lucide-react';
import { TIPOS_INTERACCION } from './interacciones.helpers';

export default function InteraccionFormModal({
  form,
  filteredProviders,
  loadingProviders,
  providerSearch,
  selectedProvider,
  onClose,
  onFormChange,
  onProviderSearchChange,
  onProviderSelect,
  onSubmit,
}) {
  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal interacciones-modal">
        <div className="mx-modal-header">
          <h2>{form._id ? 'Editar Gestion' : 'Registrar Nueva Gestion'}</h2>
          <button type="button" className="mx-btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="mx-form">
          <div className="mx-modal-body">
            <div className="mx-form-group">
              <label className="mx-label">Proveedor / Empresa</label>
              <div className="interacciones-provider-search">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Buscar proveedor..."
                  value={providerSearch}
                  onChange={(event) => onProviderSearchChange(event.target.value)}
                  className="interacciones-provider-search-input"
                />
              </div>
              <div className="interacciones-provider-results">
                {loadingProviders ? (
                  <div className="gs-empty-inline">Cargando proveedores...</div>
                ) : filteredProviders.length === 0 ? (
                  <div className="gs-empty-inline">No encontramos coincidencias.</div>
                ) : (
                  filteredProviders.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onProviderSelect(item)}
                      className={`interacciones-provider-option ${selectedProvider?.id === item.id ? 'is-selected' : ''}`}
                    >
                      <strong>{item.proveedorNombre}</strong>
                      <span>{item.comuna || 'Sin comuna'}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="mx-form-row interacciones-form-row">
              <div className="mx-form-group interacciones-form-row-item">
                <label className="mx-label">Tipo de Gestion</label>
                <select
                  className="mx-select"
                  value={form.tipo}
                  onChange={(event) => onFormChange({ ...form, tipo: event.target.value })}
                >
                  {TIPOS_INTERACCION.map((tipo) => (
                    <option key={tipo.val} value={tipo.val}>{tipo.label}</option>
                  ))}
                </select>
              </div>
              <div className="mx-form-group interacciones-form-row-item">
                <label className="mx-label">Fecha</label>
                <input
                  type="date"
                  className="mx-input"
                  value={form.fecha}
                  onChange={(event) => onFormChange({ ...form, fecha: event.target.value })}
                />
              </div>
            </div>
            <div className="mx-form-group">
              <label className="mx-label">Resumen Ejecutivo</label>
              <input
                className="mx-input"
                value={form.resumen}
                onChange={(event) => onFormChange({ ...form, resumen: event.target.value })}
                placeholder="Ej: Llamada de seguimiento de precio"
                required
              />
            </div>
            <div className="mx-form-group">
              <label className="mx-label">Detalle y Compromisos</label>
              <textarea
                className="mx-textarea"
                value={form.notas}
                onChange={(event) => onFormChange({ ...form, notas: event.target.value })}
                rows="4"
              />
            </div>
          </div>
          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mx-btn mx-btn-primary">{form._id ? 'Guardar cambios' : 'Guardar Gestion'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
