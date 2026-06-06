import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Activity,
  Calendar as CalendarIcon,
  Maximize2,
  Minimize2,
  Info,
  AlertTriangle,
} from 'lucide-react';
import {
  mesLabel, todayKey, calendarDayToneClass, getISOWeek,
} from '../utils/fechasChile';
import {
  getProductClass, getProductChipLabel, getTipoProductoLabel,
} from '../utils/productoLabels';
import {
  fmtTonsInt, fmtNumber,
  summarizeHarvestItems,
  getSanitarioEstado, getSanitarioLabel, isSanitarioRelevant,
  formatMuestreoResumen, formatMuestreoFecha, tonsPorCamionDeTipo,
} from '../utils/programaCalculos';
import DonutChart from '../components/DonutChart';

export default function ProgramaCalendarioView({
  calView, setCalView,
  mes, setMes,
  weekDays,
  currentWeekOffset, setCurrentWeekOffset,
  calendarMetric, setCalendarMetric,
  isCalendarBoard, calendarBoardRef,
  handleCalendarBoardToggle,
  monthData,
  calData,
  filteredProgramIds,
  enrichCalendarItem,
  filterProducto, setFilterProducto,
  selectedDay, setSelectedDay,
  weekData,
  programasById,
  handleStatusChange,
  handleReactivateDay,
  handleQuickAdjust,
  handleQuickAdjustTipo,
  tiposTransporte = [],
  setSuspendPopover,
  notasDia,
  setNotaPopover,
  weekSummaries,
  weekSummaryFull,
  allWeekProviders,
  filterProveedor, setFilterProveedor,
  allWeekProducts,
  monthSummary,
  allMonthProviders,
  showAllProviders, setShowAllProviders,
  allMonthProducts,
  handleOpenAdjustModal,
}) {
  const [truckPopover, setTruckPopover] = useState(null);

  // Tipos de transporte activos con su capacidad (t/camión) ya calculada.
  const tiposActivos = (tiposTransporte || [])
    .filter((t) => t && (t.activo === undefined || t.activo))
    .map((t) => ({
      tipoTransporteId: String(t._id || t.id || ''),
      tipoTransporteNombre: t.nombre || '',
      toneladasPorCamion: tonsPorCamionDeTipo(t),
    }))
    .filter((t) => t.tipoTransporteId);

  const openTruckPopover = (mode, programa, fecha, opciones, evt) => {
    const r = evt.currentTarget.getBoundingClientRect();
    setTruckPopover({ mode, programa, fecha, opciones, x: r.left, y: r.bottom + 6 });
  };

  // "+" : 0 tipos → legacy; 1 tipo → directo; varios → popover selector.
  const handleAddTruck = (programa, fecha, currentCamiones, evt) => {
    if (!handleQuickAdjustTipo || tiposActivos.length === 0) {
      handleQuickAdjust(programa, fecha, +1, currentCamiones);
      return;
    }
    if (tiposActivos.length === 1) {
      handleQuickAdjustTipo(programa, fecha, 'sumar', tiposActivos[0]);
      return;
    }
    openTruckPopover('add', programa, fecha, tiposActivos, evt);
  };

  // "−" : sin desglose → legacy; 1 línea → resta ese tipo; varias → popover.
  const handleRemoveTruck = (programa, fecha, cell, evt) => {
    const lineas = Array.isArray(cell?.lineasTransporteDia) ? cell.lineasTransporteDia : null;
    if (!handleQuickAdjustTipo || !lineas || lineas.length === 0) {
      handleQuickAdjust(programa, fecha, -1, cell.camiones);
      return;
    }
    const opciones = lineas.map((l) => ({
      tipoTransporteId: String(l.tipoTransporteId || ''),
      tipoTransporteNombre: l.tipoTransporteNombre || '',
      toneladasPorCamion: l.toneladasPorCamion ?? null,
      cantidad: Number(l.cantidad || 0),
    }));
    if (opciones.length === 1) {
      handleQuickAdjustTipo(programa, fecha, 'suspender', opciones[0]);
      return;
    }
    openTruckPopover('remove', programa, fecha, opciones, evt);
  };

  const onSelectTruck = (opt) => {
    if (!truckPopover) return;
    const accion = truckPopover.mode === 'remove' ? 'suspender' : 'sumar';
    handleQuickAdjustTipo(truckPopover.programa, truckPopover.fecha, accion, opt);
    setTruckPopover(null);
  };

  return (
    <div ref={calendarBoardRef} className={`harvest-calendar-shell ${calView === 'week' ? 'week-mode' : 'month-mode'} ${isCalendarBoard ? 'board-mode' : ''}`}>
      <div className="mx-card harvest-calendar-main">
        <div className="harvest-calendar-toolbar">
          <div className="harvest-calendar-controls">
            <div className="mx-toggle-group">
              <button className={`mx-toggle-btn ${calView === 'month' ? 'active' : ''}`} onClick={() => setCalView('month')}>Vista Mes</button>
              <button className={`mx-toggle-btn ${calView === 'week' ? 'active' : ''}`} onClick={() => setCalView('week')}>Vista Semana</button>
            </div>
            <div className="harvest-calendar-period">
              <button className="mx-btn-icon sm" onClick={() => {
                if (calView === 'month') {
                  setMes(prev => {
                    const [y, m] = prev.split('-');
                    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 2, 1);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  });
                } else {
                  setCurrentWeekOffset(o => o - 1);
                }
              }}><ChevronLeft size={16} /></button>
              {calView === 'week' && weekDays.length ? (
                <div className="harvest-week-title-wrap">
                  <CalendarIcon size={14} className="harvest-week-title-icon" />
                  <div>
                    <div className="harvest-calendar-title">
                      SEMANA {getISOWeek(weekDays[0])} · {new Date(weekDays[0] + 'T12:00:00Z').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}
                    </div>
                    <div className="harvest-week-subtitle">
                      {new Date(weekDays[0] + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })} — {new Date(weekDays[6] + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="harvest-calendar-title">{mesLabel(mes, true)}</span>
              )}
              <button className="mx-btn-icon sm" onClick={() => {
                if (calView === 'month') {
                  setMes(prev => {
                    const [y, m] = prev.split('-');
                    const d = new Date(parseInt(y, 10), parseInt(m, 10), 1);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  });
                } else {
                  setCurrentWeekOffset(o => o + 1);
                }
              }}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="harvest-calendar-actions">
            <select className="mx-select sm" value={calendarMetric} onChange={e => setCalendarMetric(e.target.value)} style={{ fontSize: '13px', padding: '4px 8px' }}>
              <option value="camiones">Camiones</option>
              <option value="tons">Tons</option>
              <option value="both">Cam + Tons</option>
            </select>
            {calView === 'week' && <button className="mx-btn mx-btn-outline sm" onClick={() => setCurrentWeekOffset(0)}>Hoy</button>}
            <button className="mx-btn-icon sm" onClick={handleCalendarBoardToggle} title={isCalendarBoard ? 'Salir pantalla completa' : 'Pantalla completa'}>
              {isCalendarBoard ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {calView === 'month' ? (
          <>
          <div className="cal-month-grid">
            {['LUN','MAR','MIE','JUE','VIE','SAB','DOM'].map(d => (
              <div key={d} className={`cal-header-day ${d === 'DOM' ? 'calendar-red-day' : ''}`}>{d}</div>
            ))}
            {Array.from({ length: monthData.padding }).map((_, i) => (
              <div key={`pad-${i}`} className="cal-pad-day" />
            ))}
            {monthData.days.map((dayNum) => {
              const dateKey = `${mes}-${String(dayNum).padStart(2, '0')}`;
              const dayDataObj = calData[dateKey] || { total: 0, items: [] };
              const dayItems = (dayDataObj.items || []).filter(it => filteredProgramIds.has(String(it.programaId))).map(enrichCalendarItem).filter(it => !filterProducto || it.tipoProducto === filterProducto);
              const daySummary = summarizeHarvestItems(dayItems);
              const isSelected = selectedDay?.key === dateKey;
              const isToday = dateKey === todayKey();
              const totalCam = daySummary.camiones;
              const totalTons = daySummary.tons;
              const hasSuspended = dayItems.some(it => it.cancelado || (it.esDiaEspecial && it.camiones === 0));
              const primaryProduct = daySummary.products[0]?.key || 'sin_definir';

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDay(prev => prev?.key === dateKey ? null : { key: dateKey, items: dayItems, total: totalCam, summary: daySummary })}
                  className={`cal-day-cell ${calendarDayToneClass(dateKey)} ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''} ${totalCam > 0 ? `has-data ${getProductClass(primaryProduct)}` : ''}`}
                >
                  <div className="cal-month-cell-top">
                    <span className="cal-day-num">{dayNum}</span>
                  </div>
                  {totalCam > 0 ? (
                    <div className="cal-month-body">
                      <div className="cal-month-camrow">
                        <strong className="cal-month-main">
                          {calendarMetric === 'tons' ? fmtTonsInt(totalTons) : totalCam}
                        </strong>
                        {calendarMetric !== 'tons' && <span className="cal-month-label">cam</span>}
                      </div>
                      {calendarMetric === 'both' && totalTons > 0 && (
                        <div className="cal-month-tons">{fmtTonsInt(totalTons)}</div>
                      )}
                      <div className="cal-month-products-list">
                        {(daySummary.products.some(p => p.key !== 'sin_definir')
                          ? daySummary.products.filter(p => p.key !== 'sin_definir')
                          : daySummary.products
                        ).map(prod => (
                          <span key={prod.key} className={`cal-chip ${getProductClass(prod.key)}`}>
                            {getProductChipLabel(prod.key)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : hasSuspended ? (
                    <div className="cal-month-susp">Susp.</div>
                  ) : (
                    <div className="cal-day-empty">—</div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="cal-month-legend">
            <span className="cal-legend-item"><span className="cal-chip product-entero">E</span> Entero</span>
            <span className="cal-legend-item"><span className="cal-chip product-carne">C</span> Carne</span>
            <span className="cal-legend-item"><span className="cal-chip product-mc">MC</span> Media Concha</span>
            <span className="cal-legend-item"><span className="cal-chip product-sin_definir">SD</span> Sin definir</span>
            <span className="cal-legend-item cal-legend-dash">— Sin actividad</span>
          </div>
          </>
        ) : (
          <div className="harvest-week-v2">
            <div className="harvest-week-v2-head">
              <div className="harvest-week-v2-label" />
              {weekDays.map(d => {
                const isToday = d === todayKey();
                return (
                  <div key={d} className={`harvest-week-v2-daycol ${calendarDayToneClass(d)} ${isToday ? 'is-today' : ''}`}>
                    <div className="harvest-week-v2-dayname">{new Date(d + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase()}</div>
                    <div className="harvest-week-v2-daynum">{d.split('-')[2]}</div>
                  </div>
                );
              })}
              <div className="harvest-week-v2-daycol harvest-week-v2-semcol">
                <div className="harvest-week-v2-dayname">SEM</div>
                <div className="harvest-week-v2-daynum">Σ</div>
              </div>
            </div>

            {Object.entries(weekData).filter(([, data]) => !filterProducto || data.tipoProducto === filterProducto).map(([id, data]) => {
              const programa = programasById.get(id);
              const rowTotal = data.dias.reduce((s, c) => ({ camiones: s.camiones + Number(c.camiones || 0), tons: s.tons + Number(c.tonsDia || 0) }), { camiones: 0, tons: 0 });
              return (
                <div key={id} className="harvest-week-v2-row">
                  <div className={`harvest-week-v2-prov ${getProductClass(data.tipoProducto)} ${programa?.estado === 'pausado' ? 'is-pausado' : ''}`}>
                    <div className="harvest-week-v2-prov-name">{data.nombre}</div>
                    <span className="wk-prov-tooltip">{data.nombre}</span>
                    <div className="harvest-week-v2-prov-centro">{data.centro || '—'}</div>
                    {formatMuestreoResumen(data) && (
                      <div className="wk-prov-muestreo">
                        Últ. muestreo{formatMuestreoFecha(data.muestreoFecha, 'short') ? ` ${formatMuestreoFecha(data.muestreoFecha, 'short')}` : ''}: {formatMuestreoResumen(data)}
                      </div>
                    )}
                    {programa?.estado === 'pausado' ? (
                      <div className="wk-prov-pausa-info">
                        <span className="wk-prov-pausa-badge">PAUSADO</span>
                        {programa.pausadoDesde && <span className="wk-prov-pausa-desde">desde {new Date(programa.pausadoDesde).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' })}</span>}
                        <button className="wk-btn wk-btn-react" onClick={() => handleStatusChange(programa._id, 'activo')}>↺ Reactivar</button>
                      </div>
                    ) : programa?.estado === 'finalizado' ? (
                      <div className="wk-prov-pausa-info">
                        <span className="wk-prov-pausa-badge" style={{ background: 'var(--color-muted-bg, #f0f0f0)', color: 'var(--color-text-muted)' }}>FINALIZADO</span>
                        {programa.vigenciaHasta && <span className="wk-prov-pausa-desde">hasta {new Date(programa.vigenciaHasta).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' })}</span>}
                      </div>
                    ) : (
                      <span className={`wk-product-chip ${getProductClass(data.tipoProducto)}`}>{getTipoProductoLabel(data.tipoProducto)}</span>
                    )}
                  </div>
                  {data.dias.map((cell, i) => {
                    const dia = weekDays[i];
                    const pausaKey = programa?.estado === 'pausado' && programa?.pausadoDesde ? programa.pausadoDesde.slice(0, 10) : null;
                    const vigHastaKey = programa?.estado === 'finalizado' && programa?.vigenciaHasta ? programa.vigenciaHasta.slice(0, 10) : null;
                    const isPausedFuture = pausaKey !== null && dia >= pausaKey;
                    const isFinishedFuture = vigHastaKey !== null && dia > vigHastaKey;
                    const isReadOnly = programa?.estado === 'finalizado' || programa?.estado === 'pausado';
                    const isSusp = cell.esDiaEspecial && cell.camiones === 0;
                    const isToday = dia === todayKey();
                    return (
                      <div key={i} className={`harvest-week-v2-cell ${isToday ? 'is-today' : ''} ${isSusp ? 'is-susp' : ''} ${isPausedFuture || isFinishedFuture ? 'is-prog-pausado' : ''}`}>
                        {isPausedFuture ? (
                          <span className="wk-estado-label pausado">Pausado</span>
                        ) : isFinishedFuture ? (
                          <span className="wk-estado-label finalizado">Finalizado</span>
                        ) : isSusp ? (
                          <>
                            <div className="harvest-week-v2-susp">{cell.ajusteMotivo || 'Suspendido'}</div>
                            {programa && (
                              <button className="wk-btn wk-btn-react" onClick={() => handleReactivateDay(programa, dia)}>↺ Reactivar</button>
                            )}
                          </>
                        ) : cell.camiones > 0 || programa ? (
                          <>
                            {cell.camiones > 0 ? (
                              <div className="harvest-week-v2-count">
                                {calendarMetric === 'tons' ? (
                                  <strong>{fmtTonsInt(cell.tonsDia)}</strong>
                                ) : calendarMetric === 'both' ? (
                                  <><strong>{cell.camiones}</strong><span>CAM</span>{cell.tonsDia > 0 && <span className="wk-tons-sub">{fmtTonsInt(cell.tonsDia)}</span>}</>
                                ) : (
                                  <strong>{cell.camiones}</strong>
                                )}
                              </div>
                            ) : (
                              <span className="harvest-week-v2-empty">—</span>
                            )}
                            {cell.esDiaEspecial && cell.camiones > 0 && <div className="harvest-week-v2-adj">★ {cell.ajusteMotivo || 'Ajuste'}</div>}
                            {programa && !isReadOnly && (
                              <div className="harvest-week-v2-actions">
                                <button className="wk-btn" onClick={(e) => handleRemoveTruck(programa, dia, cell, e)}>
                                  <span>−</span>
                                  <span className="wk-btn-tip">Quitar 1 camión</span>
                                </button>
                                <button className="wk-btn wk-btn-add" onClick={(e) => handleAddTruck(programa, dia, cell.camiones, e)}>
                                  <span>+</span>
                                  <span className="wk-btn-tip">Sumar 1 camión</span>
                                </button>
                                <button className="wk-btn wk-btn-susp" onClick={e => {
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setSuspendPopover({ programa, fecha: dia, x: r.left, y: r.bottom + 6, motivo: 'Clima', nota: '' });
                                }}>
                                  <span>⊘</span>
                                  <span className="wk-btn-tip">Suspender este día</span>
                                </button>
                              </div>
                            )}
                          </>
                        ) : <span className="harvest-week-v2-empty">—</span>}
                      </div>
                    );
                  })}
                  <div className="harvest-week-v2-cell harvest-week-v2-total">
                    {calendarMetric === 'tons' ? fmtTonsInt(rowTotal.tons) : calendarMetric === 'both' ? <>{rowTotal.camiones} <span style={{fontSize:'0.75em'}}>cam</span>{rowTotal.tons > 0 && <span className="wk-tons-sub">{fmtTonsInt(rowTotal.tons)}</span>}</> : rowTotal.camiones}
                  </div>
                </div>
              );
            })}

            <div className="harvest-week-v2-row harvest-week-v2-footer">
              <div className="harvest-week-v2-label">Total día</div>
              {weekDays.map(d => {
                const s = weekSummaries.daily[d] || { camiones: 0, tons: 0 };
                return (
                  <div key={d} className={`harvest-week-v2-cell ${calendarDayToneClass(d)}`}>
                    <strong>{calendarMetric === 'tons' ? fmtTonsInt(s.tons) : calendarMetric === 'both' ? <>{s.camiones} cam{s.tons > 0 && <span className="wk-tons-sub">{fmtTonsInt(s.tons)}</span>}</> : s.camiones}</strong>
                  </div>
                );
              })}
              <div className="harvest-week-v2-cell harvest-week-v2-total">
                <strong>{calendarMetric === 'tons' ? fmtTonsInt(weekSummaries.total.tons) : calendarMetric === 'both' ? <>{weekSummaries.total.camiones} cam{weekSummaries.total.tons > 0 && <span className="wk-tons-sub">{fmtTonsInt(weekSummaries.total.tons)}</span>}</> : weekSummaries.total.camiones}</strong>
              </div>
            </div>

            <div className="harvest-week-v2-row harvest-week-v2-notas">
              <div className="harvest-week-v2-label wk-nota-label">Nota del día</div>
              {weekDays.map(d => {
                const nota = notasDia?.[d];
                return (
                  <div key={d} className={`harvest-week-v2-cell wk-nota-cell ${calendarDayToneClass(d)}`}>
                    {nota ? (
                      <div className="wk-nota-content">
                        <span className="wk-nota-text" title={nota.nota}>{nota.nota}</span>
                        <button className="wk-nota-btn" title="Editar nota" onClick={e => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setNotaPopover({ fechaKey: d, nota: nota.nota, x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 6 });
                        }}>✏</button>
                      </div>
                    ) : (
                      <button className="wk-nota-add" title="Agregar nota del día" onClick={e => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setNotaPopover({ fechaKey: d, nota: '', x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 6 });
                      }}>＋</button>
                    )}
                  </div>
                );
              })}
              <div className="harvest-week-v2-cell" />
            </div>
          </div>
        )}
      </div>

      {(calView === 'month' || calView === 'week') && (
        <aside className="hds-panel">
          {selectedDay ? (
            <>
              <div className="hds-detail-header">
                <div>
                  <div className="hds-detail-date">
                    {new Date(selectedDay.key + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <button className="hds-back-btn" onClick={() => setSelectedDay(null)}>
                  <ChevronLeft size={14} /> Mes
                </button>
              </div>
              <div className="cal-detail-wrap">
                {selectedDay.items.length === 0 ? (
                  <div className="cal-detail-empty">
                    <Activity size={28} style={{ opacity: 0.25 }} />
                    <p>Sin cosechas este día</p>
                  </div>
                ) : (
                  selectedDay.items.map((it, idx) => (
                    <div key={idx} className={`cal-detail-card ${getProductClass(it.tipoProducto)}${it.estado === 'finalizado' ? ' is-finalizado' : ''}`}>
                      <div className="cal-detail-card-top">
                        <div className="cal-detail-card-info">
                          <div className="cal-detail-card-name">{it.proveedorNombre}</div>
                          <div className="cal-detail-card-center">{it.centroNombre || it.centroCodigo || 'Sin centro'}</div>
                          {Array.isArray(it.lineasTransporteDia) && it.lineasTransporteDia.length > 0 && (
                            <div className="cal-detail-card-transporte">
                              {it.lineasTransporteDia.map((l, i) => (
                                <div key={i} className="cal-detail-card-transporte-line">
                                  {Number(l.cantidad || 0)} {l.tipoTransporteNombre || 'Sin tipo'}
                                  {l.toneladasPorCamion != null
                                    ? ` · ${fmtTonsInt(Number(l.cantidad || 0) * Number(l.toneladasPorCamion || 0))}`
                                    : ''}
                                </div>
                              ))}
                            </div>
                          )}
                          {formatMuestreoResumen(it) && (
                            <div className="cal-detail-card-muestreo">
                              Últ. muestreo{formatMuestreoFecha(it.muestreoFecha, 'long') ? ` ${formatMuestreoFecha(it.muestreoFecha, 'long')}` : ''}: {formatMuestreoResumen(it)}
                            </div>
                          )}
                        </div>
                        <div className="cal-detail-card-count">
                          <div className="cal-detail-card-count-main">
                            {calendarMetric === 'tons' ? (
                              <>
                                <strong>{Math.round(Number(it.tonsDia) || 0)}</strong>
                                <span>t</span>
                              </>
                            ) : (
                              <>
                                <strong>{it.camiones}</strong>
                                <span>cam</span>
                              </>
                            )}
                          </div>
                          {calendarMetric === 'both' && Number(it.tonsDia) > 0 && (
                            <span className="cal-detail-card-count-sec">{fmtTonsInt(it.tonsDia)}</span>
                          )}
                        </div>
                      </div>
                      <div className="cal-detail-card-badges">
                        <span className={`mx-badge ${getProductClass(it.tipoProducto)}`}>{getTipoProductoLabel(it.tipoProducto)}</span>
                        {it.estado === 'finalizado' && <span className="mx-badge mx-badge-muted">Finalizado</span>}
                        {isSanitarioRelevant(it.sanitario) && (
                          <span className={`mx-badge harvest-sanitary-badge ${getSanitarioEstado(it.sanitario)}`}>
                            <AlertTriangle size={10} /> {getSanitarioLabel(it.sanitario)}
                          </span>
                        )}
                      </div>
                      {it.esDiaEspecial && (
                        <div className="cal-detail-card-note">
                          ✱ {it.ajusteMotivo || 'Ajuste diario'}{it.motivo ? `: ${it.motivo}` : ''}
                        </div>
                      )}
                      {it.estado !== 'finalizado' && (
                        <button
                          type="button"
                          className="mx-btn mx-btn-outline sm"
                          style={{ marginTop: 10, width: '100%' }}
                          onClick={() => handleOpenAdjustModal(programasById.get(String(it.programaId)), selectedDay.key, it.camiones)}
                        >
                          Ajustar día
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : calView === 'week' ? (
            <div className="hds-body">
              <div className="hds-header">
                <div className="hds-header-icon"><Activity size={16} /></div>
                <span className="hds-header-title">RESUMEN DE LA SEMANA</span>
              </div>
              <div className="hds-kpi-hero">
                <span className="hds-kpi-big">{fmtNumber(weekSummaryFull.total.tons, 0)}</span>
                <span className="hds-kpi-unit">t</span>
                <span className="hds-kpi-sub">{weekSummaryFull.total.camiones} camiones · {weekSummaryFull.providers.length} proveedores</span>
              </div>
              <div className="hds-kpi-row">
                <div className="hds-kpi-card"><strong>{fmtNumber(weekSummaryFull.promedioDiario, 0)} t</strong><span>Promedio diario</span></div>
                <div className="hds-kpi-card"><strong>{weekSummaryFull.total.camiones}</strong><span>Camiones totales</span></div>
                <div className="hds-kpi-card">
                  <strong>{fmtNumber(weekSummaryFull.maximoDia, 0)} t</strong>
                  <span>Máximo día{weekSummaryFull.maximoDiaKey ? ` (${new Date(weekSummaryFull.maximoDiaKey + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase()})` : ''}</span>
                </div>
              </div>
              <section className="hds-section">
                <div className="hds-section-head">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    DISTRIBUCIÓN POR PROVEEDOR
                    <Info size={12} style={{ opacity: 0.45, flexShrink: 0, cursor: 'default' }} title="Participación del proveedor sobre el total planificado del período. No corresponde a consumo real ni avance del programa." />
                  </span>
                  {filterProveedor && (
                    <button className="hds-link-btn hds-filter-clear" onClick={() => setFilterProveedor(null)}>× Limpiar</button>
                  )}
                </div>
                {allWeekProviders.length === 0 ? (
                  <p className="hds-empty">Sin cosechas esta semana.</p>
                ) : (
                  allWeekProviders.map(provider => {
                    const totalT = allWeekProviders.reduce((s, p) => s + p.tons, 0);
                    const pct = totalT > 0 ? Math.round(provider.tons / totalT * 100) : 0;
                    const isActive = filterProveedor === provider.nombre;
                    return (
                      <div
                        key={provider.nombre}
                        className={`hds-provider-row hds-provider-clickable ${isActive ? 'is-filter-active' : ''}`}
                        onClick={() => setFilterProveedor(v => v === provider.nombre ? null : provider.nombre)}
                        title={isActive ? 'Click para mostrar todos' : 'Click para filtrar por este proveedor'}
                      >
                        <div className="hds-provider-top">
                          <span className="hds-provider-name">{provider.nombre}</span>
                          <strong className="hds-provider-val">{fmtNumber(provider.tons, 0)} t · {pct}%</strong>
                        </div>
                        <div className="hds-provider-bar">
                          <div className="hds-provider-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
              <section className="hds-section">
                <div className="hds-section-head">
                  <span>MIX DE PRODUCTOS</span>
                  {filterProducto && (
                    <button className="hds-link-btn hds-filter-clear" onClick={() => setFilterProducto(null)}>× Limpiar</button>
                  )}
                </div>
                {allWeekProducts.products.length === 0 ? (
                  <p className="hds-empty">Sin productos definidos.</p>
                ) : (
                  <div className="hds-donut-area">
                    <DonutChart products={allWeekProducts.products} totalTons={allWeekProducts.total} activeKey={filterProducto} />
                    <div className="hds-donut-legend">
                      {allWeekProducts.products.map(p => {
                        const pct = allWeekProducts.total > 0 ? Math.round(p.tons / allWeekProducts.total * 100) : 0;
                        const isActive = filterProducto === p.key;
                        const isDimmed = filterProducto && !isActive;
                        return (
                          <div
                            key={p.key}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isActive}
                            className={`hds-legend-row hds-legend-row--filter ${isActive ? 'is-active' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                            onClick={() => setFilterProducto(v => v === p.key ? null : p.key)}
                            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFilterProducto(v => v === p.key ? null : p.key)}
                            title={isActive ? `Quitar filtro ${getTipoProductoLabel(p.key)}` : `Filtrar calendario por ${getTipoProductoLabel(p.key)}`}
                          >
                            <span className={`hds-legend-dot ${getProductClass(p.key)}`} />
                            <span className="hds-legend-label">{getTipoProductoLabel(p.key)}</span>
                            <span className="hds-legend-pct">{pct}% <em>({fmtNumber(p.tons, 0)} t)</em></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
              <section className="hds-section">
                <div className="hds-section-head"><span>ALERTAS</span></div>
                {weekSummaryFull.sanitaryOk.map((alert, i) => (
                  <div key={`ok-${i}`} className="hds-alert-chip verde">
                    <span className="hds-alert-dot" /> OK{alert?.areaPSMB ? ` - ${alert.areaPSMB}` : ''}{alert?.codigoArea ? ` - ${alert.codigoArea}` : ''}
                  </div>
                ))}
                {weekSummaryFull.sanitaryAlerts.map((alert, i) => (
                  <div key={`a-${i}`} className={`hds-alert-chip ${getSanitarioEstado(alert)}`}>
                    <AlertTriangle size={12} /> {getSanitarioLabel(alert)}{alert?.areaPSMB ? ` - ${alert.areaPSMB}` : ''}
                  </div>
                ))}
                {weekSummaryFull.sanitaryAlerts.length === 0 && weekSummaryFull.sanitaryOk.length === 0 && (
                  <div className="hds-alert-chip gris"><span className="hds-alert-dot gris" /> Sin información sanitaria</div>
                )}
                {weekSummaryFull.sanitaryAlerts.length === 0 && weekSummaryFull.sanitaryOk.length > 0 && (
                  <div className="hds-alert-info">Sin alertas críticas</div>
                )}
              </section>
            </div>
          ) : (
            <div className="hds-body">

              {/* Header */}
              <div className="hds-header">
                <div className="hds-header-icon">
                  <Activity size={16} />
                </div>
                <span className="hds-header-title">RESUMEN DEL MES</span>
              </div>

              {/* KPI Hero */}
              <div className="hds-kpi-hero">
                <div className="hds-kpi-hero-main">
                  <span className="hds-kpi-big">
                    {calendarMetric === 'camiones'
                      ? monthSummary.total.camiones
                      : fmtNumber(monthSummary.total.tons, 0)}
                  </span>
                  <span className="hds-kpi-unit">
                    {calendarMetric === 'camiones' ? 'cam' : 't'}
                  </span>
                </div>
                <span className="hds-kpi-sub">{monthSummary.total.days} días con cosecha</span>
              </div>

              {/* Sub KPIs */}
              <div className="hds-kpi-row">
                <div className="hds-kpi-card">
                  <strong>{fmtNumber(monthSummary.promedioDiario, 0)} t</strong>
                  <span>Promedio diario</span>
                </div>
                <div className="hds-kpi-card">
                  <strong>{monthSummary.total.days}</strong>
                  <span>Días activos</span>
                </div>
                <div className="hds-kpi-card">
                  <strong>{fmtNumber(monthSummary.maximoDia, 0)} t</strong>
                  <span>Máximo día</span>
                </div>
              </div>

              {/* Providers */}
              <section className="hds-section">
                <div className="hds-section-head">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    DISTRIBUCIÓN POR PROVEEDOR
                    <Info size={12} style={{ opacity: 0.45, flexShrink: 0, cursor: 'default' }} title="Participación del proveedor sobre el total planificado del período. No corresponde a consumo real ni avance del programa." />
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {filterProveedor && (
                      <button className="hds-link-btn hds-filter-clear" onClick={() => setFilterProveedor(null)}>× Limpiar</button>
                    )}
                    {!filterProveedor && allMonthProviders.length > 2 && (
                      <button className="hds-link-btn" onClick={() => setShowAllProviders(v => !v)}>
                        {showAllProviders ? 'Ver menos' : 'Ver todos'}
                      </button>
                    )}
                  </div>
                </div>
                {allMonthProviders.length === 0 ? (
                  <p className="hds-empty">Sin cosechas en el mes.</p>
                ) : (
                  (showAllProviders || filterProveedor ? allMonthProviders : allMonthProviders.slice(0, 2)).map((provider) => {
                    const totalAllTons = allMonthProviders.reduce((s, p) => s + p.tons, 0);
                    const pct = totalAllTons > 0 ? Math.round(provider.tons / totalAllTons * 100) : 0;
                    const isActive = filterProveedor === provider.nombre;
                    return (
                      <div
                        key={provider.nombre}
                        className={`hds-provider-row hds-provider-clickable ${isActive ? 'is-filter-active' : ''}`}
                        onClick={() => setFilterProveedor(v => v === provider.nombre ? null : provider.nombre)}
                        title={isActive ? 'Click para mostrar todos' : 'Click para filtrar por este proveedor'}
                      >
                        <div className="hds-provider-top">
                          <span className="hds-provider-name">{provider.nombre}</span>
                          <strong className="hds-provider-val">
                            {calendarMetric === 'camiones'
                              ? `${provider.camiones} cam · ${pct}%`
                              : `${fmtNumber(provider.tons, 0)} t · ${pct}%`}
                          </strong>
                        </div>
                        <div className="hds-provider-bar">
                          <div className="hds-provider-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </section>

              {/* Product Mix */}
              <section className="hds-section">
                <div className="hds-section-head">
                  <span>MIX DE PRODUCTOS</span>
                  {filterProducto && (
                    <button className="hds-link-btn hds-filter-clear" onClick={() => setFilterProducto(null)}>× Limpiar</button>
                  )}
                </div>
                {allMonthProducts.products.length === 0 ? (
                  <p className="hds-empty">Sin productos definidos.</p>
                ) : (
                  <div className="hds-donut-area">
                    <DonutChart products={allMonthProducts.products} totalTons={allMonthProducts.total} activeKey={filterProducto} />
                    <div className="hds-donut-legend">
                      {allMonthProducts.products.map((p) => {
                        const pct = allMonthProducts.total > 0
                          ? Math.round(p.tons / allMonthProducts.total * 100)
                          : 0;
                        const isActive = filterProducto === p.key;
                        const isDimmed = filterProducto && !isActive;
                        return (
                          <div
                            key={p.key}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isActive}
                            className={`hds-legend-row hds-legend-row--filter ${isActive ? 'is-active' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                            onClick={() => setFilterProducto(v => v === p.key ? null : p.key)}
                            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFilterProducto(v => v === p.key ? null : p.key)}
                            title={isActive ? `Quitar filtro ${getTipoProductoLabel(p.key)}` : `Filtrar calendario por ${getTipoProductoLabel(p.key)}`}
                          >
                            <span className={`hds-legend-dot ${getProductClass(p.key)}`} />
                            <span className="hds-legend-label">{getTipoProductoLabel(p.key)}</span>
                            <span className="hds-legend-pct">
                              {pct}% <em>({fmtNumber(p.tons, 0)} t)</em>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* Sanitario */}
              <section className="hds-section">
                <div className="hds-section-head"><span>ALERTAS SANITARIAS</span></div>
                {monthSummary.sanitaryOk.map((alert, i) => (
                  <div key={`ok-${i}`} className="hds-alert-chip verde">
                    <span className="hds-alert-dot" />
                    OK{alert?.areaPSMB ? ` - ${alert.areaPSMB}` : ''}
                    {alert?.codigoArea ? ` - ${alert.codigoArea}` : ''}
                    {alert?.ultimoAnalisisMrsat ? ` - ${alert.ultimoAnalisisMrsat}` : ''}
                  </div>
                ))}
                {monthSummary.sanitaryAlerts.map((alert, i) => (
                  <div key={`alert-${i}`} className={`hds-alert-chip ${getSanitarioEstado(alert)}`}>
                    <AlertTriangle size={12} />
                    {getSanitarioLabel(alert)}
                    {alert?.areaPSMB ? ` - ${alert.areaPSMB}` : ''}
                    {alert?.codigoArea ? ` - ${alert.codigoArea}` : ''}
                  </div>
                ))}
                {monthSummary.sanitaryAlerts.length === 0 && monthSummary.sanitaryOk.length === 0 && (
                  <div className="hds-alert-chip gris">
                    <span className="hds-alert-dot gris" /> Sin información sanitaria
                  </div>
                )}
                {monthSummary.sanitaryAlerts.length === 0 && monthSummary.sanitaryOk.length > 0 && (
                  <div className="hds-alert-info">
                    Sin alertas críticas
                  </div>
                )}
              </section>

              <div className="hds-hint">
                Selecciona un día del calendario para ver el desglose operativo diario.
              </div>
            </div>
          )}
        </aside>
      )}

      {truckPopover && (
        <>
          <div className="suspend-popover-backdrop" onClick={() => setTruckPopover(null)} />
          <div className="truck-popover" style={{ left: truckPopover.x, top: truckPopover.y }}>
            <div className="truck-popover-title">
              {truckPopover.mode === 'remove' ? 'Quitar camión' : 'Agregar camión'}
            </div>
            <div className="truck-popover-list">
              {truckPopover.opciones.map((opt) => (
                <button
                  key={opt.tipoTransporteId}
                  type="button"
                  className="truck-popover-opt"
                  onClick={() => onSelectTruck(opt)}
                >
                  <span className="truck-popover-opt-name">{opt.tipoTransporteNombre || 'Sin nombre'}</span>
                  <span className="truck-popover-opt-cap">
                    {truckPopover.mode === 'remove'
                      ? `${opt.cantidad} cam`
                      : (opt.toneladasPorCamion != null ? `${fmtNumber(opt.toneladasPorCamion, 0)} t` : '—')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
