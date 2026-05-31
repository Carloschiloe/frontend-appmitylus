import { AlertTriangle, MapPin, Search, User, X } from 'lucide-react';

const COMPANY_KEYWORDS = ['spa', 's.a', 'ltda', 'limitada', 'empresa', 'sociedad', 'acuicola', 'pesquera', 'cultivos', 'acuicultura', 'cia', 'comercial', 'servicios', 'exportaciones', 'mariscos', 'alimentos', 'industria', 'cooperativa'];

function looksLikePerson(text) {
  if (!text || !text.trim()) return false;
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return false;
  const lower = text.toLowerCase();
  return !COMPANY_KEYWORDS.some((kw) => lower.includes(kw));
}

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

                  {searchProviders.trim().length > 0 && (() => {
                    const isPerson = looksLikePerson(searchProviders);
                    const slug = searchProviders.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');

                    const optContact = (
                      <button
                        key="opt-contact"
                        type="button"
                        onClick={() => onSelectProvider({
                          id: 'pending-contact',
                          proveedorNombre: searchProviders,
                          proveedorKey: '',
                          comuna: '',
                          contactoNombre: searchProviders,
                          isNew: false,
                          pendingContact: true,
                        })}
                        className="mu-opt"
                      >
                        <strong>+ Registrar contacto sin empresa: {searchProviders}</strong>
                        <span>Úsalo si aún no sabes la empresa o centro. Luego podrás asociarlo en Directorio → Contactos.</span>
                      </button>
                    );

                    const optEmpresa = (
                      <button
                        key="opt-empresa"
                        type="button"
                        onClick={() => onSelectProvider({
                          id: 'new-provider',
                          proveedorNombre: searchProviders,
                          proveedorKey: slug,
                          comuna: 'Nuevo Registro',
                          contactoNombre: 'Creado al guardar',
                          isNew: true,
                        })}
                        className="mu-opt mu-create-provider-option"
                      >
                        <strong>+ Registrar empresa nueva: {searchProviders}</strong>
                        <span>Se creará un proveedor nuevo en el directorio.</span>
                      </button>
                    );

                    const warning = isPerson ? (
                      <div key="warning" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '2px 8px 4px', padding: '8px 10px', borderRadius: 10, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                        <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                        <span style={{ color: '#92400e', fontSize: '0.8rem', lineHeight: 1.4 }}>
                          "{searchProviders}" parece un nombre de persona. Si aún no sabes la empresa, usa "Registrar contacto sin empresa".
                        </span>
                      </div>
                    ) : null;

                    return isPerson
                      ? [optContact, warning, optEmpresa]
                      : [optEmpresa, optContact];
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="mu-selected-pill">
              <div>
                <strong>{selectedProvider.proveedorNombre}</strong>
                <span>
                  {selectedProvider.pendingContact
                    ? 'Contacto pendiente — asignar empresa en Directorio'
                    : selectedProvider.isNew
                      ? 'Empresa nueva — se creará al guardar'
                      : selectedProvider.comuna}
                </span>
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
