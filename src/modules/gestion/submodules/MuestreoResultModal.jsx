import { AlertTriangle, Award, Printer } from 'lucide-react';

export default function MuestreoResultModal({ isOpen, resultData, onClose, onReport }) {
  if (!isOpen || !resultData) return null;

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal shadow-2xl mu-result-modal">
        <div className="mu-result-success-animation">
          {resultData.clasificaciones?.[0] ? (
            <div className="mu-icon-pulse success"><Award size={64} /></div>
          ) : (
            <div className="mu-icon-pulse error"><AlertTriangle size={64} /></div>
          )}
        </div>

        <h2 className="mu-result-modal-title">
          {resultData.clasificaciones?.[0]?.nombre || 'Sin Clasificacion'}
        </h2>
        <p className="mu-result-modal-copy">
          La materia prima ha sido analizada y calificada segun los parametros vigentes.
        </p>

        <div className="mu-result-mini-kpis am-mt-24">
          <div className="kpi"><span>R%</span><strong>{Number(resultData.rendimiento).toFixed(1)}%</strong></div>
          <div className="kpi"><span>UxKg</span><strong>{resultData.uxkg}</strong></div>
        </div>

        {!resultData.clasificaciones?.[0] && Array.isArray(resultData.evaluacionCriterios) && resultData.evaluacionCriterios.some((c) => !c.cumple) && (
          <div className="mu-result-reasons">
            <div className="mu-result-reasons-title">¿Por qué no clasificó?</div>
            {resultData.evaluacionCriterios.filter((c) => !c.cumple).map((c) => (
              <div key={c.nombre} className="mu-result-reason-item">
                <strong>{c.nombre}:</strong> {c.razon}
              </div>
            ))}
          </div>
        )}

        <div className="mu-result-modal-actions">
          <button className="mx-btn mx-btn-outline mu-flex-action" onClick={onClose}>Cerrar</button>
          <button className="mx-btn mx-btn-primary mu-flex-action" onClick={() => onReport(resultData)}>
            <Printer size={16} /> Informe
          </button>
        </div>
      </div>
    </div>
  );
}
