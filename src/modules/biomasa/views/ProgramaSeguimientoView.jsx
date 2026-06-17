import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { mesLabel } from '../utils/fechasChile';
import { getProductClass, getTipoProductoLabel } from '../utils/productoLabels';
import { ADJUST_ACTION_LABELS } from '../utils/programaCalculos';

const FOLLOWUP_VIEW_LABELS = { month: 'Mes', week: 'Semana' };

export default function ProgramaSeguimientoView({
  followupPeriod,
  setFollowupPeriod,
  weekDays,
  mes,
  moveFollowupPeriod,
  followupSummary,
  followupPrograms,
  getTodayProgramCamiones,
  getLatestProgramNovelty,
  handleOpenAdjustModal,
  setSegProg,
  setShowSegModal,
  recentDailyAdjustments,
}) {
  const [followupViewDropdownOpen, setFollowupViewDropdownOpen] = useState(false);
  const followupViewDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (followupViewDropdownRef.current && !followupViewDropdownRef.current.contains(e.target)) {
        setFollowupViewDropdownOpen(false);
      }
    };
    if (followupViewDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [followupViewDropdownOpen]);

  return (
    <div className="harvest-followup-layout">
      <div className="harvest-followup-toolbar">
        <div className="harvest-followup-controls">
          <div className="harvest-prog-view-dropdown" ref={followupViewDropdownRef}>
            <button
              className="harvest-prog-view-btn"
              onClick={() => setFollowupViewDropdownOpen(o => !o)}
            >
              <span>Vista: <strong>{FOLLOWUP_VIEW_LABELS[followupPeriod]}</strong></span>
              <ChevronDown size={13} className={followupViewDropdownOpen ? 'rotated' : ''} />
            </button>
            {followupViewDropdownOpen && (
              <div className="harvest-prog-view-menu">
                {Object.entries(FOLLOWUP_VIEW_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    className={`harvest-prog-view-option${followupPeriod === val ? ' active' : ''}`}
                    onClick={() => { setFollowupPeriod(val); setFollowupViewDropdownOpen(false); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="harvest-followup-period">
            <button className="mx-btn-icon sm" onClick={() => moveFollowupPeriod(-1)} aria-label="Periodo anterior">
              <ChevronLeft size={16} />
            </button>
            <span>
              {followupPeriod === 'week'
                ? `Semana ${new Date(weekDays[0] + 'T12:00:00Z').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' })}`
                : mesLabel(mes, true)}
            </span>
            <button className="mx-btn-icon sm" onClick={() => moveFollowupPeriod(1)} aria-label="Periodo siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <section className="disponibilidad-kpi-grid followup-kpi-grid">
        <div className="disponibilidad-kpi disponibilidad-kpi--info">
          <span>Programas activos</span>
          <strong>{followupSummary.activePrograms}</strong>
        </div>
        <div className="disponibilidad-kpi disponibilidad-kpi--muted">
          <span>Ajustes período</span>
          <strong>{followupSummary.adjustments}</strong>
        </div>
        <div className={`disponibilidad-kpi disponibilidad-kpi--${followupSummary.netDelta < 0 ? 'danger' : followupSummary.netDelta > 0 ? 'success' : 'muted'}`}>
          <span>Delta camiones</span>
          <strong>{followupSummary.netDelta > 0 ? '+' : ''}{followupSummary.netDelta}</strong>
        </div>
        <div className="disponibilidad-kpi disponibilidad-kpi--muted">
          <span>Camiones hoy</span>
          <strong>{followupSummary.todayCamiones}</strong>
        </div>
      </section>

      <section className="mx-card harvest-followup-panel">
        <header className="mx-card-header">
          <div>
            <h4 className="mx-card-title">Mesa de ajustes diarios</h4>
            <p className="mx-card-description">Cambia solo el día operativo sin modificar todo el programa.</p>
          </div>
        </header>
        <div className="mx-table-wrap harvest-followup-table-wrap">
          <table className="mx-table harvest-followup-table">
            <thead>
              <tr>
                <th>Proveedor / Centro</th>
                <th>Producto</th>
                <th style={{ textAlign: 'center' }}>Base</th>
                <th style={{ textAlign: 'center' }}>Hoy</th>
                <th>Última novedad</th>
                <th style={{ textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {followupPrograms.map(p => (
                <tr key={`adj-${p._id}`}>
                  <td>
                    <div className="biomasa-prov-cell">
                      <div className="biomasa-avatar">
                        {p.proveedorNombre.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="biomasa-prov-name">{p.proveedorNombre}</div>
                        <div className="biomasa-centro-name">{p.centroNombre || 'Sin centro definido'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`harvest-product-pill ${getProductClass(p.tipoProducto)}`}>
                      {getTipoProductoLabel(p.tipoProducto)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="harvest-followup-number">{p.camionesDefault || 0} cam</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="harvest-followup-number today">{getTodayProgramCamiones(p)} cam</span>
                  </td>
                  <td>
                    <div className="harvest-followup-novelty">
                      {getLatestProgramNovelty(p)}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="harvest-followup-actions">
                      <button className="mx-btn mx-btn-primary sm" onClick={() => handleOpenAdjustModal(p)}>
                        <Plus size={14} /> Ajustar
                      </button>
                      <button className="mx-btn mx-btn-outline sm" onClick={() => { setSegProg(p); setShowSegModal(true); }}>
                        Nota
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!followupPrograms.length && (
                <tr>
                  <td colSpan="6" className="harvest-program-empty">
                    Sin programas activos para el periodo seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-card harvest-followup-panel">
        <header className="mx-card-header">
          <div>
            <h4 className="mx-card-title">Bitácora reciente</h4>
            <p className="mx-card-description">Últimos cambios diarios registrados.</p>
          </div>
        </header>
        <div className="harvest-adjustment-history">
          {recentDailyAdjustments.length ? recentDailyAdjustments.map((ajuste) => (
            <div key={ajuste._id || `${ajuste.programaId}-${ajuste.fecha}`} className="harvest-adjustment-item">
              <div>
                <strong>{ajuste.proveedorNombre}</strong>
                <span>{new Date(ajuste.fecha).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })} - {ADJUST_ACTION_LABELS[ajuste.accion] || 'Ajuste diario'}</span>
                <small>{ajuste.motivo || 'Sin motivo'}{ajuste.nota ? ` - ${ajuste.nota}` : ''}</small>
              </div>
              <b className={Number(ajuste.camionesDelta || 0) < 0 ? 'negative' : Number(ajuste.camionesDelta || 0) > 0 ? 'positive' : ''}>
                {ajuste.camionesAntes} -&gt; {ajuste.camionesDespues} cam
              </b>
            </div>
          )) : (
            <div className="harvest-month-empty">Sin ajustes diarios registrados.</div>
          )}
        </div>
      </section>
    </div>
  );
}
