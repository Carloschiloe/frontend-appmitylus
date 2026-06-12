import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DISPONIBILIDAD_PRODUCTOS } from '../disponibilidad.constants';
import { fmtTons } from '../utils/programaCalculos';
import DisponibilidadProviderCell from './DisponibilidadProviderCell';

const itemTons = (item) => Number(item?.tons || item?.tonsDisponible || 0);
const initialDate = (item) => item?.mesKey ? `${item.mesKey}-01` : '';

export default function DisponibilidadCrearTratoModal({
  open,
  item,
  responsableNombre,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    tonsAcordadas: '',
    precioAcordado: '',
    producto: 'sin_definir',
    vigenciaDesde: '',
    notasTrato: '',
    condicionesComerciales: '',
  });
  const [error, setError] = useState('');
  const disponible = itemTons(item);

  useEffect(() => {
    if (!open || !item) return;
    setForm({
      tonsAcordadas: String(disponible || ''),
      precioAcordado: '',
      producto: item.producto || 'sin_definir',
      vigenciaDesde: initialDate(item),
      notasTrato: item.observacion || '',
      condicionesComerciales: '',
    });
    setError('');
  }, [disponible, item, open]);

  if (!open || !item) return null;

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event) => {
    event.preventDefault();
    const tons = Number(form.tonsAcordadas);
    if (!Number.isFinite(tons) || tons <= 0 || tons > disponible) {
      setError(`Las toneladas deben ser mayores a 0 y no superar ${fmtTons(disponible)}.`);
      return;
    }
    setError('');
    onSave({
      ...form,
      tonsAcordadas: tons,
      precioAcordado: form.precioAcordado === '' ? null : Number(form.precioAcordado),
    });
  };

  return (
    <div className="mx-modal-overlay" onClick={onClose}>
      <div className="mx-modal disponibilidad-create-trato-modal" onClick={(event) => event.stopPropagation()}>
        <div className="mx-modal-header">
          <div>
            <h2 className="mx-modal-title">Crear trato asociado</h2>
            <p className="disponibilidad-modal-subtitle">La disponibilidad quedará cerrada y asociada al nuevo trato.</p>
          </div>
          <button type="button" className="mx-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form onSubmit={submit}>
          <div className="mx-modal-body">
            <div className="disponibilidad-create-trato-origin">
              <DisponibilidadProviderCell item={item} />
              <span>{item.centroCodigo || 'Sin centro'}</span>
              <strong>{fmtTons(disponible)} disponibles</strong>
            </div>

            <div className="disponibilidad-form-grid">
              <label className="disponibilidad-field">
                <span>Toneladas del trato</span>
                <input className="mx-input" type="number" min="0.01" max={disponible} step="0.01" value={form.tonsAcordadas} onChange={(event) => update('tonsAcordadas', event.target.value)} required />
              </label>
              <label className="disponibilidad-field">
                <span>Precio acordado</span>
                <input className="mx-input" type="number" min="0" step="0.01" value={form.precioAcordado} onChange={(event) => update('precioAcordado', event.target.value)} placeholder="Opcional" />
              </label>
              <label className="disponibilidad-field">
                <span>Producto</span>
                <select className="mx-select" value={form.producto} onChange={(event) => update('producto', event.target.value)}>
                  {DISPONIBILIDAD_PRODUCTOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="disponibilidad-field">
                <span>Inicio probable</span>
                <input className="mx-input" type="date" value={form.vigenciaDesde} onChange={(event) => update('vigenciaDesde', event.target.value)} required />
              </label>
              <label className="disponibilidad-field disponibilidad-field--wide">
                <span>Observaciones</span>
                <textarea className="mx-textarea" rows="3" value={form.notasTrato} onChange={(event) => update('notasTrato', event.target.value)} />
              </label>
              <label className="disponibilidad-field disponibilidad-field--wide">
                <span>Condiciones comerciales</span>
                <textarea className="mx-textarea" rows="3" value={form.condicionesComerciales} onChange={(event) => update('condicionesComerciales', event.target.value)} placeholder="Condiciones que deben quedar registradas en el trato." />
              </label>
            </div>

            <div className="disponibilidad-create-trato-responsable">
              Responsable: <strong>{responsableNombre || 'Se asignará desde el usuario conectado'}</strong>
            </div>
            {error && <div className="disponibilidad-form-error">{error}</div>}
          </div>

          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mx-btn mx-btn-primary" disabled={saving}>{saving ? 'Creando trato...' : 'Crear trato'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
