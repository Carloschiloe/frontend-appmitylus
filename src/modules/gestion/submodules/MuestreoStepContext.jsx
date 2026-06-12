import { AlertTriangle, MapPin, Search, User, X } from 'lucide-react';

const COMPANY_KEYWORDS = ['spa', 's.a', 'ltda', 'limitada', 'empresa', 'sociedad', 'acuicola', 'pesquera', 'cultivos', 'acuicultura', 'cia', 'comercial', 'servicios', 'exportaciones', 'mariscos', 'alimentos', 'industria', 'cooperativa'];

function looksLikePerson(text) {
  if (!text || !text.trim()) return false;
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return false;
  const lower = text.toLowerCase();
  return !COMPANY_KEYWORDS.some((kw) => lower.includes(kw));
}

function buildContactSelection(contact) {
  return {
    isContact: true,
    tipoSeleccion: 'contacto',
    contactoId: contact._id || '',
    nombre: contact.nombre || contact.contactoNombre || '',
    contactoNombre: contact.contactoNombre || contact.nombre || '',
    contactoEmail: contact.contactoEmail || '',
    contactoTelefono: contact.contactoTelefono || '',
    proveedorNombre: contact.proveedorNombre || '',
    proveedorKey: contact.proveedorKey || '',
    providerPending: !contact.proveedorKey,
    id: contact._id || `contact-${contact.nombre}`,
  };
}

function buildProviderSubtitle(provider) {
  const parts = [];

  if (provider.matchedContacts && provider.matchedContacts.length > 0) {
    const names = provider.matchedContacts
      .slice(0, 2)
      .map((c) => c.nombre || c.contactoNombre)
      .filter(Boolean);
    if (names.length === 1) parts.push(`Contacto: ${names[0]}`);
    else if (names.length > 1) parts.push(`Contactos: ${names.join(', ')}`);
  } else if (provider.contactoNombre) {
    parts.push(provider.contactoNombre);
  }

  if (provider.comuna) parts.push(provider.comuna);
  if (provider.centros) parts.push(`${provider.centros} ${provider.centros === 1 ? 'centro' : 'centros'}`);

  return parts.join(' · ');
}

function buildContactSubtitle(contact) {
  const detail = contact.contactoEmail || contact.contactoTelefono;
  const empresa = contact.proveedorNombre;
  if (!empresa) {
    return ['Sin empresa asignada', detail].filter(Boolean).join(' · ');
  }
  return [`Contacto de ${empresa}`, detail].filter(Boolean).join(' · ');
}

