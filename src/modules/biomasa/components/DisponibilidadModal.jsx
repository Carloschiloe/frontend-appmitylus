import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Minus, Plus, Search, UserRound, X } from 'lucide-react';
import {
  DISPONIBILIDAD_ESTADOS,
  DISPONIBILIDAD_ORIGENES,
  DISPONIBILIDAD_PRODUCTOS,
  filterDisponibilidadContacts,
  filterDisponibilidadProviders,
  hasDisponibilidadIdentity,
} from '../disponibilidad.constants';

const CALIBRE_MIN_OPTIONS = [40, 45, 50, 55, 60, 65, 70, 75, 80];
const CALIBRE_MAX_OPTIONS = [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];

const EMPTY_FORM = {
  contactoId: '',
  contactoNombre: '',
  contactoTelefono: '',
  contactoEmail: '',
  proveedorKey: '',
  proveedorNombre: '',
  centroId: '',
  // Usado solo en modo edición (un registro):
  mesKey: '',
  tonsDisponible: '',
  // Usado en modo creación (múltiples meses):
  mesesRows: [{ mesKey: '', tonsDisponible: '' }],
  calibreMin: '',
  calibreMax: '',
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
      mesesRows: [{ mesKey: item.mesKey || defaultMes, tonsDisponible: String(item.tons ?? item.tonsDisponible ?? '') }],
      calibreMin: String(item.calibreMin ?? ''),
      calibreMax: String(item.calibreMax ?? ''),
      producto: item.producto || 'sin_definir',
      estado: item.estado || 'disponible',
      origen: item.origen || 'otro',
      observacion: item.observacion || '',
      motivo: item.motivo || '',
    } : { ...EMPTY_FORM, mesesRows: [{ mesKey: defaultMes, tonsDisponible: '' }] });
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

  const addMesRow = () => setForm((f) => ({
    ...f,
    mesesRows: [...f.mesesRows, { mesKey: '', tonsDisponible: '' }],
  }));

  const removeMesRow = (index) => setForm((f) => ({
    ...f,
    mesesRows: f.mesesRows.filter((_, i) => i !== index),
  }));

  const updateMesRow = (index, field, value) => setForm((f) => ({
    ...f,
    mesesRows: f.mesesRows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
  }));

  const submit = (event) => {
    event.preventDefault();
    if (!hasDisponibilidadIdentity(form)) {
      setValidationError('Debes seleccionar un proveedor o contacto.');
      return;
    }

    const sharedFields = {
      contactoId: form.contactoId,
      contactoNombre: form.contactoNombre,
      contactoTelefono: form.contactoTelefono,
      contactoEmail: form.contactoEmail,
      proveedorKey: form.proveedorKey,
      proveedorNombre: form.proveedorNombre,
      centroId: form.centroId,
      calibreMin: form.calibreMin ? Number(form.calibreMin) : null,
      calibreMax: form.calibreMax ? Number(form.calibreMax) : null,
      producto: form.producto,
      estado: item ? form.estado : 'disponible',
      origen: form.origen,
      observacion: form.observacion,
      motivo: form.motivo,
      empresaKey: form.proveedorKey,
      empresaNombre: form.proveedorNombre,
      centroCodigo: selectedCenter
        ? getCenterCode(selectedCenter)
        : (form.centroId ? item?.centroCodigo || '' : ''),
      comuna: selectedCenter?.comuna || (form.centroId ? item?.comuna || '' : ''),
      areaCodigo: selectedCenter?.areaCodigo || selectedCenter?.area || (form.centroId ? item?.areaCodigo || '' : ''),
    };

    if (item) {
      // Edición: payload único
      onSave([{ ...sharedFields, mesKey: form.mesKey, tonsDisponible: Number(form.tonsDisponible) }]);
      return;
    }

    // Creación: uno por cada fila de mes
    const validRows = form.mesesRows.filter((r) => r.mesKey && String(r.tonsDisponible).trim());
    if (!validRows.length) {
      setValidationError('Debes completar al menos un mes con toneladas.');
      return;
    }
    onSave(validRows.map((row) => ({
      ...sharedFields,
      mesKey: row.mesKey,
      tonsDisponible: Number(row.tonsDisponible),
    })));
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
            {/* Proveedor */}
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

            {/* Contacto */}
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

            {/* Centro */}
            <label className="mx-form-group">
              <span className="mx-form-label">Centro opcional</span>
              <select className="mx-select" value={form.centroId} onChange={(event) => update('centroId', event.target.value)} disabled={!selectedProvider}>
                <option value="">{selectedProvider ? 'Sin centro' : 'Selecciona proveedor primero'}</option>
                {centerOptions.map((center) => <option key={center._id} value={center._id}>{getCenterCode(center)}</option>)}
              </select>
            </label>

            {/* Responsable */}
            <div className="mx-form-group">
              <span className="mx-form-label">Responsable</span>
              <div className="disponibilidad-readonly-field"><UserRound size={16} /><strong>{item?.responsable || responsableNombre || 'Sin asignar'}</strong></div>
            </div>

            {/* Meses disponibles */}
            {item ? (
              // Modo edición: campo único de mes + toneladas
              <>
                <label className="mx-form-group">
                  <span className="mx-form-label">Mes/Año disponible</span>
                  <input className="mx-input" type="month" value={form.mesKey} onChange={(event) => update('mesKey', event.target.value)} required />
                </label>
                <label className="mx-form-group">
                  <span className="mx-form-label">Toneladas</span>
                  <input className="mx-input" type="number" min="0.01" step="0.01" value={form.tonsDisponible} onChange={(event) => update('tonsDisponible', event.target.value)} required />
                </label>
              </>
            ) : (
              // Modo creación: lista de filas mes + toneladas
              <div className="mx-form-group disponibilidad-field-wide">
                <span className="mx-form-label">Meses disponibles</span>
                <div className="disp-meses-list">
                  {form.mesesRows.map((row, index) => (
                    <div key={index} className="disp-mes-row">
                      <input
                        className="mx-input"
                        type="month"
                        value={row.mesKey}
                        onChange={(e) => updateMesRow(index, 'mesKey', e.target.value)}
                        required
                        placeholder="Mes/Año"
                      />
                      <input
                        className="mx-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={row.tonsDisponible}
                        onChange={(e) => updateMesRow(index, 'tonsDisponible', e.target.value)}
                        required
                        placeholder="Toneladas"
                      />
                      {form.mesesRows.length > 1 && (
                        <button type="button" className="mx-btn-icon sm disp-mes-remove" onClick={() => removeMesRow(index)} aria-label="Quitar mes">
                          <Minus size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="mx-btn mx-btn-outline sm disp-add-mes-btn" onClick={addMesRow}>
                    <Plus size={15} /> Agregar mes
                  </button>
                </div>
              </div>
            )}

            {/* Calibres */}
            <label className="mx-form-group">
              <span className="mx-form-label">Calibre mín. (mm)</span>
              <select className="mx-select" value={form.calibreMin} onChange={(event) => update('calibreMin', event.target.value)}>
                <option value="">Sin definir</option>
                {CALIBRE_MIN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>

            <label className="mx-form-group">
              <span className="mx-form-label">Calibre máx. (mm)</span>
              <select className="mx-select" value={form.calibreMax} onChange={(event) => update('calibreMax', event.target.value)}>
                <option value="">Sin definir</option>
                {CALIBRE_MAX_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>

            {/* Producto */}
            <label className="mx-form-group">
              <span className="mx-form-label">Producto</span>
              <select className="mx-select" value={form.producto} onChange={(event) => update('producto', event.target.value)}>
                {DISPONIBILIDAD_PRODUCTOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            {/* Estado */}
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

            {/* Origen */}
            <label className="mx-form-group">
              <span className="mx-form-label">Origen</span>
              <select className="mx-select" value={form.origen} onChange={(event) => update('origen', event.target.value)}>
                {DISPONIBILIDAD_ORIGENES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            {/* Observación */}
            <label className="mx-form-group disponibilidad-field-wide">
              <span className="mx-form-label">Observación</span>
              <textarea className="mx-input" rows={3} value={form.observacion} onChange={(event) => update('observacion', event.target.value)} placeholder="Información relevante entregada por el proveedor o contacto" />
            </label>

            {/* Motivo (solo para perdido/descartado) */}
            {['perdido', 'descartado'].includes(form.estado) && (
              <label className="mx-form-group disponibilidad-field-wide">
                <span className="mx-form-label">Motivo</span>
                <textarea className="mx-input" rows={2} value={form.motivo} onChange={(event) => update('motivo', event.target.value)} required placeholder="Indica por qué se perdió o descartó" />
              </label>
            )}
          </div>
          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mx-btn mx-btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : item ? 'Guardar cambios' : (form.mesesRows.length > 1 ? `Registrar ${form.mesesRows.length} disponibilidades` : 'Registrar disponibilidad')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
