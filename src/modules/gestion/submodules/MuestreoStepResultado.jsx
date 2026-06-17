import { AlertTriangle, Target } from 'lucide-react';
import { fmtNum } from './muestreos.helpers';

export default function MuestreoStepResultado({ form, totals }) {
  const procesablePct = totals.totalMuestra > 0 ? (totals.procesable / totals.totalMuestra) * 100 : 0;
  const rechazoPct = totals.totalMuestra > 0 ? (totals.rechazos / totals.totalMuestra) * 100 : 0;
  const defectoPct = totals.totalMuestra > 0 ? (totals.defectos / totals.totalMuestra) * 100 : 0;

  return (
    <div className="mu-step-container mu-result-step am-text-center am-py-32">
      <div className="mu-result-hero">
        <Target size={48} color="var(--color-primary)" />
        <h3 className="am-mt-16">Resumen del Análisis</h3>
        <p className="am-mb-32">Verifica los datos antes de guardar la calificación oficial.</p>
      </div>

      <div className="mu-result-grid">
        <div className="mu-res-item">
          <label>Rendimiento Carne</label>
          <div className="val">{fmtNum(totals.rend, 1)}%</div>
        </div>
        <div className="mu-res-item">
          <label>Unidades por kilo</label>
          <div className="val">{form.uxkg || 0}</div>
        </div>
        <div className="mu-res-item">
          <label>Muestra Total</label>
          <div className="val">{fmtNum(totals.totalMuestra, 2)} kg</div>
        </div>
        <div className="mu-res-item">
          <label>Procesable</label>
          <div className="val success">{fmtNum(procesablePct, 1)}%</div>
        </div>
        <div className="mu-res-item">
          <label>% Rechazo</label>
          <div className="val error">{fmtNum(rechazoPct, 1)}%</div>
        </div>
        <div className="mu-res-item">
          <label>% Defectos</label>
          <div className="val warning">{fmtNum(defectoPct, 1)}%</div>
        </div>
      </div>

      <div className="mu-confirm-msg am-mt-32">
        <AlertTriangle size={16} />
        <span>Este muestreo será registrado por <strong>{form.responsable || 'Usuario Sistema'}</strong> para el proveedor <strong>{form.proveedorNombre}</strong>.</span>
      </div>
    </div>
  );
}
