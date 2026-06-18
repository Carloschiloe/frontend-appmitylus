import React from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader, X } from 'lucide-react';
import { fmtNum } from './muestreos.helpers';

const STEP_LABELS = {
  1: 'Contexto',
  2: 'Análisis',
  3: 'Resultado',
};

export default function MuestreoModalShell({
  editingId,
  step,
  onStepChange,
  onClose,
  isLoadingDetails,
  onSave,
  totals,
  uxkg,
  children,
}) {
  return (
    <div className="mx-modal-overlay mu-modal-overlay">
      <div className="mx-modal mu-main-modal">
        <div className="mx-modal-header mu-modal-header">
          <div className="mu-modal-title-row">
            <h3 className="mx-modal-title mu-modal-title">
              {editingId ? 'Editar' : 'Nuevo'} Muestreo Técnico
            </h3>

            <div className="mu-compact-stepper">
              {[1, 2, 3].map((number) => (
                <React.Fragment key={number}>
                  <div
                    onClick={() => number < step && onStepChange(number)}
                    className={`mu-compact-step ${step === number ? 'active' : ''} ${number < step ? 'clickable' : ''}`}
                  >
                    <div className={`mu-compact-step-dot ${step === number ? 'active' : ''} ${step > number ? 'done' : ''}`}>
                      {step > number ? <Check size={10} /> : number}
                    </div>
                    <span className="mu-compact-step-label">
                      {STEP_LABELS[number]}
                    </span>
                  </div>
                  {number < 3 && <div className="mu-compact-step-separator" />}
                </React.Fragment>
              ))}
            </div>
          </div>
          <button className="mx-btn-icon mu-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="mx-modal-body mu-modal-body">
          {isLoadingDetails ? (
            <div className="mu-loading-state">
              <Loader className="am-icon-spin mu-loading-icon" size={32} />
              <p>Cargando muestreo...</p>
            </div>
          ) : (
            <div className={`mu-body-inner ${step === 2 ? 'mu-body-inner--analysis' : ''}`}>
              {children}

              {step === 2 && (
                <aside className="mu-side-car">
                  <div className="mu-side-car-header">Métricas</div>

                  <div className="mu-side-car-item primary">
                    <div className="label">R% Carne</div>
                    <div className="val">{fmtNum(totals.rend, 1)}%</div>
                  </div>

                  <div className="mu-side-car-item">
                    <div className="label">U/Kg</div>
                    <div className="val">{uxkg || '—'}</div>
                  </div>

                  <div className="mu-side-car-item">
                    <div className="label">Muestra Total</div>
                    <div className="val">{fmtNum(totals.totalMuestra, 2)}<span className="unit">kg</span></div>
                  </div>

                  <div className="mu-side-car-item success">
                    <div className="label">Procesable</div>
                    <div className="val">{fmtNum(totals.totalMuestra > 0 ? (totals.procesable / totals.totalMuestra * 100) : 0, 1)}%</div>
                  </div>

                  <div className="mu-side-car-item error">
                    <div className="label">Rechazo</div>
                    <div className="val">{fmtNum(totals.totalMuestra > 0 ? (totals.rechazos / totals.totalMuestra * 100) : 0, 1)}%</div>
                  </div>

                  <div className="mu-side-car-item warning">
                    <div className="label">Defectos</div>
                    <div className="val">{fmtNum(totals.totalMuestra > 0 ? (totals.defectos / totals.totalMuestra * 100) : 0, 1)}%</div>
                  </div>
                </aside>
              )}
            </div>
          )}
        </div>

        <div className="mx-modal-footer mu-modal-footer">
          <button
            className="mx-btn mx-btn-outline"
            onClick={() => onStepChange((current) => Math.max(1, current - 1))}
            disabled={step === 1 || isLoadingDetails}
          >
            <ArrowLeft size={16} /> Atrás
          </button>

          <div className="mu-modal-footer-actions">
            {step < 3 ? (
              <button className="mx-btn mx-btn-primary" onClick={() => onStepChange((current) => current + 1)} disabled={isLoadingDetails}>
                Siguiente <ArrowRight size={16} />
              </button>
            ) : (
              <button className="mx-btn mx-btn-primary" onClick={onSave} disabled={isLoadingDetails}>
                <CheckCircle2 size={16} /> Guardar Calificación
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
