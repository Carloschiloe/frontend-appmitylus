import { X } from 'lucide-react';
import { EMPTY_TARIFA, TIPO_CAMION_OPTIONS } from '../fletes.constants';

const dateValue = (value) => {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
};

export default function TarifaModal({ open, transportista, isSaving, onClose, onSubmit }) {
  if (!open || !transportista) return null;
  const values = EMPTY_TARIFA;

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit({
      comuna: String(formData.get('comuna') || '').trim(),
      tipoCamion: String(formData.get('tipoCamion') || 'simple'),
      costoFijoPorViaje: Number(String(formData.get('costoFijoPorViaje') || '0').replace(',', '.')) || 0,
      costoPorKilo: Number(String(formData.get('costoPorKilo') || '0').replace(',', '.')) || 0,
      vigenciaDesde: formData.get('vigenciaDesde') || null,
      vigenciaHasta: formData.get('vigenciaHasta') || null,
      notas: String(formData.get('notas') || '').trim(),
    });
  };

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal fletes-modal">
        <div className="mx-modal-header">
          <div>
            <h2>Agregar tarifa</h2>
            <p className="fletes-modal-subtitle">{transportista.nombre}</p>
          </div>
          <button type="button" className="mx-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mx-modal-body fletes-form-grid">
            <label className="mx-form-group">
              <span className="mx-label">Comuna</span>
              <input className="mx-input" name="comuna" defaultValue={values.comuna} placeholder="Ej: Quellón" />
            </label>
            <label className="mx-form-group">
              <span className="mx-label">Tipo camión *</span>
              <select className="mx-select" name="tipoCamion" defaultValue={values.tipoCamion} required>
                {TIPO_CAMION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="mx-form-group">
              <span className="mx-label">Costo fijo por viaje</span>
              <input className="mx-input" name="costoFijoPorViaje" type="number" min="0" step="1" defaultValue={values.costoFijoPorViaje} />
            </label>
            <label className="mx-form-group">
              <span className="mx-label">Costo por kilo</span>
              <input className="mx-input" name="costoPorKilo" type="number" min="0" step="0.01" defaultValue={values.costoPorKilo} />
            </label>
            <label className="mx-form-group">
              <span className="mx-label">Vigencia desde</span>
              <input className="mx-input" name="vigenciaDesde" type="date" defaultValue={dateValue(values.vigenciaDesde)} />
            </label>
            <label className="mx-form-group">
              <span className="mx-label">Vigencia hasta</span>
              <input className="mx-input" name="vigenciaHasta" type="date" defaultValue={dateValue(values.vigenciaHasta)} />
            </label>
            <label className="mx-form-group fletes-form-span-2">
              <span className="mx-label">Notas</span>
              <textarea className="mx-input" name="notas" rows="3" defaultValue={values.notas} placeholder="Condiciones, restricciones o comentarios..." />
            </label>
          </div>

          <div className="mx-modal-footer">
            <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mx-btn mx-btn-primary" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Agregar tarifa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
