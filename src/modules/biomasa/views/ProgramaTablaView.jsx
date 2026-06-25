import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Droplet,
  FileDown,
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

const PERIOD_LABELS = { month: 'Mes', week: 'Semana', all: 'Ver Todos' };

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
  onExportarPrograma,
  exportandoPrograma,
}) {
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setViewDropdownOpen(false);
      }
    };
    if (viewDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [viewDropdownOpen]);

  return (
    <div className="mx-table-card harvest-program-table-card">
      <div className="harvest-program-toolbar">
        <div className="harvest-program-controls">
          <div className="harvest-prog-view-dropdown" ref={dropdownRef}>
            <button
              className="harvest-prog-view-btn"
              onClick={() => setViewDropdownOpen(o => !o)}
            >
              <span>Vista: <strong>{PERIOD_LABELS[programPeriod]}</strong></span>
              <ChevronDown size={13} className={viewDropdownOpen ? 'rotated' : ''} />
            </button>
            {viewDropdownOpen && (
              <div className="harvest-prog-view-menu">
                {Object.entries(PERIOD_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    className={`harvest-prog-view-option${programPeriod === val ? ' active' : ''}`}
                    onClick={() => { setProgramPeriod(val); setViewDropdownOpen(false); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {programPeriod !== 'all' && (
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
          )}
        </div>
        <button
          className="mx-btn-icon sm"
          onClick={onExportarPrograma}
          disabled={exportandoPrograma}
          title="Exportar a Excel"
        >
          <FileDown size={16} />
        </button>
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
                  <td data-label="Proveedor / Centro">
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

                  <td className="harvest-prog-vol-cell" data-label="Volumen">
                    <div className="harvest-prog-vol-main">
                      {volume.estimated ? fmtTonsInt(volume.estimated) : '—'}
                      {hasDailyAdjustments && <span className="harvest-prog-adj-chip harvest-prog-adj-chip--inline">Ajustes</span>}
                    </div>
                    <div className="harvest-prog-vol-sub">
                      <span>{fmtTonsInt(volume.consumed)} plan.</span>
                      <span className={isOverEstimated ? 'is-over' : ''}>{volume.estimated ? fmtTonsInt(Math.abs(volume.balance)) : '—'} {isOverEstimated ? 'sobre' : 'saldo'}</span>
                    </div>
                    {volume.estimated > 0 && (
                      <div className="harvest-prog-vol-bar"><span style={{ width: `${volume.progress}%` }} /></div>
                    )}
                  </td>

                  <td className="harvest-prog-period-cell" data-label="Período">
                    <div className="harvest-prog-date-range">
                      <span className="harvest-prog-date-main">{fmtDateShort(p.vigenciaDesde)}</span>
                      {p.vigenciaHasta && <><span className="harvest-prog-date-arrow">→</span><span className="harvest-prog-date-main">{fmtDateShort(p.vigenciaHasta)}</span></>}
                      {showDaysAlert && (
                        <span className="harvest-prog-days-alert">
                          <AlertTriangle size={10} />
                          {daysLeft === 0 ? 'Hoy' : `${daysLeft}d`}
                        </span>
                      )}
                    </div>
                    <div className="harvest-prog-date-label">Inicio · Término</div>
                  </td>

                  <td className="harvest-prog-product-cell" data-label="Producto">
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

                  <td data-label="Estado">
                    <ProgramaEstadoBadge programa={p} />
                  </td>

                  <td className="harvest-prog-actions-cell" data-label="Acciones">
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
                  <div className="mx-empty-state">
                    <Droplet size={36} />
                    <p className="mx-empty-state__title">Sin programación disponible</p>
                    <p className="mx-empty-state__text">{programPeriod === 'all' ? 'No hay programas de cosecha registrados.' : 'No hay cosechas programadas para el periodo seleccionado.'}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
