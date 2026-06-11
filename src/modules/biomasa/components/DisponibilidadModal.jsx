import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  DISPONIBILIDAD_ESTADOS,
  DISPONIBILIDAD_ORIGENES,
  DISPONIBILIDAD_PRODUCTOS,
} from '../disponibilidad.constants';

const EMPTY_FORM = {
  contactoId: '',
  centroId: '',
  mesKey: '',
  tonsDisponible: '',
  producto: 'sin_definir',
  estado: 'disponible',
  origen: 'llamada',
  observacion: '',
  motivo: '',
};

const getProviderName = (item) => item.proveedorNombre || item.empresaNombre || item.contactoNombre || 'Proveedor sin nombre';
const getCenterCode = (item) => item.codigo || item.centroCodigo || item.code || item.nombre || '';

export default function DisponibilidadModal({
  open,
  item,
  proveedores,
  centros,
  defaultMes,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    setForm(item ? {
      contactoId: String(item.contactoId || ''),
      centroId: String(item.centroId || ''),
      mesKey: item.mesKey || defaultMes,
      tonsDisponible: item.tons ?? item.tonsDisponible ?? '',
      producto: item.producto || 'sin_definir',
      estado: item.estado || 'disponible',
      origen: item.origen || 'otro',
      observacion: item.observacion || '',
      motivo: item.motivo || '',
    } : { ...EMPTY_FORM, mesKey: defaultMes });
  }, [defaultMes, item, open]);

  const selectedProvider = useMemo(
    () => proveedores.find((provider) => String(provider._id) === form.contactoId),
    [form.contactoId, proveedores]
  );

  const selectedCenter = useMemo(
    () => centros.find((center) => String(center._id) === form.centroId),
    [centros, form.centroId]
  );

  if (!open) return null;

  const update = (field, value) => setForm((current) => ({
    ...current,
    [field]: value,
    ...((field === 'estado' && !['perdido', 'descartado'].includes(value)) ? { motivo: '' } : {}),
  }));

  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      proveedorKey: selectedProvider?.proveedorKey || item?.proveedorKey || '',
      proveedorNombre: selectedProvider ? getProviderName(selectedProvider) : item?.proveedorNombre || '',
      empresaKey: selectedProvider?.proveedorKey || item?.empresaKey || '',
      empresaNombre: selectedProvider ? getProviderName(selectedProvider) : item?.empresaNombre || '',
      contactoNombre: selectedProvider?.contactoNombre || item?.contactoNombre || '',
      centroCodigo: selectedCenter ? getCenterCode(selectedCenter) : item?.centroCodigo || '',
      comuna: selectedCenter?.comuna || item?.comuna || '',
      areaCodigo: selectedCenter?.areaCodigo || selectedCenter?.area || item?.areaCodigo || '',
      tonsDisponible: Number(form.tonsDisponible),
    });
  };

  return (
    <div className="mx-modal-overlay disponibilidad-modal-overlay" onClick={onClose}>
      <div className="mx-modal disponibilidad-modal" onClick={(event) => event.stopPropagation()}>
        <div className="mx-modal-header">
          <div>
            <h3 className="mx-modal-title">{item ? 'Editar disponibilidad' : 'Registrar disponibilidad'}</h3>
            <p className="disponibilidad-modal-subtitle">Registra biomasa futura informada por un proveedor.</p>
          </div>
          <button type="button" className="mx-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form className="mx-form" onSubmit={submit}>
          <div className="mx-modal-body disponibilidad-form-grid">
            <label className="mx-form-group disponibilidad-field-wide">
              <span className="mx-form-label">Proveedor</span>
              <select className="mx-select" value={form.contactoId} onChange={(event) => update('contactoId', event.target.value)} required={!item}>
                <option value="">{item?.proveedorNombre || 'Seleccionar proveedor'}</option>
                {proveedores.map((provider) => <option key={provider._id} value={provider._id}>{getProviderName(provider)}</option>)}
              </select>
            </label>

            <label className="mx-form-group">
              <span className="mx-form-label">Centro opcional</span>
              <select className="mx-select" value={form.centroId} onChange={(event) => update('centroId', event.target.value)}>
                <option value="">Sin centro</option>
                {centros.map((center) => <option key={center._id} value={center._id}>{getCenterCode(center)}</option>)}
              </select>
            </label>

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

            <label className="mx-form-group">
              <span className="mx-form-label">Estado</span>
              <select className="mx-select" value={form.estado} onChange={(event) => update('estado', event.target.value)}>
                {DISPONIBILIDAD_ESTADOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="mx-form-group">
              <span className="mx-form-label">Origen</span>
              <select className="mx-select" value={form.origen} onChange={(event) => update('origen', event.target.value)}>
                {DISPONIBILIDAD_ORIGENES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="mx-form-group disponibilidad-field-wide">
              <span className="mx-form-label">Observación</span>
              <textarea className="mx-input" rows={3} value={form.observacion} onChange={(event) => update('observacion', event.target.value)} placeholder="Información relevante entregada por el proveedor" />
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
