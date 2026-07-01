import { X } from 'lucide-react';
import { EMPTY_TRANSPORTISTA } from '../fletes.constants';

export default function TransportistaModal({ open, initialValue, isSaving, onClose, onSubmit }) {
  if (!open) return null;
  const values = { ...EMPTY_TRANSPORTISTA, ...(initialValue || {}) };

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit({
      nombre: String(formData.get('nombre') || '').trim(),
      rut: String(formData.get('rut') || '').trim(),
      contacto: String(formData.get('contacto') || '').trim(),
      telefono: String(formData.get('telefono') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      activo: formData.get('activo') === 'on',
    });
  };

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal fletes-modal">
        <div className="mx-modal-header">
          <div>
            <h2>{initialValue?._id ? 'Editar transportista' : 'Nuevo transportista'}</h2>
            <p className="fletes-modal-subtitle">Datos base de la empresa de transporte.</p>
          </div>
          <button type="button" className="mx-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mx-modal-body fletes-form-grid">
            <label className="mx-form-group fletes-form-span-2">
              <span className="mx-label">Nombre *</span>
              <input className="mx-input" name="nombre" defaultValue={values.nombre} required />
            </label>
            <label className="mx-form-group">
              <span className="mx-label">RUT</span>
              <input className="mx-input" name="rut" defaultValue={values.rut} />
            </label>
            <label className="mx-form-group">
              <span className="mx-label">Contacto</span>
              <input className="mx-input" name="contacto" defaultValue={values.contacto} />
            </label>
            <label className="mx-form-group">
              <span className="mx-label">Teléfono</span>
              <input className="mx-input" name="telefono" defaultValue={values.telefono} />
            </label>
            <label className="mx-form-group">
              <span className="mx-label">Email</span>
              <input className="mx-input" name="email" type="email" defaultValue={values.email} />
            </label>
            <label className="fletes-check">
              <input type="checkbox" name="activo" defaultChecked={values.activo !== false} />
              <span>Transportista activo</span>
            </label>
          </div>

          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mx-btn mx-btn-primary" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar transportista'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
