import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { mesLabel } from '../utils/fechasChile';
import { getProductClass, getTipoProductoLabel } from '../utils/productoLabels';
import { ADJUST_ACTION_LABELS } from '../utils/programaCalculos';

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
  return (
    <div className="harvest-followup-layout">
      <div className="harvest-followup-toolbar">
        <div className="harvest-followup-controls">
          <div className="mx-toggle-group">
            <button className={`mx-toggle-btn ${followupPeriod === 'month' ? 'active' : ''}`} onClick={() => setFollowupPeriod('month')}>Vista Mes</button>
            <button className={`mx-toggle-btn ${followupPeriod === 'week' ? 'active' : ''}`} onClick={() => setFollowupPeriod('week')}>Vista Semana</button>
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

      <section className="harvest-followup-kpis">
        <div>
          <span>Programas activos</span>
          <strong>{followupSummary.activePrograms}</strong>
        </div>
        <div>
          <span>Ajustes periodo</span>
          <strong>{followupSummary.adjustments}</strong>
        </div>
        <div>
          <span>Delta camiones</span>
          <strong className={followupSummary.netDelta < 0 ? 'negative' : followupSummary.netDelta > 0 ? 'positive' : ''}>
            {followupSummary.netDelta > 0 ? '+' : ''}{followupSummary.netDelta}
          </strong>
        </div>
        <div>
          <span>Camiones hoy</span>
          <strong>{followupSummary.todayCamiones}</strong>
        </div>
      </section>

      <section className="mx-card harvest-followup-panel">
        <header className="mx-card-header">
          <div>
            <h4 className="mx-card-title">Mesa de ajustes diarios</h4>
            <p className="mx-card-description">Cambia solo el dia operativo sin modificar todo el programa.</p>
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
                <th>Ultima novedad</th>
                <th style={{ textAlign: 'right' }}>Accion</th>
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
            <h4 className="mx-card-title">Bitacora reciente</h4>
            <p className="mx-card-description">Ultimos cambios diarios registrados.</p>
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
