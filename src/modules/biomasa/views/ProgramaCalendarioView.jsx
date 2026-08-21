import { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Activity,
  Calendar as CalendarIcon,
  Pencil,
  Maximize2,
  Minimize2,
  Info,
  AlertTriangle,
  SlidersHorizontal,
  MapPin,
  Droplet,
  Truck,
  Users,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import ProgramaSemanaModal from '../components/ProgramaSemanaModal';
import ProviderMapModal from '../../gestion/submodules/ProviderMapModal';

const CAL_VIEW_LABELS = { month: 'Mes', week: 'Semana' };
// Orden fijo por tipo de MMPP para la tabla semanal: Entero, Media Concha, Carne.
const PRODUCT_ORDER = { entero: 0, mc: 1, carne: 2, sin_definir: 3 };
const rowTonsForSort = (data) => data.dias.reduce((s, c) => s + Number(c.tonsDia || 0), 0);
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
  formatMuestreoResumen, formatMuestreoFecha,
  getProgramVolumeProgress, getEffectiveTonsPerTruck,
} from '../utils/programaCalculos';
import { esFechaEnVigencia } from '../utils/programaImpacto';
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
  tiposTransporte = [],
  notasDia,
  notasSemana,
  setNotaPopover,
  setNotaSemanaPopover,
  setCondicionPopover,
  weekSummaries,
  weekSummaryFull,
  filterProveedor, setFilterProveedor,
  allWeekProducts,
  monthSummary,
  allMonthProviders,
  allMonthProducts,
  handleOpenAdjustModal,
  handleAplicarSemana,
}) {
  const [calViewDropdownOpen, setCalViewDropdownOpen] = useState(false);
  const [mapProvider, setMapProvider] = useState(null);
  const [semanaModal, setSemanaModal] = useState(null);
  const [showProviderPanel, setShowProviderPanel] = useState(false);
  const calViewDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calViewDropdownRef.current && !calViewDropdownRef.current.contains(e.target)) {
        setCalViewDropdownOpen(false);
      }
    };
    if (calViewDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [calViewDropdownOpen]);

  // Mapa nombre de proveedor → programa, para el avance en el panel derecho.
  const providerProgramMap = Object.fromEntries(
    Object.entries(weekData).map(([id, d]) => {
      const prog = programasById.get(id);
      return [d.nombre, prog];
    }).filter(([, prog]) => prog),
  );

  // Saldo del trato AL INICIO de la semana que se está viendo (total acordado menos
  // lo ya consumido en semanas ANTERIORES) — misma fórmula que ya usa el resto de la
  // app (getProgramVolumeProgress), solo que aquí "hasta" es el día antes de esta
  // semana en vez de "hoy". Así "Ton cerradas" baja semana a semana a medida que se
  // va consumiendo, en vez de mostrar siempre el total original del contrato.
  const saldoByProgram = useMemo(() => {
    const map = {};
    if (!weekDays.length) return map;
    const diaAnterior = new Date(weekDays[0] + 'T00:00:00Z');
    diaAnterior.setUTCDate(diaAnterior.getUTCDate() - 1);
    Object.entries(weekData).forEach(([id]) => {
      const prog = programasById.get(id);
      if (!prog) return;
      const vol = getProgramVolumeProgress(prog, getEffectiveTonsPerTruck(prog, 10, tiposTransporte), diaAnterior);
      map[id] = Math.max(0, vol.balance);
    });
    return map;
  }, [weekData, programasById, weekDays, tiposTransporte]);

  const tonsCerradasSemana = Object.values(saldoByProgram).reduce((s, v) => s + v, 0);

  // Mapa id→vol para detectar sobrepaso de biomasa acordada en cualquier programa activo.
  const overageMap = useMemo(() => {
    const map = {};
    Object.entries(weekData).forEach(([id]) => {
      const prog = programasById.get(id);
      if (!prog || !prog.tonsEstimadas) return;
      const vol = getProgramVolumeProgress(prog, getEffectiveTonsPerTruck(prog, 10, tiposTransporte));
      if (vol.isOver) map[id] = vol;
    });
    return map;
  }, [weekData, programasById]);

  // Acceso único: abre el modal "Ajustar día" (acción inicial por defecto 'sumar'; dentro
  // el usuario elige Sumar / Descontar / Suspender). Se pasa la composición real del día
  // (desgloseDia) para mostrar el estado y que la resta solo ofrezca tipos existentes.
  const abrirAjustarDia = (programa, fecha, cell, accionInicial = 'sumar') => {
    handleOpenAdjustModal(programa, fecha, cell.camiones, accionInicial, cell.tonsDia || 0, cell.desgloseDia || []);
  };

  return (
    <div ref={calendarBoardRef} className={`harvest-calendar-shell ${calView === 'week' ? 'week-mode' : 'month-mode'} ${isCalendarBoard ? 'board-mode' : ''} ${calView === 'month' && selectedDay ? 'has-day-detail' : ''}`} data-tour="programa-calendario">
      <div className="mx-card harvest-calendar-main">
        <div className="harvest-calendar-toolbar">
          <div className="harvest-calendar-controls">
            <div className="harvest-prog-view-dropdown" ref={calViewDropdownRef} data-tour="programa-calendario-vistas">
              <button
                className="harvest-prog-view-btn"
                onClick={() => setCalViewDropdownOpen(o => !o)}
              >
                <span>Vista: <strong>{CAL_VIEW_LABELS[calView]}</strong></span>
                <ChevronDown size={13} className={calViewDropdownOpen ? 'rotated' : ''} />
              </button>
              {calViewDropdownOpen && (
                <div className="harvest-prog-view-menu">
                  {Object.entries(CAL_VIEW_LABELS).map(([val, label]) => (
                    <button
                      key={val}
                      className={`harvest-prog-view-option${calView === val ? ' active' : ''}`}
                      onClick={() => {
                        setCalView(val);
                        if (val === 'week') setSelectedDay(null);
                        setCalViewDropdownOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Chips rápidos al lado del selector de vista */}
            {calView === 'week' && weekDays.length > 0 && (
              <div className="cal-period-chips">
                {[
                  { offset: 0, label: 'Esta semana' },
                  { offset: 1, label: 'Próxima semana' },
                  { offset: 2, label: 'Subsiguiente' },
                ].map(({ offset, label }) => (
                  <button
                    key={offset}
                    className={`cal-period-chip${currentWeekOffset === offset ? ' is-active' : ''}`}
                    onClick={() => setCurrentWeekOffset(offset)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {calView === 'month' && (() => {
              const today = new Date();
              const chips = [0, 1, 2].map(n => {
                const d = new Date(today.getFullYear(), today.getMonth() + n, 1);
                const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return { mk, label: n === 0 ? 'Este mes' : n === 1 ? 'Próximo mes' : 'Subsiguiente' };
              });
              return (
                <div className="cal-period-chips">
                  {chips.map(({ mk, label }) => (
                    <button
                      key={mk}
                      className={`cal-period-chip${mes === mk ? ' is-active' : ''}`}
                      onClick={() => setMes(mk)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              );
            })()}

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
                      SEMANA {getISOWeek(weekDays[4] || weekDays[0])}
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
          <div className="cal-month-summary-strip">
            <div className="cal-month-summary-kpis">
              <span><strong>{calendarMetric === 'camiones' ? monthSummary.total.camiones : fmtNumber(monthSummary.total.tons, 0)}</strong>{calendarMetric === 'camiones' ? ' cam' : ' t'} del mes</span>
              <span className="cal-month-summary-dot">·</span>
              <span><strong>{fmtNumber(monthSummary.promedioDiario, 0)}</strong> t/día prom.</span>
              <span className="cal-month-summary-dot">·</span>
              <span><strong>{monthSummary.total.days}</strong> días activos</span>
              <span className="cal-month-summary-dot">·</span>
              <span><strong>{fmtNumber(monthSummary.maximoDia, 0)}</strong> t máx</span>
            </div>

            {allMonthProducts.products.length > 0 && (
              <>
                <div className="cal-month-summary-divider" />
                <span className="cal-month-mix-donut">
                  <DonutChart products={allMonthProducts.products} totalTons={allMonthProducts.total} activeKey={filterProducto} />
                </span>
                {allMonthProducts.products.map((p) => {
                  const pct = allMonthProducts.total > 0 ? Math.round(p.tons / allMonthProducts.total * 100) : 0;
                  const isActive = filterProducto === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={`harvest-week-mix-item cal-month-mix-item-btn ${isActive ? 'is-active' : ''}`}
                      onClick={() => setFilterProducto(v => v === p.key ? null : p.key)}
                      title={isActive ? `Quitar filtro ${getTipoProductoLabel(p.key)}` : `Filtrar calendario por ${getTipoProductoLabel(p.key)}`}
                    >
                      <span className={`hds-legend-dot ${getProductClass(p.key)}`} />
                      {getTipoProductoLabel(p.key)} <strong>{pct}%</strong>
                    </button>
                  );
                })}
                {filterProducto && (
                  <button className="hds-link-btn hds-filter-clear" onClick={() => setFilterProducto(null)}>× Limpiar</button>
                )}
              </>
            )}

            <button
              type="button"
              className="cal-month-mix-toggle"
              onClick={() => setShowProviderPanel(true)}
            >
              Por proveedor
            </button>
          </div>

          {showProviderPanel && (
            <div className="mx-modal-overlay" onClick={() => setShowProviderPanel(false)}>
              <div className="mx-modal mx-modal--std cal-month-provider-modal" onClick={(e) => e.stopPropagation()}>
                <div className="mx-modal-header">
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Distribución por proveedor
                    <Info size={13} style={{ opacity: 0.45, flexShrink: 0, cursor: 'default' }} title="Participación del proveedor sobre el total planificado del período. No corresponde a consumo real ni avance del programa." />
                  </h2>
                  <button className="mx-btn-icon" onClick={() => setShowProviderPanel(false)} title="Cerrar"><X size={18} /></button>
                </div>
                <div className="mx-modal-body">
                  {filterProveedor && (
                    <button className="hds-link-btn hds-filter-clear" style={{ marginBottom: 10 }} onClick={() => setFilterProveedor(null)}>× Limpiar filtro</button>
                  )}
                  {allMonthProviders.length === 0 ? (
                    <p className="hds-empty">Sin cosechas en el mes.</p>
                  ) : (
                    <div className="cal-month-provider-grid">
                      {allMonthProviders.map((provider) => {
                        const totalAllTons = allMonthProviders.reduce((s, p) => s + p.tons, 0);
                        const pct = totalAllTons > 0 ? Math.round(provider.tons / totalAllTons * 100) : 0;
                        const isActive = filterProveedor === provider.nombre;
                        const metricLabel = calendarMetric === 'camiones'
                          ? `${provider.camiones} cam · ${pct}%`
                          : `${fmtNumber(provider.tons, 0)} t · ${pct}%`;
                        const prog = providerProgramMap[provider.nombre];
                        const lastDayOfMonth = mes && monthData?.days?.length
                          ? `${mes}-${String(monthData.days[monthData.days.length - 1]).padStart(2, '0')}`
                          : null;
                        const vol = (prog && lastDayOfMonth) ? getProgramVolumeProgress(prog, getEffectiveTonsPerTruck(prog, 10, tiposTransporte), new Date(lastDayOfMonth + 'T23:59:59Z')) : null;
                        return (
                          <div
                            key={provider.nombre}
                            className={`hds-prov-card${isActive ? ' hds-prov-card--active' : ''}`}
                            onClick={() => setFilterProveedor(v => v === provider.nombre ? null : provider.nombre)}
                            title={isActive ? 'Click para mostrar todos' : 'Click para filtrar por este proveedor'}
                          >
                            <div className="hds-prov-card-top">
                              <span className="hds-prov-card-name">{provider.nombre}</span>
                              <span className="hds-prov-card-val">{metricLabel}</span>
                            </div>
                            <div className="hds-prov-prog-bar">
                              <div className="hds-prov-prog-fill" style={{ width: `${pct}%` }} />
                            </div>
                            {vol?.estimated > 0 && (
                              <span className={`hds-prov-prog-text${vol.isOver ? ' hds-prov-prog-text--over' : ''}`}>
                                {vol.isOver ? '⚠️ ' : ''}programado{provider.comuna ? ` (${provider.comuna})` : ''}: {fmtTonsInt(vol.consumed)}/{fmtTonsInt(vol.estimated)} · {Math.round(vol.progressRaw)}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {monthSummary.sanitaryAlerts.length > 0 && (
            <div className="cal-month-sanitary-strip">
              <span className="cal-month-sanitary-label">Alertas sanitarias</span>
              {monthSummary.sanitaryAlerts.map((alert, i) => (
                <div key={`alert-${i}`} className={`hds-alert-chip ${getSanitarioEstado(alert)}`}>
                  <AlertTriangle size={12} />
                  {getSanitarioLabel(alert)}
                  {alert?.areaPSMB ? ` - ${alert.areaPSMB}` : ''}
                  {alert?.codigoArea ? ` - ${alert.codigoArea}` : ''}
                </div>
              ))}
            </div>
          )}

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
              const visiblePrograms = Array.from(programasById.values())
                .filter(p => filteredProgramIds.has(String(p?._id)))
                .filter(p => !filterProducto || (p?.tipoProducto || p?.tipoProductoSugerido || 'sin_definir') === filterProducto);
              const isSinPrograma = visiblePrograms.length > 0
                && dayItems.length === 0
                && !hasSuspended
                && visiblePrograms.every(p => !esFechaEnVigencia(p, dateKey));
              const primaryProduct = daySummary.products[0]?.key || 'sin_definir';

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDay(prev => prev?.key === dateKey ? null : { key: dateKey, items: dayItems.filter(it => Number(it.camiones) > 0), total: totalCam, summary: daySummary })}
                  className={`cal-day-cell ${calendarDayToneClass(dateKey)} ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''} ${isSinPrograma ? 'is-sinprog' : ''} ${totalCam > 0 ? `has-data ${getProductClass(primaryProduct)}` : ''}`}
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
                  ) : isSinPrograma ? (
                    <div className="cal-month-sinprog">Sin programa</div>
                  ) : hasSuspended ? (
                    <div className="cal-month-susp">Susp.</div>
                  ) : (
                    <div className="cal-day-empty">—</div>
                  )}
                </div>
              );
            })}
            {Array.from({ length: monthData.paddingEnd }).map((_, i) => (
              <div key={`pad-end-${i}`} className="cal-pad-day" />
            ))}
          </div>
          <div className="cal-month-legend">
            <span className="cal-legend-item"><span className="cal-chip product-entero">E</span> Entero</span>
            <span className="cal-legend-item"><span className="cal-chip product-carne">C</span> Carne</span>
            <span className="cal-legend-item"><span className="cal-chip product-mc">MC</span> Media Concha</span>
            <span className="cal-legend-item"><span className="cal-chip product-sin_definir">SD</span> Sin definir</span>
            <span className="cal-legend-item cal-legend-sinprog">Sin programa</span>
            <span className="cal-legend-item cal-legend-dash">— Sin actividad</span>
          </div>
          </>
        ) : (
          <>
          <div className="harvest-week-kpi-strip">
            <div className="harvest-week-kpi-card">
              <span className="harvest-week-kpi-icon"><Droplet size={15} /></span>
              <div>
                <strong>{fmtNumber(tonsCerradasSemana, 0)} t</strong>
                <span>Ton cerradas</span>
              </div>
            </div>
            <div className="harvest-week-kpi-card">
              <span className="harvest-week-kpi-icon"><TrendingUp size={15} /></span>
              <div>
                <strong>{fmtNumber(weekSummaryFull.total.tons, 0)} t</strong>
                <span>Programadas</span>
              </div>
            </div>
            <div className="harvest-week-kpi-card">
              <span className="harvest-week-kpi-icon"><Wallet size={15} /></span>
              <div>
                <strong>{fmtNumber(tonsCerradasSemana - weekSummaryFull.total.tons, 0)} t</strong>
                <span>Saldo</span>
              </div>
            </div>
            <div className="harvest-week-kpi-card">
              <span className="harvest-week-kpi-icon"><Truck size={15} /></span>
              <div>
                <strong>{weekSummaryFull.total.camiones}</strong>
                <span>Camiones totales</span>
              </div>
            </div>
            <div className="harvest-week-kpi-card">
              <span className="harvest-week-kpi-icon"><Users size={15} /></span>
              <div>
                <strong>{weekSummaryFull.providers.length}</strong>
                <span>Proveedores</span>
              </div>
            </div>
          </div>
          {allWeekProducts.products.length > 0 && (
            <div className="harvest-week-mix-strip">
              <span className="harvest-week-mix-label">Mix de productos</span>
              {allWeekProducts.products.map(p => {
                const pct = allWeekProducts.total > 0 ? Math.round(p.tons / allWeekProducts.total * 100) : 0;
                return (
                  <span key={p.key} className="harvest-week-mix-item">
                    <span className={`hds-legend-dot ${getProductClass(p.key)}`} />
                    {getTipoProductoLabel(p.key)} <strong>{pct}%</strong> <em>({fmtNumber(p.tons, 0)} t)</em>
                  </span>
                );
              })}
            </div>
          )}
          <div className="harvest-week-v2">
            <div className="harvest-week-v2-head">
              <div className="harvest-week-v2-label">Proveedor</div>
              <div className="harvest-week-v2-label">Tons total</div>
              <div className="harvest-week-v2-label">Calibre</div>
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
              <div className="harvest-week-v2-daycol harvest-week-v2-condicol">
                <div className="harvest-week-v2-dayname">Condición MP</div>
              </div>
            </div>

            {Object.entries(weekData).filter(([, data]) => {
              if (filterProducto && data.tipoProducto !== filterProducto) return false;
              return true;
            }).sort(([, a], [, b]) => {
              const ordenA = PRODUCT_ORDER[a.tipoProducto] ?? PRODUCT_ORDER.sin_definir;
              const ordenB = PRODUCT_ORDER[b.tipoProducto] ?? PRODUCT_ORDER.sin_definir;
              if (ordenA !== ordenB) return ordenA - ordenB;
              return rowTonsForSort(b) - rowTonsForSort(a);
            }).map(([id, data]) => {
              const programa = programasById.get(id);
              const rowTotal = data.dias.reduce((s, c) => ({ camiones: s.camiones + Number(c.camiones || 0), tons: s.tons + Number(c.tonsDia || 0) }), { camiones: 0, tons: 0 });
              return (
                <div key={id} className="harvest-week-v2-row">
                  <div className={`harvest-week-v2-prov ${getProductClass(data.tipoProducto)} ${programa?.estado === 'pausado' ? 'is-pausado' : ''}`}>
                    <div className="harvest-week-v2-prov-name">
                      {data.nombre}
                      {overageMap[id] && (
                        <span className="wk-overage-badge" title={`Biomasa acordada superada: ${Math.round(overageMap[id].progressRaw)}% programado`}>
                          ⚠️ {Math.round(overageMap[id].progressRaw)}%
                        </span>
                      )}
                    </div>
                    <span className="wk-prov-tooltip">{data.nombre}</span>
                    <div className="wk-prov-centro-muestreo">
                      {(data.comuna || data.centro) ? (
                        <>
                          {data.comuna && <span className="wk-prov-centro-code">{data.comuna}</span>}
                          {data.comuna && data.centro && <span className="wk-prov-sep">·</span>}
                          {data.centro && <span className="wk-prov-centro-code">{data.centro}</span>}
                        </>
                      ) : (
                        <span className="wk-prov-muestreo-inline wk-prov-muestreo--vacio">Por definir</span>
                      )}
                    </div>
                    {/* Badge de vigencia próxima a vencer */}
                    {(() => {
                      if (!programa?.vigenciaHasta || programa.estado !== 'activo') return null;
                      const msLeft = new Date(programa.vigenciaHasta).getTime() - Date.now();
                      const dias = Math.ceil(msLeft / 86400000);
                      if (dias < 0 || dias > 5) return null;
                      return (
                        <span className="wk-vence-badge" title={`La vigencia del programa termina ${dias === 0 ? 'hoy' : `en ${dias} día${dias === 1 ? '' : 's'}`}`}>
                          {dias === 0 ? '⚠ Vence hoy' : `⚠ Vence en ${dias}d`}
                        </span>
                      );
                    })()}
                    {/* Chip de producto + botón en la misma línea */}
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
                    {handleAplicarSemana && programa?.estado !== 'pausado' && programa?.estado !== 'finalizado' && (
                      <button
                        type="button"
                        className="wk-btn-semana"
                        title="Planificar semana"
                        onClick={() => setSemanaModal({
                          programa,
                          diasActuales: Object.fromEntries(weekDays.map((d, i) => [d, data.dias[i]?.camiones || 0])),
                        })}
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                  <div className={`harvest-week-v2-meta ${saldoByProgram[id] ? '' : 'is-empty'}`} title="Saldo del trato al inicio de esta semana">{saldoByProgram[id] ? fmtTonsInt(saldoByProgram[id]) : '—'}</div>
                  <div className={`harvest-week-v2-meta ${(data.calibreMin != null || data.calibreMax != null) ? '' : 'is-empty'}`}>
                    {(data.calibreMin != null || data.calibreMax != null) ? `${data.calibreMin ?? '?'}–${data.calibreMax ?? '?'}` : '—'}
                  </div>
                  {data.dias.map((cell, i) => {
                    const dia = weekDays[i];
                    const pausaKey = programa?.estado === 'pausado' && programa?.pausadoDesde ? programa.pausadoDesde.slice(0, 10) : null;
                    const vigHastaKey = programa?.estado === 'finalizado' && programa?.vigenciaHasta ? programa.vigenciaHasta.slice(0, 10) : null;
                    const isPausedFuture = pausaKey !== null && dia >= pausaKey;
                    const isFinishedFuture = vigHastaKey !== null && dia > vigHastaKey;
                    const isReadOnly = programa?.estado === 'finalizado' || programa?.estado === 'pausado';
                    const isSusp = cell.esDiaEspecial && cell.camiones === 0;
                    // "Sin programa": la fecha está fuera de la vigencia del programa.
                    // Un día suspendido dentro de vigencia NO entra aquí (sigue en vigencia).
                    const isSinPrograma = !!programa && !esFechaEnVigencia(programa, dia);
                    const isToday = dia === todayKey();
                    return (
                      <div key={i} className={`harvest-week-v2-cell ${isToday ? 'is-today' : ''} ${isSusp ? 'is-susp' : ''} ${isSinPrograma ? 'is-sinprog' : ''} ${isPausedFuture || isFinishedFuture ? 'is-prog-pausado' : ''}`}>
                        {isPausedFuture ? (
                          <span className="wk-estado-label pausado">Pausado</span>
                        ) : isFinishedFuture ? (
                          <span className="wk-estado-label finalizado">Finalizado</span>
                        ) : isSinPrograma ? (
                          <span className="harvest-week-v2-sinprog">Sin programa</span>
                        ) : isSusp ? (
                          <span className="harvest-week-v2-sinprog">Sin programa</span>
                        ) : cell.camiones > 0 || programa ? (
                          <>
                            {cell.camiones > 0 ? (
                              <div className="harvest-week-v2-count">
                                {calendarMetric === 'tons' ? (
                                  <strong>{cell.tonsDia > 0 ? fmtTonsInt(cell.tonsDia) : '—'}</strong>
                                ) : calendarMetric === 'both' ? (
                                  <><strong>{cell.camiones}</strong><span>CAM</span>{cell.tonsDia > 0 && <span className="wk-tons-sub">{fmtTonsInt(cell.tonsDia)}</span>}</>
                                ) : (
                                  <strong>{cell.camiones}</strong>
                                )}
                              </div>
                            ) : (
                              <span className="harvest-week-v2-empty">—</span>
                            )}
                            {cell.esUltimoDiaCalculado && cell.capacidadTeoricaTons != null && Math.abs(cell.capacidadTeoricaTons - cell.tonsDia) >= 0.5 && (
                              <span
                                className="wk-ultimo-dia-badge"
                                title={`Último día del programa: quedan ${fmtTonsInt(cell.tonsDia)} t por consumir, la capacidad de ${cell.camiones} camión(es) es ${fmtTonsInt(cell.capacidadTeoricaTons)} t (van parcialmente cargados)`}
                              >
                                parcial
                              </span>
                            )}
                            {programa && !isReadOnly && (
                              <div className="harvest-week-v2-actions">
                                <button className="wk-btn-ajustar" onClick={() => abrirAjustarDia(programa, dia, cell, 'sumar')} data-tour="programa-ajustar">
                                  <SlidersHorizontal size={12} /> Ajustar
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
                    {weekSummaryFull.total.tons > 0 && rowTotal.tons > 0 && (
                      <span className="wk-tons-sub">{Math.round((rowTotal.tons / weekSummaryFull.total.tons) * 100)}%</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="harvest-week-v2-cell harvest-week-v2-condicion wk-condicion-btn"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      const condicionActual = (programa?.condicionesSemanales || []).find((c) => c.weekKey === weekDays[0])?.nota || '';
                      setCondicionPopover({
                        programaId: id, weekKey: weekDays[0], nota: condicionActual, proveedorNombre: data.nombre,
                        x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 6,
                      });
                    }}
                  >
                    {(() => {
                      const condicionActual = (programa?.condicionesSemanales || []).find((c) => c.weekKey === weekDays[0])?.nota;
                      return condicionActual?.trim() ? (
                        <span className="wk-condicion-text" title={condicionActual}>{condicionActual}</span>
                      ) : (
                        <span className="wk-condicion-add">＋ Agregar</span>
                      );
                    })()}
                  </button>
                </div>
              );
            })}

            <div className="harvest-week-v2-row harvest-week-v2-footer">
              <div className="harvest-week-v2-label">Total día</div>
              <div className="harvest-week-v2-meta is-empty" />
              <div className="harvest-week-v2-meta is-empty" />
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
              <div className="harvest-week-v2-cell" />
            </div>

            <div className="harvest-week-v2-row harvest-week-v2-notas">
              <div className="harvest-week-v2-label wk-nota-label">Nota del día</div>
              <div className="harvest-week-v2-meta is-empty" />
              <div className="harvest-week-v2-meta is-empty" />
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
              <div className="harvest-week-v2-cell" />
            </div>

            <div className="harvest-week-v2-row harvest-week-v2-notas">
              <div className="harvest-week-v2-label wk-nota-label">Nota semana</div>
              <div className="harvest-week-v2-meta is-empty" />
              <div className="harvest-week-v2-meta is-empty" />
              {(() => {
                const weekKey = weekDays[0];
                const notaSemana = notasSemana?.[weekKey];
                return (
                  <div className="harvest-week-v2-cell wk-nota-cell wk-nota-semana-cell" style={{ gridColumn: 'span 9' }}>
                    {notaSemana ? (
                      <div className="wk-nota-content">
                        <span className="wk-nota-text" title={notaSemana.nota}>{notaSemana.nota}</span>
                        <button className="wk-nota-btn" title="Editar observación de la semana" onClick={e => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setNotaSemanaPopover({ weekKey, nota: notaSemana.nota, x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 6 });
                        }}>✏</button>
                      </div>
                    ) : (
                      <button className="wk-nota-add wk-nota-semana-add" title="Agregar observación de la semana" onClick={e => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setNotaSemanaPopover({ weekKey, nota: '', x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 6 });
                      }}>＋ Agregar observación general de la semana</button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          </>
        )}
      </div>

      {calView === 'month' && selectedDay && (
        <aside className="hds-panel">
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
                    <p>Sin programa</p>
                    <p className="cal-detail-empty-sub">No hay cosecha programada para esta fecha.</p>
                  </div>
                ) : (
                  selectedDay.items.map((it, idx) => (
                    <div key={idx} className={`cal-detail-card ${getProductClass(it.tipoProducto)}${it.estado === 'finalizado' ? ' is-finalizado' : ''}`}>
                      <div className="cal-detail-card-top">
                        <div className="cal-detail-card-info">
                          <div className="cal-detail-card-name">{it.proveedorNombre}</div>
                          <div className="cal-detail-card-center">
                            {it.centroNombre || it.centroCodigo || 'Sin centro'}
                            {it.comuna && <span className="cal-detail-card-comuna"> · {it.comuna}</span>}
                            {it.centroCodigo && (
                              <button
                                type="button"
                                className="cal-detail-map-btn"
                                title="Ver centro en mapa"
                                onClick={() => setMapProvider({ centroCodigo: it.centroCodigo, nombre: it.proveedorNombre })}
                              >
                                <MapPin size={12} />
                              </button>
                            )}
                          </div>
                          {Array.isArray(it.desgloseDia) && it.desgloseDia.length > 0 && (
                            <div className="cal-detail-card-transporte">
                              {it.desgloseDia.map((l, i) => (
                                <div key={i} className="cal-detail-card-transporte-line">
                                  {Number(l.cantidad || 0)} {l.tipoTransporteNombre || 'Sin tipo'}
                                  {l.toneladasPorCamion != null
                                    ? ` · ${fmtTonsInt(Number(l.cantidad || 0) * Number(l.toneladasPorCamion || 0))}`
                                    : ''}
                                </div>
                              ))}
                            </div>
                          )}
                          {formatMuestreoResumen(it) ? (
                            <div className="cal-detail-card-muestreo">
                              Últ. muestreo{formatMuestreoFecha(it.muestreoFecha, 'long') ? ` ${formatMuestreoFecha(it.muestreoFecha, 'long')}` : ''}: {formatMuestreoResumen(it)}
                            </div>
                          ) : (
                            <div className="cal-detail-card-muestreo cal-detail-card-muestreo--vacio">Sin muestreo registrado</div>
                          )}
                        </div>
                        <div className="cal-detail-card-count">
                          <div className="cal-detail-card-count-main">
                            {calendarMetric === 'tons' ? (
                              <>
                                <strong>{Number(it.tonsDia) > 0 ? Math.round(Number(it.tonsDia) || 0) : '—'}</strong>
                                {Number(it.tonsDia) > 0 && <span>t</span>}
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
                          onClick={() => handleOpenAdjustModal(programasById.get(String(it.programaId)), selectedDay.key, it.camiones, 'sumar', it.tonsDia || 0, it.desgloseDia || [])}
                        >
                          Ajustar día
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
        </aside>
      )}
      {mapProvider && (
        <ProviderMapModal
          provider={mapProvider}
          onClose={() => setMapProvider(null)}
        />
      )}
      {semanaModal && (
        <ProgramaSemanaModal
          show={true}
          onClose={() => setSemanaModal(null)}
          programa={semanaModal.programa}
          weekDays={weekDays}
          diasActuales={semanaModal.diasActuales}
          onAplicar={handleAplicarSemana}
          tiposTransporte={tiposTransporte}
        />
      )}
    </div>
  );
}
