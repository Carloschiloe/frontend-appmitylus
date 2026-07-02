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
import { mesLabel } from '../utils/fechasChile';
import { usuariosApi } from '../../../api/api-usuarios';
import { useAuth } from '../../../context/AuthContext';

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
  responsable: '',
  // Modo edición (un registro):
  mesKey: '',
  tonsDisponible: '',
  calibreMin: '',
  calibreMax: '',
  // Modo creación (lista de disponibilidades):
  mesesRows: [],
  producto: 'sin_definir',
  estado: 'disponible',
  origen: 'llamada',
  observacion: '',
  motivo: '',
  // Centro de origen (cuando proveedor es comercializadora)
  centroOrigenId: '',
  centroOrigenCodigo: '',
  centroOrigenComuna: '',
  centroOrigenProveedor: '',
};

const EMPTY_ADD_ROW = { mesKey: '', tonsDisponible: '', calibreMin: '', calibreMax: '' };

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
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [addRow, setAddRow] = useState(EMPTY_ADD_ROW);
  const [providerSearch, setProviderSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [centroOrigenSearch, setCentroOrigenSearch] = useState('');
  const [validationError, setValidationError] = useState('');
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    if (!open) return;
    setAddRow({ mesKey: defaultMes, tonsDisponible: '', calibreMin: '', calibreMax: '' });
    setForm(item ? {
      contactoId: String(item.contactoId || ''),
      contactoNombre: item.contactoNombre || '',
      contactoTelefono: item.contactoTelefono || item.contactoSnapshot?.telefono || '',
      contactoEmail: item.contactoEmail || item.contactoSnapshot?.email || '',
      proveedorKey: item.proveedorKey || item.empresaKey || '',
      proveedorNombre: item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || '',
      centroId: String(item.centroId || ''),
      responsable: item.responsable || responsableNombre,
      mesKey: item.mesKey || defaultMes,
      tonsDisponible: item.tons ?? item.tonsDisponible ?? '',
      mesesRows: [],
      calibreMin: String(item.calibreMin ?? ''),
      calibreMax: String(item.calibreMax ?? ''),
      producto: item.producto || 'sin_definir',
      estado: item.estado || 'disponible',
      origen: item.origen || 'otro',
      observacion: item.observacion || '',
      motivo: item.motivo || '',
      centroOrigenId: item.centroOrigenId || '',
      centroOrigenCodigo: item.centroOrigenCodigo || '',
      centroOrigenComuna: item.centroOrigenComuna || '',
      centroOrigenProveedor: item.centroOrigenProveedor || '',
    } : { ...EMPTY_FORM, responsable: responsableNombre });
    setProviderSearch(item?.proveedorNombreNorm || item?.proveedorNombre || item?.empresaNombre || '');
    setContactSearch(item?.contactoNombre || '');
    setCentroOrigenSearch(item?.centroOrigenCodigo ? `${item.centroOrigenCodigo}${item.centroOrigenComuna ? ` · ${item.centroOrigenComuna}` : ''}` : '');
    setValidationError('');
    // Filtrar por empresa activa: superadmin usa selected_tenant_id,
    // admin normal usa su propio empresaId del JWT
    const activeEmpresaId = localStorage.getItem('selected_tenant_id')
      || user?.empresaId?._id
      || user?.empresaId
      || null;
    usuariosApi.getUsuarios()
      .then((list) => {
        if (!activeEmpresaId) { setUsuarios(list); return; }
        setUsuarios(list.filter((u) => String(u.empresaId) === String(activeEmpresaId)));
      })
      .catch(() => {});
  }, [defaultMes, item, open, responsableNombre]);

  const selectedProvider = useMemo(
    () => proveedores.find((p) => form.proveedorKey && p.proveedorKey === String(form.proveedorKey).toLowerCase()),
    [form.proveedorKey, proveedores]
  );
  const filteredProviders = useMemo(() => filterDisponibilidadProviders(proveedores, providerSearch), [providerSearch, proveedores]);
  const filteredContacts = useMemo(() => filterDisponibilidadContacts(contactos, contactSearch), [contactSearch, contactos]);

  const centerOptions = selectedProvider?.centros || [];
  const selectedCenter = centerOptions.find((c) => String(c._id) === form.centroId);
  const showProviderResults = providerSearch.trim() && providerSearch.trim() !== form.proveedorNombre;
  const showContactResults = contactSearch.trim() && contactSearch.trim() !== form.contactoNombre;

  // Búsqueda de centro de origen (para comercializadoras sin centros propios)
  const showCentroOrigen = form.proveedorKey && centerOptions.length === 0;
  const centroOrigenResults = useMemo(() => {
    if (!centroOrigenSearch.trim() || !showCentroOrigen) return [];
    const q = centroOrigenSearch.trim().toLowerCase();
    const results = [];
    for (const prov of proveedores) {
      for (const c of (prov.centros || [])) {
        const codigo = getCenterCode(c).toLowerCase();
        const comuna = (c.comuna || '').toLowerCase();
        const nombre = (prov.proveedorNombre || '').toLowerCase();
        if (codigo.includes(q) || comuna.includes(q) || nombre.includes(q)) {
          results.push({ centroId: c._id, centroCodigo: getCenterCode(c), centroComuna: c.comuna || '', proveedorNombre: prov.proveedorNombre || '' });
          if (results.length >= 10) return results;
        }
      }
    }
    return results;
  }, [centroOrigenSearch, showCentroOrigen, proveedores]);

  const selectCentroOrigen = (opt) => {
    setForm((f) => ({ ...f, centroOrigenId: String(opt.centroId), centroOrigenCodigo: opt.centroCodigo, centroOrigenComuna: opt.centroComuna, centroOrigenProveedor: opt.proveedorNombre }));
    setCentroOrigenSearch(`${opt.centroCodigo}${opt.centroComuna ? ` · ${opt.centroComuna}` : ''}`);
  };
  const clearCentroOrigen = () => {
    setForm((f) => ({ ...f, centroOrigenId: '', centroOrigenCodigo: '', centroOrigenComuna: '', centroOrigenProveedor: '' }));
    setCentroOrigenSearch('');
  };
  const showCentroOrigenResults = centroOrigenSearch.trim() && !form.centroOrigenCodigo;

  if (!open) return null;

  const update = (field, value) => setForm((f) => ({
    ...f,
    [field]: value,
    ...((field === 'estado' && !['perdido', 'descartado'].includes(value)) ? { motivo: '' } : {}),
  }));

  const clearProvider = () => {
    setProviderSearch('');
    setForm((f) => ({ ...f, proveedorKey: '', proveedorNombre: '', centroId: '' }));
  };
  const selectProvider = (provider) => {
    setProviderSearch(provider.proveedorNombre);
    // Auto-rellena el contacto si el proveedor tiene uno asociado en la BD
    const linkedContact = provider.contactoId
      ? contactos.find((c) => c.contactoId === String(provider.contactoId))
      : null;
    setForm((f) => ({
      ...f,
      proveedorKey: provider.proveedorKey,
      proveedorNombre: provider.proveedorNombre,
      centroId: '',
      ...(linkedContact ? {
        contactoId: linkedContact.contactoId,
        contactoNombre: linkedContact.contactoNombre,
        contactoTelefono: linkedContact.contactoTelefono,
        contactoEmail: linkedContact.contactoEmail,
      } : {}),
    }));
    if (linkedContact) setContactSearch(linkedContact.contactoNombre);
    setValidationError('');
  };
  const clearContact = () => {
    setContactSearch('');
    setForm((f) => ({ ...f, contactoId: '', contactoNombre: '', contactoTelefono: '', contactoEmail: '' }));
  };
  const selectContact = (contact) => {
    setContactSearch(contact.contactoNombre);
    setForm((f) => ({ ...f, contactoId: contact.contactoId, contactoNombre: contact.contactoNombre, contactoTelefono: contact.contactoTelefono, contactoEmail: contact.contactoEmail }));
    setValidationError('');
  };

  // Agrega la fila actual al listado
  const handleAgregar = () => {
    if (!addRow.mesKey || !String(addRow.tonsDisponible).trim()) {
      setValidationError('Completa el mes y las toneladas antes de agregar.');
      return;
    }
    setForm((f) => ({ ...f, mesesRows: [...f.mesesRows, { mesKey: addRow.mesKey, tonsDisponible: addRow.tonsDisponible, calibreMin: addRow.calibreMin, calibreMax: addRow.calibreMax }] }));
    setAddRow({ mesKey: '', tonsDisponible: '', calibreMin: '', calibreMax: '' });
    setValidationError('');
  };

  const removeRow = (index) => setForm((f) => ({ ...f, mesesRows: f.mesesRows.filter((_, i) => i !== index) }));

  const updateRow = (index, field, value) => setForm((f) => ({
    ...f,
    mesesRows: f.mesesRows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
  }));

  const sharedFields = () => {
    const centroCodigo = selectedCenter
      ? getCenterCode(selectedCenter)
      : (form.centroId ? item?.centroCodigo || '' : '');
    const comuna = selectedCenter?.comuna || (form.centroId ? item?.comuna || '' : '');
    const areaCodigo = selectedCenter?.areaCodigo || selectedCenter?.area || (form.centroId ? item?.areaCodigo || '' : '');
    return {
      contactoId: form.contactoId,
      contactoNombre: form.contactoNombre,
      contactoTelefono: form.contactoTelefono,
      contactoEmail: form.contactoEmail,
      proveedorKey: form.proveedorKey,
      proveedorNombre: form.proveedorNombre,
      centroId: form.centroId,
      responsable: form.responsable || responsableNombre,
      producto: form.producto,
      estado: item ? form.estado : 'disponible',
      origen: form.origen,
      observacion: form.observacion,
      motivo: form.motivo,
      empresaKey: form.proveedorKey,
      empresaNombre: form.proveedorNombre,
      centroCodigo,
      comuna,
      areaCodigo,
      centroOrigenId: form.centroOrigenId || null,
      centroOrigenCodigo: form.centroOrigenCodigo || '',
      centroOrigenComuna: form.centroOrigenComuna || '',
      centroOrigenProveedor: form.centroOrigenProveedor || '',
    };
  };

  const submit = (event) => {
    event.preventDefault();
    if (!hasDisponibilidadIdentity(form)) {
      setValidationError('Debes seleccionar un proveedor o contacto.');
      return;
    }

    if (item) {
      onSave([{
        ...sharedFields(),
        mesKey: form.mesKey,
        tonsDisponible: Number(form.tonsDisponible),
        calibreMin: form.calibreMin ? Number(form.calibreMin) : null,
        calibreMax: form.calibreMax ? Number(form.calibreMax) : null,
      }]);
      return;
    }

    if (!form.mesesRows.length) {
      setValidationError('Agrega al menos una disponibilidad con mes y toneladas.');
      return;
    }
    onSave(form.mesesRows.map((row) => ({
      ...sharedFields(),
      mesKey: row.mesKey,
      tonsDisponible: Number(row.tonsDisponible),
      calibreMin: row.calibreMin ? Number(row.calibreMin) : null,
      calibreMax: row.calibreMax ? Number(row.calibreMax) : null,
    })));
  };

  return (
    <div className="mx-modal-overlay disponibilidad-modal-overlay" onClick={onClose}>
      <div className="mx-modal disponibilidad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mx-modal-header">
          <div>
            <h3 className="mx-modal-title">{item ? 'Editar disponibilidad' : 'Registrar disponibilidad'}</h3>
            <p className="disponibilidad-modal-subtitle">Registra biomasa futura informada por un proveedor, contacto o ambos.</p>
          </div>
          <button type="button" className="mx-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form className="mx-form" onSubmit={submit}>
          <div className="mx-modal-body disponibilidad-form-grid">

            {/* ── Proveedor ─────────────────────────────────────────────────── */}
            <div className="mx-form-group">
              <span className="mx-form-label">Proveedor opcional</span>
              <div className="disponibilidad-provider-search">
                <Search size={18} />
                <input
                  value={providerSearch}
                  onChange={(e) => {
                    setProviderSearch(e.target.value);
                    if (form.proveedorNombre && e.target.value.trim() !== form.proveedorNombre) {
                      setForm((f) => ({ ...f, proveedorKey: '', proveedorNombre: '', centroId: '' }));
                    }
                  }}
                  placeholder="Buscar empresa o comuna..."
                />
                {form.proveedorNombre && <button type="button" className="disponibilidad-search-clear" onClick={clearProvider} aria-label="Quitar proveedor"><X size={15} /></button>}
              </div>
              {showProviderResults && (
                <div className="disponibilidad-provider-results">
                  {filteredProviders.length === 0
                    ? <div className="disponibilidad-inline-empty">No encontramos proveedores.</div>
                    : filteredProviders.map((p) => (
                      <button key={p.id} type="button" className="disponibilidad-provider-option" onClick={() => selectProvider(p)}>
                        <strong>{p.proveedorNombre}</strong>
                        <span>{p.comuna || 'Sin comuna'} · {p.centros.length} centro{p.centros.length === 1 ? '' : 's'}</span>
                      </button>
                    ))}
                </div>
              )}
              {form.proveedorNombre && (
                <div className="disponibilidad-provider-selected"><CheckCircle2 size={16} /><span><strong>{form.proveedorNombre}</strong> seleccionado</span></div>
              )}
            </div>

            {/* ── Contacto ──────────────────────────────────────────────────── */}
            <div className="mx-form-group">
              <span className="mx-form-label">Contacto opcional</span>
              <div className="disponibilidad-provider-search">
                <Search size={18} />
                <input
                  value={contactSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContactSearch(val);
                    if (form.contactoId) {
                      // Tenía contacto seleccionado de la BD — limpiar selección y usar como texto libre
                      setForm((f) => ({ ...f, contactoId: '', contactoNombre: val, contactoTelefono: '', contactoEmail: '' }));
                    } else {
                      // Sin selección formal — texto libre directo
                      setForm((f) => ({ ...f, contactoNombre: val }));
                    }
                  }}
                  placeholder="Buscar o escribir nombre del contacto..."
                />
                {(form.contactoNombre || contactSearch) && (
                  <button type="button" className="disponibilidad-search-clear" onClick={clearContact} aria-label="Quitar contacto"><X size={15} /></button>
                )}
              </div>
              {showContactResults && (
                <div className="disponibilidad-provider-results">
                  {filteredContacts.length === 0
                    ? <div className="disponibilidad-inline-empty">No encontramos contactos.</div>
                    : filteredContacts.map((c) => (
                      <button key={c.id} type="button" className="disponibilidad-provider-option" onClick={() => selectContact(c)}>
                        <strong>{c.contactoNombre}</strong>
                        <span>{c.contactoTelefono || c.contactoEmail || 'Sin teléfono ni email'}{c.proveedorNombre ? ` · ${c.proveedorNombre}` : ' · Sin proveedor'}</span>
                      </button>
                    ))}
                </div>
              )}
              {form.contactoNombre && form.contactoId && (
                <div className="disponibilidad-contact-selected">
                  <UserRound size={16} />
                  <span><strong>{form.contactoNombre}</strong>{form.contactoTelefono || form.contactoEmail ? ` · ${form.contactoTelefono || form.contactoEmail}` : ''}</span>
                </div>
              )}
              {form.contactoNombre && !form.contactoId && (
                <div className="disponibilidad-contact-freetext">
                  <UserRound size={16} />
                  <span><strong>{form.contactoNombre}</strong> <em>· ingresado manualmente</em></span>
                </div>
              )}
            </div>

            {validationError && <div className="disponibilidad-form-error disponibilidad-field-wide">{validationError}</div>}

            {/* ── Centro / Chip comuna / Producto ───────────────────────────── */}
            {showCentroOrigen ? (
              // Comercializadora: sin Centro propio → solo Producto
              <label className="mx-form-group">
                <span className="mx-form-label">Producto</span>
                <select className="mx-select" value={form.producto} onChange={(e) => update('producto', e.target.value)}>
                  {DISPONIBILIDAD_PRODUCTOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ) : (
              <div className="disponibilidad-field-wide disp-centro-producto-row">
                <label className="mx-form-group">
                  <span className="mx-form-label">Centro opcional</span>
                  <select className="mx-select" value={form.centroId} onChange={(e) => update('centroId', e.target.value)} disabled={!selectedProvider}>
                    <option value="">{selectedProvider ? 'Sin centro' : 'Selecciona proveedor primero'}</option>
                    {centerOptions.map((c) => <option key={c._id} value={c._id}>{getCenterCode(c)}</option>)}
                  </select>
                </label>

                <div className="disp-centro-chip-col">
                  {(selectedCenter?.comuna || (form.centroId && item?.comuna)) && (
                    <div className="disponibilidad-provider-selected">
                      <CheckCircle2 size={16} />
                      <span><strong>{selectedCenter?.comuna || item?.comuna}</strong></span>
                    </div>
                  )}
                </div>

                <label className="mx-form-group">
                  <span className="mx-form-label">Producto</span>
                  <select className="mx-select" value={form.producto} onChange={(e) => update('producto', e.target.value)}>
                    {DISPONIBILIDAD_PRODUCTOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>
            )}

            {/* ── Centro de origen (cuando proveedor es comercializadora) ───── */}
            {showCentroOrigen && (
              <div className="mx-form-group disponibilidad-field-wide">
                <span className="mx-form-label">Centro de origen <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>— centro real que produce la biomasa</span></span>
                <div className="disponibilidad-provider-search">
                  <Search size={18} />
                  <input
                    value={centroOrigenSearch}
                    onChange={(e) => {
                      setCentroOrigenSearch(e.target.value);
                      if (form.centroOrigenCodigo) clearCentroOrigen();
                    }}
                    placeholder="Buscar por código de centro, comuna o empresa..."
                  />
                  {form.centroOrigenCodigo && (
                    <button type="button" className="disponibilidad-search-clear" onClick={clearCentroOrigen} aria-label="Quitar"><X size={15} /></button>
                  )}
                </div>
                {showCentroOrigenResults && (
                  <div className="disponibilidad-provider-results">
                    {centroOrigenResults.length === 0
                      ? <div className="disponibilidad-inline-empty">No encontramos centros con ese criterio.</div>
                      : centroOrigenResults.map((opt) => (
                        <button key={opt.centroId} type="button" className="disponibilidad-provider-option" onClick={() => selectCentroOrigen(opt)}>
                          <strong>{opt.centroCodigo}</strong>
                          <span>{opt.centroComuna || 'Sin comuna'} · {opt.proveedorNombre}</span>
                        </button>
                      ))}
                  </div>
                )}
                {form.centroOrigenCodigo && (
                  <div className="disponibilidad-provider-selected">
                    <CheckCircle2 size={16} />
                    <span><strong>{form.centroOrigenCodigo}</strong>{form.centroOrigenComuna ? ` · ${form.centroOrigenComuna}` : ''}{form.centroOrigenProveedor ? ` · ${form.centroOrigenProveedor}` : ''}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Calibres (solo edición) / Responsable / Estado ───────────── */}
            {item && (
              <>
                <label className="mx-form-group">
                  <span className="mx-form-label">Calibre mín. (mm)</span>
                  <select className="mx-select" value={form.calibreMin} onChange={(e) => update('calibreMin', e.target.value)}>
                    <option value="">Sin definir</option>
                    {CALIBRE_MIN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="mx-form-group">
                  <span className="mx-form-label">Calibre máx. (mm)</span>
                  <select className="mx-select" value={form.calibreMax} onChange={(e) => update('calibreMax', e.target.value)}>
                    <option value="">Sin definir</option>
                    {CALIBRE_MAX_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              </>
            )}

            <label className="mx-form-group">
              <span className="mx-form-label">Responsable</span>
              <select className="mx-select" value={form.responsable} onChange={(e) => update('responsable', e.target.value)}>
                {(!usuarios.length || !usuarios.some((u) => u.nombre === form.responsable)) && (
                  <option value={form.responsable}>{form.responsable || responsableNombre || 'Sin asignar'}</option>
                )}
                {usuarios.map((u) => <option key={u._id} value={u.nombre}>{u.nombre}</option>)}
              </select>
            </label>

            <label className="mx-form-group">
              <span className="mx-form-label">Origen</span>
              <select className="mx-select" value={form.origen} onChange={(e) => update('origen', e.target.value)}>
                {DISPONIBILIDAD_ORIGENES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            {item && (
              <label className="mx-form-group">
                <span className="mx-form-label">Estado</span>
                <select className="mx-select" value={form.estado} onChange={(e) => update('estado', e.target.value)}>
                  {DISPONIBILIDAD_ESTADOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            )}

            <label className="mx-form-group disponibilidad-field-wide">
              <span className="mx-form-label">Observación</span>
              <textarea className="mx-input" rows={2} value={form.observacion} onChange={(e) => update('observacion', e.target.value)} placeholder="Información relevante entregada por el proveedor o contacto" />
            </label>

            {['perdido', 'descartado'].includes(form.estado) && (
              <label className="mx-form-group disponibilidad-field-wide">
                <span className="mx-form-label">Motivo</span>
                <textarea className="mx-input" rows={2} value={form.motivo} onChange={(e) => update('motivo', e.target.value)} required placeholder="Indica por qué se perdió o descartó" />
              </label>
            )}

            {/* ── Sección de mes + toneladas ─────────────────────────────────── */}
            {item ? (
              // Edición: campos simples
              <>
                <label className="mx-form-group">
                  <span className="mx-form-label">Mes/Año disponible</span>
                  <input className="mx-input" type="month" value={form.mesKey} onChange={(e) => update('mesKey', e.target.value)} required />
                </label>
                <label className="mx-form-group">
                  <span className="mx-form-label">Toneladas</span>
                  <input className="mx-input" type="number" min="0.01" step="0.01" value={form.tonsDisponible} onChange={(e) => update('tonsDisponible', e.target.value)} required />
                </label>
              </>
            ) : (
              // Creación: agregar por mes
              <div className="mx-form-group disponibilidad-field-wide disp-add-section">
                <div className="disp-add-section__header">
                  <span className="mx-form-label">Disponibilidades a registrar</span>
                  <span className="disp-add-section__estado-info"><CheckCircle2 size={13} /> Estado inicial: Disponible</span>
                </div>

                {/* Fila de entrada */}
                <div className="disp-add-section__input-row">
                  <div>
                    <span className="disp-add-section__sublabel">Mes / Año</span>
                    <input
                      className="mx-input"
                      type="month"
                      value={addRow.mesKey}
                      onChange={(e) => setAddRow((r) => ({ ...r, mesKey: e.target.value }))}
                    />
                  </div>
                  <div>
                    <span className="disp-add-section__sublabel">Toneladas</span>
                    <input
                      className="mx-input"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="ej. 200"
                      value={addRow.tonsDisponible}
                      onChange={(e) => setAddRow((r) => ({ ...r, tonsDisponible: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAgregar(); } }}
                    />
                  </div>
                  <div>
                    <span className="disp-add-section__sublabel">Cal. mín (mm)</span>
                    <select className="mx-select" value={addRow.calibreMin} onChange={(e) => setAddRow((r) => ({ ...r, calibreMin: e.target.value }))}>
                      <option value="">—</option>
                      {CALIBRE_MIN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="disp-add-section__sublabel">Cal. máx (mm)</span>
                    <select className="mx-select" value={addRow.calibreMax} onChange={(e) => setAddRow((r) => ({ ...r, calibreMax: e.target.value }))}>
                      <option value="">—</option>
                      {CALIBRE_MAX_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="disp-add-section__btn-wrap">
                    <span className="disp-add-section__sublabel">&nbsp;</span>
                    <button type="button" className="mx-btn mx-btn-primary disp-add-section__agregar" onClick={handleAgregar}>
                      <Plus size={16} /> Agregar
                    </button>
                  </div>
                </div>

                {/* Lista de disponibilidades agregadas */}
                {form.mesesRows.length > 0 && (
                  <div className="disp-added-list">
                    <div className="disp-added-list__header">
                      <span>Mes / Año</span>
                      <span>Tons</span>
                      <span>Cal. mín</span>
                      <span>Cal. máx</span>
                      <span />
                    </div>
                    {form.mesesRows.map((row, index) => (
                      <div key={index} className="disp-added-list__row">
                        <div className="disp-added-list__mes">
                          <input
                            className="mx-input"
                            type="month"
                            value={row.mesKey}
                            onChange={(e) => updateRow(index, 'mesKey', e.target.value)}
                          />
                        </div>
                        <div className="disp-added-list__tons">
                          <input
                            className="mx-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={row.tonsDisponible}
                            onChange={(e) => updateRow(index, 'tonsDisponible', e.target.value)}
                          />
                        </div>
                        <div>
                          <select className="mx-select" value={row.calibreMin || ''} onChange={(e) => updateRow(index, 'calibreMin', e.target.value)}>
                            <option value="">—</option>
                            {CALIBRE_MIN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        <div>
                          <select className="mx-select" value={row.calibreMax || ''} onChange={(e) => updateRow(index, 'calibreMax', e.target.value)}>
                            <option value="">—</option>
                            {CALIBRE_MAX_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        <button
                          type="button"
                          className="mx-btn-icon sm disp-added-list__remove"
                          onClick={() => removeRow(index)}
                          aria-label="Quitar"
                        >
                          <Minus size={15} />
                        </button>
                      </div>
                    ))}
                    <div className="disp-added-list__total">
                      Total: <strong>{form.mesesRows.reduce((sum, r) => sum + (Number(r.tonsDisponible) || 0), 0).toLocaleString('es-CL')} t</strong> en {form.mesesRows.length} mes{form.mesesRows.length !== 1 ? 'es' : ''}
                    </div>
                  </div>
                )}

                {form.mesesRows.length === 0 && (
                  <div className="disp-add-section__empty">
                    Aún no has agregado disponibilidades. Completa el mes y las toneladas y presiona <strong>Agregar</strong>.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mx-btn mx-btn-primary" disabled={saving}>
              {saving
                ? 'Guardando...'
                : item
                  ? 'Guardar cambios'
                  : form.mesesRows.length > 0
                    ? `Registrar ${form.mesesRows.length} disponibilidad${form.mesesRows.length !== 1 ? 'es' : ''}`
                    : 'Registrar disponibilidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
