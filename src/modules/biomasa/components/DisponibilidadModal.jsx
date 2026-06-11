import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search, UserRound, X } from 'lucide-react';
import {
  DISPONIBILIDAD_ESTADOS,
  DISPONIBILIDAD_ORIGENES,
  DISPONIBILIDAD_PRODUCTOS,
  filterDisponibilidadContacts,
  filterDisponibilidadProviders,
  hasDisponibilidadIdentity,
} from '../disponibilidad.constants';

const EMPTY_FORM = {
  contactoId: '',
  contactoNombre: '',
  contactoTelefono: '',
  contactoEmail: '',
  proveedorKey: '',
  proveedorNombre: '',
  centroId: '',
  mesKey: '',
  tonsDisponible: '',
  producto: 'sin_definir',
  estado: 'disponible',
  origen: 'llamada',
  observacion: '',
  motivo: '',
};

const getCenterCode = (item) => item.codigo || item.centroCodigo || item.code || item.nombre || '';

export default function DisponibilidadModal({
  open,
  item,
  proveedores,
  contactos,
  defaultMes,
  responsableNombre,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [providerSearch, setProviderSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(item ? {
      contactoId: String(item.contactoId || ''),
      contactoNombre: item.contactoNombre || '',
      contactoTelefono: item.contactoTelefono || item.contactoSnapshot?.telefono || '',
      contactoEmail: item.contactoEmail || item.contactoSnapshot?.email || '',
      proveedorKey: item.proveedorKey || item.empresaKey || '',
      proveedorNombre: item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || '',
      centroId: String(item.centroId || ''),
      mesKey: item.mesKey || defaultMes,
      tonsDisponible: item.tons ?? item.tonsDisponible ?? '',
      producto: item.producto || 'sin_definir',
      estado: item.estado || 'disponible',
      origen: item.origen || 'otro',
      observacion: item.observacion || '',
      motivo: item.motivo || '',
    } : { ...EMPTY_FORM, mesKey: defaultMes });
    setProviderSearch(item?.proveedorNombreNorm || item?.proveedorNombre || item?.empresaNombre || '');
    setContactSearch(item?.contactoNombre || '');
    setValidationError('');
  }, [defaultMes, item, open]);

  const selectedProvider = useMemo(
    () => proveedores.find((provider) => form.proveedorKey && provider.proveedorKey === String(form.proveedorKey).toLowerCase()),
    [form.proveedorKey, proveedores]
  );
  const filteredProviders = useMemo(
    () => filterDisponibilidadProviders(proveedores, providerSearch),
    [providerSearch, proveedores]
  );
  const filteredContacts = useMemo(
    () => filterDisponibilidadContacts(contactos, contactSearch),
    [contactSearch, contactos]
  );

  const centerOptions = selectedProvider?.centros || [];
  const selectedCenter = centerOptions.find((center) => String(center._id) === form.centroId);
  const showProviderResults = providerSearch.trim() && providerSearch.trim() !== form.proveedorNombre;
  const showContactResults = contactSearch.trim() && contactSearch.trim() !== form.contactoNombre;

  if (!open) return null;

  const update = (field, value) => setForm((current) => ({
    ...current,
    [field]: value,
    ...((field === 'estado' && !['perdido', 'descartado'].includes(value)) ? { motivo: '' } : {}),
  }));

  const clearProvider = () => {
    setProviderSearch('');
    setForm((current) => ({ ...current, proveedorKey: '', proveedorNombre: '', centroId: '' }));
  };

  const selectProvider = (provider) => {
    setProviderSearch(provider.proveedorNombre);
    setForm((current) => ({
      ...current,
      proveedorKey: provider.proveedorKey,
      proveedorNombre: provider.proveedorNombre,
      centroId: '',
    }));
    setValidationError('');
  };

  const clearContact = () => {
    setContactSearch('');
    setForm((current) => ({ ...current, contactoId: '', contactoNombre: '', contactoTelefono: '', contactoEmail: '' }));
  };

  const selectContact = (contact) => {
    setContactSearch(contact.contactoNombre);
    setForm((current) => ({
      ...current,
      contactoId: contact.contactoId,
      contactoNombre: contact.contactoNombre,
      contactoTelefono: contact.contactoTelefono,
      contactoEmail: contact.contactoEmail,
    }));
    setValidationError('');
  };

  const submit = (event) => {
    event.preventDefault();
    if (!hasDisponibilidadIdentity(form)) {
      setValidationError('Debes seleccionar un proveedor o contacto.');
      return;
    }
    onSave({
      ...form,
      estado: item ? form.estado : 'disponible',
      empresaKey: form.proveedorKey,
      empresaNombre: form.proveedorNombre,
      centroCodigo: selectedCenter ? getCenterCode(selectedCenter) : (form.centroId ? item?.centroCodigo || '' : ''),
      comuna: selectedCenter?.comuna || (form.centroId ? item?.comuna || '' : ''),
      areaCodigo: selectedCenter?.areaCodigo || selectedCenter?.area || (form.centroId ? item?.areaCodigo || '' : ''),
      tonsDisponible: Number(form.tonsDisponible),
    });
  };

  return (
    <div className="mx-modal-overlay disponibilidad-modal-overlay" onClick={onClose}>
      <div className="mx-modal disponibilidad-modal" onClick={(event) => event.stopPropagation()}>
        <div className="mx-modal-header">
          <div>
            <h3 className="mx-modal-title">{item ? 'Editar disponibilidad' : 'Registrar disponibilidad'}</h3>
            <p className="disponibilidad-modal-subtitle">Registra biomasa futura informada por un proveedor, contacto o ambos.</p>
          </div>
          <button type="button" className="mx-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form className="mx-form" onSubmit={submit}>
          <div className="mx-modal-body disponibilidad-form-grid">
            <div className="mx-form-group disponibilidad-field-wide">
              <span className="mx-form-label">Proveedor opcional</span>
              <div className="disponibilidad-provider-search">
                <Search size={18} />
                <input
                  value={providerSearch}
                  onChange={(event) => {
                    setProviderSearch(event.target.value);
                    if (form.proveedorNombre && event.target.value.trim() !== form.proveedorNombre) {
                      setForm((current) => ({ ...current, proveedorKey: '', proveedorNombre: '', centroId: '' }));
                    }
                  }}
                  placeholder="Buscar empresa o comuna..."
                />
                {form.proveedorNombre && <button type="button" className="disponibilidad-search-clear" onClick={clearProvider} aria-label="Quitar proveedor"><X size={15} /></button>}
              </div>
              {showProviderResults && (
                <div className="disponibilidad-provider-results">
                  {filteredProviders.length === 0 ? (
                    <div className="disponibilidad-inline-empty">No encontramos proveedores.</div>
                  ) : filteredProviders.map((provider) => (
                    <button key={provider.id} type="button" className="disponibilidad-provider-option" onClick={() => selectProvider(provider)}>
                      <strong>{provider.proveedorNombre}</strong>
                      <span>{provider.comuna || 'Sin comuna'} · {provider.centros.length} centro{provider.centros.length === 1 ? '' : 's'}</span>
                    </button>
                  ))}
                </div>
              )}
              {form.proveedorNombre && (
                <div className="disponibilidad-provider-selected"><CheckCircle2 size={16} /><span><strong>{form.proveedorNombre}</strong> seleccionado</span></div>
              )}
            </div>

            <div className="mx-form-group disponibilidad-field-wide">
              <span className="mx-form-label">Contacto opcional</span>
              <div className="disponibilidad-provider-search">
                <Search size={18} />
                <input
                  value={contactSearch}
                  onChange={(event) => {
                    setContactSearch(event.target.value);
                    if (form.contactoNombre && event.target.value.trim() !== form.contactoNombre) {
                      setForm((current) => ({ ...current, contactoId: '', contactoNombre: '', contactoTelefono: '', contactoEmail: '' }));
                    }
                  }}
                  placeholder="Buscar nombre, teléfono, email o empresa..."
                />
                {form.contactoNombre && <button type="button" className="disponibilidad-search-clear" onClick={clearContact} aria-label="Quitar contacto"><X size={15} /></button>}
              </div>
              {showContactResults && (
                <div className="disponibilidad-provider-results">
                  {filteredContacts.length === 0 ? (
                    <div className="disponibilidad-inline-empty">No encontramos contactos.</div>
                  ) : filteredContacts.map((contact) => (
                    <button key={contact.id} type="button" className="disponibilidad-provider-option" onClick={() => selectContact(contact)}>
                      <strong>{contact.contactoNombre}</strong>
                      <span>{contact.contactoTelefono || contact.contactoEmail || 'Sin teléfono ni email'}{contact.proveedorNombre ? ` · ${contact.proveedorNombre}` : ' · Sin proveedor'}</span>
                    </button>
                  ))}
                </div>
              )}
              {form.contactoNombre && (
                <div className="disponibilidad-contact-selected">
                  <UserRound size={16} />
                  <span><strong>{form.contactoNombre}</strong>{form.contactoTelefono || form.contactoEmail ? ` · ${form.contactoTelefono || form.contactoEmail}` : ''}</span>
                </div>
              )}
            </div>

            {validationError && <div className="disponibilidad-form-error disponibilidad-field-wide">{validationError}</div>}

            <label className="mx-form-group">
              <span className="mx-form-label">Centro opcional</span>
              <select className="mx-select" value={form.centroId} onChange={(event) => update('centroId', event.target.value)} disabled={!selectedProvider}>
                <option value="">{selectedProvider ? 'Sin centro' : 'Selecciona proveedor primero'}</option>
                {centerOptions.map((center) => <option key={center._id} value={center._id}>{getCenterCode(center)}</option>)}
              </select>
            </label>

            <div className="mx-form-group">
              <span className="mx-form-label">Responsable</span>
              <div className="disponibilidad-readonly-field"><UserRound size={16} /><strong>{item?.responsable || responsableNombre || 'Sin asignar'}</strong></div>
            </div>

            <label className="mx-form-group">
              <span className="mx-form-label">Mes/Año disponible</span>
              <input className="mx-input" type="month" value={form.mesKey} onChange={(event) => update('mesKey', event.target.value)} required />
            </label>

            <label className="mx-form-group">
              <span className="mx-form-label">Toneladas</span>
              <input className="mx-input" type="number" min="0.01" step="0.01" value={form.tonsDisponible} onChange={(event) => update('tonsDisponible', event.target.value)} required />
            </label>

            <label className="mx-form-group">
              <span className="mx-form-label">Producto</span>
              <select className="mx-select" value={form.producto} onChange={(event) => update('producto', event.target.value)}>
                {DISPONIBILIDAD_PRODUCTOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            {item ? (
              <label className="mx-form-group">
                <span className="mx-form-label">Estado</span>
                <select className="mx-select" value={form.estado} onChange={(event) => update('estado', event.target.value)}>
                  {DISPONIBILIDAD_ESTADOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            ) : (
              <div className="mx-form-group">
                <span className="mx-form-label">Estado inicial</span>
                <div className="disponibilidad-initial-state"><CheckCircle2 size={16} /> Disponible</div>
              </div>
            )}

            <label className="mx-form-group">
              <span className="mx-form-label">Origen</span>
              <select className="mx-select" value={form.origen} onChange={(event) => update('origen', event.target.value)}>
                {DISPONIBILIDAD_ORIGENES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="mx-form-group disponibilidad-field-wide">
              <span className="mx-form-label">Observación</span>
              <textarea className="mx-input" rows={3} value={form.observacion} onChange={(event) => update('observacion', event.target.value)} placeholder="Información relevante entregada por el proveedor o contacto" />
            </label>

            {['perdido', 'descartado'].includes(form.estado) && (
              <label className="mx-form-group disponibilidad-field-wide">
                <span className="mx-form-label">Motivo</span>
                <textarea className="mx-input" rows={2} value={form.motivo} onChange={(event) => update('motivo', event.target.value)} required placeholder="Indica por qué se perdió o descartó" />
              </label>
            )}
          </div>
          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mx-btn mx-btn-primary" disabled={saving}>{saving ? 'Guardando...' : item ? 'Guardar cambios' : 'Registrar disponibilidad'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
