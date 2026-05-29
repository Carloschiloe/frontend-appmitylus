import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  CheckCircle2,
  Edit,
  Trash,
  AlertTriangle,
} from 'lucide-react';
import {
  mesLabel, fmtDateShort, todayKey,
  daysUntilKey, toChileDateKey,
} from '../utils/fechasChile';
import {
  getProductClass, getProductChipLabel, getTipoProductoLabel,
} from '../utils/productoLabels';
import {
  fmtTonsInt, fmtNumber, calcTotalToneladasDia,
  getProgramVolumeProgress, getEffectiveTonsPerTruck,
} from '../utils/programaCalculos';
import ProgramaEstadoBadge from '../components/ProgramaEstadoBadge';

export default function ProgramaTablaView({
  programPeriod, setProgramPeriod,
  weekDays,
  mes,
  moveProgramPeriod,
  programasPeriodo,
  tonsPerTruck,
  getProgramCamionesStatus,
  tratosAcordados,
  handleOpenModal,
  handleOpenFinalizeModal,
  handleStatusChange,
  setPauseModal,
  setPauseForm,
  setConfirmDelete,
}) {
  return (
    <div className="mx-table-card harvest-program-table-card">
      <div className="harvest-program-toolbar">
        <div className="harvest-program-controls">
          <div className="mx-toggle-group">
            <button className={`mx-toggle-btn ${programPeriod === 'month' ? 'active' : ''}`} onClick={() => setProgramPeriod('month')}>Vista Mes</button>
            <button className={`mx-toggle-btn ${programPeriod === 'week' ? 'active' : ''}`} onClick={() => setProgramPeriod('week')}>Vista Semana</button>
          </div>
          <div className="harvest-program-period">
            <button className="mx-btn-icon sm" onClick={() => moveProgramPeriod(-1)} aria-label="Periodo anterior">
              <ChevronLeft size={16} />
            </button>
            <span>
              {programPeriod === 'week'
                ? `Semana ${new Date(weekDays[0] + 'T12:00:00Z').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' })}`
                : mesLabel(mes, true)}
            </span>
            <button className="mx-btn-icon sm" onClick={() => moveProgramPeriod(1)} aria-label="Periodo siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="mx-table-wrap">
        <table className="mx-table harvest-prog-table">
          <thead>
            <tr>
              <th className="harvest-prog-col-provider">Proveedor / Centro</th>
              <th className="harvest-prog-col-volume">Volumen</th>
              <th className="harvest-prog-col-period">Período</th>
              <th className="harvest-prog-col-product">Producto</th>
              <th className="harvest-prog-col-status">Estado</th>
              <th className="harvest-prog-col-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {programasPeriodo.map(p => {
              const effectiveTpt = getEffectiveTonsPerTruck(p, tonsPerTruck);
              const volume = getProgramVolumeProgress(p, effectiveTpt);
              const isOverEstimated = volume.estimated > 0 && volume.balance < 0;
              const hasDailyAdjustments = Array.isArray(p.ajustesDiarios) && p.ajustesDiarios.length > 0;
              const camionesStatus = getProgramCamionesStatus(p);
              const hastaKey = p.vigenciaHasta ? toChileDateKey(p.vigenciaHasta) : '';
              const daysLeft = p.estado === 'activo' ? daysUntilKey(hastaKey) : null;
              const totalTDia = calcTotalToneladasDia(p.transportes);
              const showDaysAlert = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
              return (
                <tr key={p._id} className={`harvest-prog-row${p.estado === 'finalizado' ? ' is-finalizado' : ''}`}>
                  <td>
                    <div className="harvest-prog-name">{p.proveedorNombre || 'Proveedor Desconocido'}</div>
                    {(p.centroNombre || p.centroCodigo) && (
                      <div className="harvest-prog-centro">{p.centroNombre || p.centroCodigo}</div>
                    )}
                    {(() => {
                      const trato = tratosAcordados.find(t => String(t._id) === String(p.tratoId));
                      const contacto = trato?.contactoNombre;
                      return contacto ? <div className="harvest-prog-contact">{contacto}</div> : null;
                    })()}
                  </td>

                  <td className="harvest-prog-vol-cell">
                    <div className="harvest-prog-vol-main">{volume.estimated ? fmtTonsInt(volume.estimated) : '—'}</div>
                    <div className="harvest-prog-vol-sub">
                      <span>{fmtTonsInt(volume.consumed)} plan.</span>
                      <span className={isOverEstimated ? 'is-over' : ''}>{volume.estimated ? fmtTonsInt(Math.abs(volume.balance)) : '—'} {isOverEstimated ? 'sobre' : 'saldo'}</span>
                    </div>
                    {volume.estimated > 0 && (
                      <div className="harvest-prog-vol-bar"><span style={{ width: `${volume.progress}%` }} /></div>
                    )}
                    {hasDailyAdjustments && <span className="harvest-prog-adj-chip">Ajustes</span>}
                  </td>

                  <td className="harvest-prog-period-cell">
                    <div className="harvest-prog-date-main">{fmtDateShort(p.vigenciaDesde)}</div>
                    {p.vigenciaHasta && (
                      <div className="harvest-prog-date-sub">→ {fmtDateShort(p.vigenciaHasta)}</div>
                    )}
                    <div className="harvest-prog-date-label">Inicio · Término</div>
                    {showDaysAlert && (
                      <div className="harvest-prog-days-alert">
                        <AlertTriangle size={10} />
                        {daysLeft === 0 ? 'Hoy' : `${daysLeft}d`}
                      </div>
                    )}
                  </td>

                  <td className="harvest-prog-product-cell">
                    <span className={`prog-product-chip ${getProductClass(p.tipoProducto)}`}>
                      {getProductChipLabel(p.tipoProducto)} <em>{getTipoProductoLabel(p.tipoProducto)}</em>
                    </span>
                    <div className="harvest-prog-ops">
                      <span className="harvest-prog-cam">{camionesStatus.base} cam/día</span>
                      {totalTDia > 0 && <span className="harvest-prog-cam" style={{ color: 'var(--color-text-subtle)' }}>{fmtNumber(totalTDia, 0)} t/día</span>}
                      {camionesStatus.adjusted && (
                        <span className="harvest-prog-cam-today">hoy {camionesStatus.today}</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <ProgramaEstadoBadge programa={p} />
                  </td>

                  <td className="harvest-prog-actions-cell">
                    <div className="biomasa-action-bar">
                      {p.estado === 'activo' && (
                        <button className="mx-action-btn pause" title="Pausar" onClick={() => { setPauseForm({ pausadoDesde: todayKey(), motivoPausa: '' }); setPauseModal({ id: p._id, proveedorNombre: p.proveedorNombre }); }}><Pause size={14} /></button>
                      )}
                      {p.estado === 'pausado' && (
                        <button className="mx-action-btn play" title="Reanudar" onClick={() => handleStatusChange(p._id, 'activo')}><Play size={14} /></button>
                      )}
                      {p.estado === 'finalizado' && (
                        <button className="mx-action-btn play" title="Reabrir programa" onClick={() => handleStatusChange(p._id, 'activo')}><RotateCcw size={14} /></button>
                      )}
                      {(p.estado === 'activo' || p.estado === 'pausado') && (
                        <button className="mx-action-btn" title="Finalizar programa" style={{ color: 'var(--color-success)' }} onClick={() => handleOpenFinalizeModal(p)}><CheckCircle2 size={14} /></button>
                      )}
                      {p.estado !== 'finalizado' && (
                        <button className="mx-action-btn edit" title="Editar" onClick={() => handleOpenModal(p)}><Edit size={14} /></button>
                      )}
                      <button className="mx-action-btn delete" title="Eliminar" onClick={() => setConfirmDelete(p)}><Trash size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!programasPeriodo.length && (
              <tr>
                <td colSpan="6">
                  <div className="mx-state-placeholder">Sin programas para el periodo seleccionado.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
