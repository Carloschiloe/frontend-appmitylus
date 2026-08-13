import { ArrowRight, CheckCircle2, TrendingDown, TrendingUp, TriangleAlert, X } from 'lucide-react';
import { fmtTons } from '../utils/programaCalculos';
import { fmtDateShort } from '../utils/fechasChile';

function DeltaBadge({ delta }) {
  if (!delta) return null;
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`disp-cascade-delta ${up ? 'is-up' : 'is-down'}`}>
      <Icon size={13} /> {up ? '+' : ''}{fmtTons(delta)}
    </span>
  );
}

function CascadeRow({ label, before, after }) {
  if (before === after) {
    return (
      <div className="disp-cascade-row">
        <span className="disp-cascade-row-label">{label}</span>
        <span className="disp-cascade-row-value">{before}</span>
      </div>
    );
  }
  return (
    <div className="disp-cascade-row">
      <span className="disp-cascade-row-label">{label}</span>
      <span className="disp-cascade-row-value disp-cascade-row-change">
        {before} <ArrowRight size={13} /> <strong>{after}</strong>
      </span>
    </div>
  );
}

export default function DisponibilidadCascadeModal({ cascade, onClose }) {
  if (!cascade) return null;

  const deltaTons = cascade.deltaTons || 0;
  const fechaCambio = cascade.vigenciaHastaAntes !== cascade.vigenciaHastaDespues;

  return (
    <div className="mx-modal-overlay" onClick={onClose}>
      <div className="mx-modal disp-cascade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mx-modal-header">
          <h3 className="mx-modal-title">Cambios propagados</h3>
          <button type="button" className="mx-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="mx-modal-body disp-cascade-body">
          <p className="disp-cascade-intro">
            {cascade.proveedorNombre && <strong>{cascade.proveedorNombre}</strong>}
            {' '}corrigió su disponibilidad {deltaTons > 0 ? 'al alza' : 'a la baja'} <DeltaBadge delta={deltaTons} />.
          </p>

          <div className="disp-cascade-card">
            <div className="disp-cascade-card-title"><CheckCircle2 size={15} /> Disponibilidad</div>
            <CascadeRow label="Toneladas estimadas" before={fmtTons(cascade.tonsDisponibleAntes)} after={fmtTons(cascade.tonsDisponibleDespues)} />
          </div>

          {cascade.tratoAjustado ? (
            <div className="disp-cascade-card">
              <div className="disp-cascade-card-title"><CheckCircle2 size={15} /> Trato</div>
              <CascadeRow label="Toneladas acordadas" before={fmtTons(cascade.tonsAcordadasAntes)} after={fmtTons(cascade.tonsAcordadasDespues)} />
            </div>
          ) : (
            <div className="disp-cascade-card disp-cascade-card--warning">
              <div className="disp-cascade-card-title"><TriangleAlert size={15} /> Trato</div>
              <p className="disp-cascade-note">No se modificó. {cascade.warning}</p>
            </div>
          )}

          {cascade.tratoAjustado && (
            cascade.programaAjustado ? (
              <div className="disp-cascade-card">
                <div className="disp-cascade-card-title"><CheckCircle2 size={15} /> Programa de cosecha activo</div>
                <CascadeRow label="Camiones" before={cascade.camionesAntes} after={cascade.camionesDespues} />
                <CascadeRow label="Toneladas del programa" before={fmtTons(cascade.tonsEstimadasAntes)} after={fmtTons(cascade.tonsEstimadasDespues)} />
                {fechaCambio && (
                  <CascadeRow label="Término estimado" before={fmtDateShort(cascade.vigenciaHastaAntes)} after={fmtDateShort(cascade.vigenciaHastaDespues)} />
                )}
              </div>
            ) : (
              <div className="disp-cascade-card disp-cascade-card--warning">
                <div className="disp-cascade-card-title"><TriangleAlert size={15} /> Programa de cosecha</div>
                <p className="disp-cascade-note">{cascade.warning || 'No hay un único programa activo para ajustar automáticamente; revísalo manualmente.'}</p>
              </div>
            )
          )}
        </div>

        <div className="mx-modal-footer">
          <button type="button" className="mx-btn mx-btn-primary" onClick={onClose}>Aceptar</button>
        </div>
      </div>
    </div>
  );
}
