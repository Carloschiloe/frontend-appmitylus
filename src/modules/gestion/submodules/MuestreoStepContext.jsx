import { MapPin, Search, User, X } from 'lucide-react';

export default function MuestreoStepContext({
  form,
  setForm,
  selectedProvider,
  onClearProvider,
  searchProviders,
  onSearchProvidersChange,
  filteredProviders,
  onSelectProvider,
  providerCenters,
}) {
  return (
    <div className="mu-step-container mu-context-step">
      <div className="mx-form-row">
        <div className="mx-form-group mu-flex-1">
          <label className="mx-label"><User size={14} /> 1. Proveedor</label>
          {!selectedProvider ? (
            <div className="mx-search-box">
              <Search size={16} />
              <input
                className="mx-input"
                placeholder="Buscar proveedor..."
                value={searchProviders}
                onChange={(event) => onSearchProvidersChange(event.target.value)}
              />
              {(filteredProviders.length > 0 || searchProviders.trim().length > 0) && (
                <div className="mu-dropdown shadow-lg">
                  {filteredProviders.map((provider) => (
                    <button key={provider.id} type="button" onClick={() => onSelectProvider(provider)} className="mu-opt">
                      <strong>{provider.proveedorNombre}</strong>
                      <span>{provider.comuna} - {provider.contactoNombre}</span>
                    </button>
                  ))}
                  {searchProviders.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => onSelectProvider({
                        id: 'new-provider',
                        proveedorNombre: searchProviders,
                        proveedorKey: searchProviders.trim().toLowerCase().replace(/[^a-z0-9]/g, '-'),
                        comuna: 'Nuevo Registro',
                        contactoNombre: 'Creado al guardar',
                        isNew: true,
                      })}
                      className="mu-opt mu-create-provider-option"
                    >
                      <strong>+ Crear proveedor: {searchProviders}</strong>
                      <span>Registrar automaticamente en el directorio</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mu-selected-pill">
              <div>
                <strong>{selectedProvider.proveedorNombre}</strong>
                <span>{selectedProvider.comuna}</span>
              </div>
              <button type="button" className="mx-btn-icon" onClick={onClearProvider}><X size={14} /></button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-form-row am-mt-16">
        <div className="mx-form-group mu-flex-1-5">
          <label className="mx-label"><MapPin size={14} /> 2. Centro</label>
          <select
            className="mx-select"
            value={form.centroId}
            onChange={(event) => {
              const centro = providerCenters.find((item) => item._id === event.target.value);
              setForm((prev) => ({ ...prev, centroId: event.target.value, centroCodigo: centro?.code || '' }));
            }}
            disabled={!selectedProvider}
          >
            <option value="">Selecciona centro...</option>
            {providerCenters.map((centro) => <option key={centro._id} value={centro._id}>{centro.code} - {centro.comuna}</option>)}
          </select>
        </div>
        <div className="mx-form-group mu-flex-1">
          <label className="mx-label">Linea</label>
          <input className="mx-input" placeholder="N" value={form.linea} onChange={(event) => setForm({ ...form, linea: event.target.value })} />
        </div>
      </div>

      <div className="mx-form-row am-mt-16">
        <div className="mx-form-group mu-flex-1">
          <label className="mx-label">Fecha</label>
          <input type="date" className="mx-input" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} />
        </div>
        <div className="mx-form-group mu-flex-1-5">
          <label className="mx-label">Responsable</label>
          <input className="mx-input" value={form.responsable} onChange={(event) => setForm({ ...form, responsable: event.target.value })} />
        </div>
      </div>
    </div>
  );
}