export default function MuestreoStepContext({
  form,
  setForm,
  selectedProvider,
  onClearProvider,
  searchProviders,
  onSearchProvidersChange,
  filteredProviders,
  filteredContacts,
  onSelectProvider,
  providerCenters,
}) {
  const hasProviderResults = filteredProviders.length > 0;
  const hasContactResults = (filteredContacts || []).length > 0;
  const hasSearch = searchProviders.trim().length > 0;
  const showDropdown = hasProviderResults || hasContactResults || hasSearch;

  return (
    <div className="mu-step-container mu-context-step">
      <div className="mx-form-row">
        <div className="mx-form-group mu-flex-1 mu-search-field">
          <label className="mx-label"><User size={14} /> 1. Proveedor o Contacto</label>
          {!selectedProvider ? (
            <div className="mx-search-box">
              <Search size={16} />
              <input
                className="mx-input"
                placeholder="Buscar empresa, proveedor o persona..."
                value={searchProviders}
                onChange={(event) => onSearchProvidersChange(event.target.value)}
              />
              {showDropdown && (
                <div className="mu-search-dropdown">

                  {hasProviderResults && (
                    <>
                      <div className="mu-search-section-title">Empresas / Proveedores</div>
                      {filteredProviders.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          className="mu-search-option"
                          onClick={() => onSelectProvider(provider)}
                        >
                          <span className="mu-search-option-title">{provider.proveedorNombre}</span>
                          <span className="mu-search-option-subtitle">
                            {buildProviderSubtitle(provider)}
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {hasContactResults && (
                    <>
                      {hasProviderResults && <div className="mu-search-section-divider" />}
                      <div className="mu-search-section-title">Contactos conocidos</div>
                      {(filteredContacts || []).map((contact) => (
                        <button
                          key={contact._id || contact.nombre}
                          type="button"
                          className="mu-search-option"
                          onClick={() => onSelectProvider(buildContactSelection(contact))}
                        >
                          <span className="mu-search-option-title">
                            {contact.nombre || contact.contactoNombre}
                          </span>
                          <span className="mu-search-option-subtitle">
                            {buildContactSubtitle(contact)}
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {hasSearch && (() => {
                    const isPerson = looksLikePerson(searchProviders);
                    const slug = searchProviders.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
                    const hasAnyResult = hasProviderResults || hasContactResults;

                    const divider = hasAnyResult
                      ? <div key="divider" className="mu-search-section-divider" />
                      : null;

                    const sectionTitle = (
                      <div key="section-new" className="mu-search-section-title">
                        {hasAnyResult ? '¿No es ninguno de estos?' : 'No está en la lista'}
                      </div>
                    );

                    const optContact = (
                      <button
                        key="opt-contact"
                        type="button"
                        className="mu-search-option is-action"
                        onClick={() => onSelectProvider({
                          id: 'new-contact',
                          proveedorNombre: searchProviders,
                          proveedorKey: '',
                          isNew: false,
                          pendingContact: true,
                          tipoSeleccion: 'contacto',
                        })}
                      >
                        <span className="mu-search-option-title">
                          + Registrar contacto nuevo: {searchProviders}
                        </span>
                        <span className="mu-search-option-subtitle">
                          Se guardará como contacto. Luego podrás asignarle empresa y centro en Directorio → Contactos.
                        </span>
                      </button>
                    );

                    const warning = isPerson ? (
                      <div key="warning" className="mu-search-option-warning">
                        <AlertTriangle size={14} />
                        <span>
                          &quot;{searchProviders}&quot; parece un nombre de persona. Si es un contacto, usa &quot;Registrar contacto nuevo&quot;.
                        </span>
                      </div>
                    ) : null;

                    const optEmpresa = (
                      <button
                        key="opt-empresa"
                        type="button"
                        className="mu-search-option is-action"
                        onClick={() => onSelectProvider({
                          id: 'new-provider',
                          proveedorNombre: searchProviders,
                          proveedorKey: slug,
                          isNew: true,
                        })}
                      >
                        <span className="mu-search-option-title">
                          + Registrar empresa/proveedor nueva: {searchProviders}
                        </span>
                        <span className="mu-search-option-subtitle">
                          Se creará una empresa/proveedor nueva en el directorio.
                        </span>
                      </button>
                    );

                    return isPerson
                      ? [divider, sectionTitle, optContact, warning, optEmpresa]
                      : [divider, sectionTitle, optEmpresa, optContact];
                  })()}

                </div>
              )}
            </div>
          ) : (
            <div className="mu-selected-pill">
              <div>
                <strong>
                  {selectedProvider.isContact
                    ? (selectedProvider.contactoNombre || selectedProvider.nombre || selectedProvider.proveedorNombre)
                    : selectedProvider.proveedorNombre}
                </strong>
                <span>
                  {selectedProvider.isContact
                    ? (selectedProvider.providerPending ? 'Sin empresa asignada' : selectedProvider.proveedorNombre)
                    : selectedProvider.pendingContact
                      ? 'Contacto nuevo — asignar empresa después'
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
            {providerCenters.map((centro) => (
              <option key={centro._id} value={centro._id}>{centro.code} - {centro.comuna}</option>
            ))}
          </select>
        </div>
        <div className="mx-form-group mu-flex-1">
          <label className="mx-label">Linea</label>
          <input
            className="mx-input"
            placeholder="N"
            value={form.linea}
            onChange={(event) => setForm({ ...form, linea: event.target.value })}
          />
        </div>
      </div>

      <div className="mx-form-row am-mt-16">
        <div className="mx-form-group mu-flex-1">
          <label className="mx-label">Fecha</label>
          <input
            type="date"
            className="mx-input"
            value={form.fecha}
            onChange={(event) => setForm({ ...form, fecha: event.target.value })}
          />
        </div>
        <div className="mx-form-group mu-flex-1-5">
          <label className="mx-label">Responsable</label>
          <input
            className="mx-input"
            value={form.responsable}
            onChange={(event) => setForm({ ...form, responsable: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
