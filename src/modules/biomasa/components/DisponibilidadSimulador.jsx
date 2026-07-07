import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, Fish } from 'lucide-react';
import { fmtTons, fmtNumber, tonsPorCamionDeTipo } from '../utils/programaCalculos';
import { optionLabel, DISPONIBILIDAD_PRODUCTOS } from '../disponibilidad.constants';
import { dayOfWeekFromKey, todayKey } from '../utils/fechasChile';

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
];

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function operatingDaysInMonth(y, m, diasOp, startKey) {
  const diasSet = new Set(diasOp.map(Number));
  const daysInMonth = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (startKey && dk < startKey) continue;
    if (diasSet.has(dayOfWeekFromKey(dk))) count++;
  }
  return count;
}

function buildMonthlySimulation(y, m, tonsAvail, tonsPorDia, diasOp, startKey) {
  const diasSet = new Set(diasOp.map(Number));
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDayKey = `${y}-${String(m).padStart(2,'0')}-01`;
  const firstDow = dayOfWeekFromKey(firstDayKey);
  let consumed = 0;
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = dayOfWeekFromKey(dateKey);
    const isBeforeStart = startKey && dateKey < startKey;
    const isOperating = !isBeforeStart && diasSet.has(dow);
    const balanceBefore = tonsAvail - consumed;
    let tonsDia = 0;
    let tone = 'before';
    if (!isBeforeStart) {
      if (!isOperating) {
        tone = 'rest';
      } else if (balanceBefore <= 0) {
        tone = 'exhausted';
      } else {
        tonsDia = Math.min(tonsPorDia, balanceBefore);
        consumed += tonsDia;
        const pct = tonsAvail > 0 ? (tonsAvail - consumed) / tonsAvail : 0;
        if (pct > 0.3) tone = 'green';
        else if (pct > 0.1) tone = 'yellow';
        else if (pct > 0) tone = 'orange';
        else tone = 'red';
      }
    }
    days.push({ dateKey, day: d, dow, isBeforeStart, isOperating, tonsDia, balanceAfter: Math.max(0, tonsAvail - consumed), tone });
  }
  return { firstDow, days };
}

function buildSimulation(totalTons, tonsPorDia, startKey, diasOp) {
  const diasSet = new Set(diasOp.map(Number));
  let consumed = 0;
  let stockoutKey = null;
  let operatingDays = 0;
  const startYear = parseInt(startKey.slice(0, 4), 10);
  const startMonth = parseInt(startKey.slice(5, 7), 10) - 1;
  const monthsData = [];
  for (let mi = 0; mi < 5; mi++) {
    const totalM = startMonth + mi;
    const y = startYear + Math.floor(totalM / 12);
    const m = totalM % 12;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDayKey = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const firstDow = dayOfWeekFromKey(firstDayKey);
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = dayOfWeekFromKey(dateKey);
      const isBeforeStart = dateKey < startKey;
      const isOperating = !isBeforeStart && diasSet.has(dow);
      const balanceBefore = totalTons - consumed;
      let tonsDia = 0;
      let tone = 'before';
      if (!isBeforeStart) {
        if (!isOperating) {
          tone = 'rest';
        } else if (balanceBefore <= 0) {
          tone = 'exhausted';
        } else {
          tonsDia = Math.min(tonsPorDia, balanceBefore);
          consumed += tonsDia;
          operatingDays++;
          const balanceAfter = totalTons - consumed;
          if (!stockoutKey && balanceAfter <= 0) stockoutKey = dateKey;
          const pct = balanceAfter / totalTons;
          if (pct > 0.3) tone = 'green';
          else if (pct > 0.1) tone = 'yellow';
          else if (pct > 0) tone = 'orange';
          else tone = 'red';
        }
      }
      days.push({ dateKey, day: d, dow, isBeforeStart, isOperating, tonsDia, balanceAfter: Math.max(0, totalTons - consumed), tone, isStockout: stockoutKey === dateKey });
    }
    monthsData.push({ year: y, month: m, firstDow, days });
    if (stockoutKey && mi >= 1) break;
  }
  return { monthsData, stockoutKey, operatingDays };
}

function fmtDateKey(key) {
  if (!key) return '—';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function MonthGrid({ year, month, firstDow, days, expanded = false, onClick }) {
  return (
    <div
      className={`disp-sim-month${expanded ? ' disp-sim-month--expanded' : ''}${onClick ? ' disp-sim-month--clickable' : ''}`}
      onClick={onClick}
      title={onClick ? `Ver ${MONTHS_ES[month - 1]} ${year} en detalle` : undefined}
    >
      <div className="disp-sim-month-title">{MONTHS_ES[month - 1]} {year}</div>
      <div className="disp-sim-month-grid">
        {DIAS_SEMANA.map(({ label }) => (
          <div key={label} className="disp-sim-dow-header">{label}</div>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`pad-${i}`} className="disp-sim-day disp-sim-day--pad" />
        ))}
        {days.map(({ dateKey, day, tone, tonsDia, balanceAfter, isStockout }) => (
          <div
            key={dateKey}
            className={`disp-sim-day disp-sim-day--${tone}${isStockout ? ' is-stockout' : ''}`}
            title={tonsDia > 0
              ? `${fmtDateKey(dateKey)} · Consumo: ${fmtTons(tonsDia)} · Saldo: ${fmtTons(balanceAfter)}`
              : fmtDateKey(dateKey)}
          >
            <span className="disp-sim-day-num">{day}</span>
            {tonsDia > 0 && <span className="disp-sim-day-tons">{fmtNumber(tonsDia, 0)}t</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const pad = (n) => String(n).padStart(2, '0');
const TRIM_MONTHS = [[1,2,3],[4,5,6],[7,8,9],[10,11,12]];
const SEM_MONTHS  = [[1,2,3,4,5,6],[7,8,9,10,11,12]];

export default function DisponibilidadSimulador({ items, tiposTransporte }) {
  const [incluirSemiCerrado, setIncluirSemiCerrado] = useState(true);
  const [tipoTransporteId, setTipoTransporteId] = useState('');
  const [tonsPorCamionManual, setTonsPorCamionManual] = useState('');
  const [camionesPerDay, setCamionesPerDay] = useState('2');
  const [fechaInicio, setFechaInicio] = useState(() => todayKey());
  const [diasOp, setDiasOp] = useState([0, 1, 2, 3, 4]);

  // New cascading filter state
  const [viewYear, setViewYear] = useState(() => parseInt(todayKey().slice(0, 4), 10));
  const [viewMode, setViewMode] = useState(null); // null | 'mes' | 'trim' | 'año'
  const [viewPeriod, setViewPeriod] = useState(null); // month 1-12 or trim 1-4

  const [expandedMonth, setExpandedMonth] = useState(null);

  const totalTons = useMemo(() => {
    const estados = incluirSemiCerrado ? ['disponible', 'semi_cerrado'] : ['disponible'];
    return items
      .filter((item) => estados.includes(item.estado || 'disponible'))
      .reduce((sum, item) => sum + Number(item.tons || item.tonsDisponible || 0), 0);
  }, [items, incluirSemiCerrado]);

  const monthlyTons = useMemo(() => {
    const estadosOk = incluirSemiCerrado ? ['disponible', 'semi_cerrado'] : ['disponible'];
    const map = {};
    items.forEach((item) => {
      if (!estadosOk.includes(item.estado || 'disponible')) return;
      const mk = item.mesKey;
      if (!mk) return;
      map[mk] = (map[mk] || 0) + Number(item.tons || item.tonsDisponible || 0);
    });
    return map;
  }, [items, incluirSemiCerrado]);

  const selectedTipo = useMemo(
    () => tiposTransporte.find((t) => t._id === tipoTransporteId),
    [tiposTransporte, tipoTransporteId],
  );

  const tonsPorCamion = useMemo(() => {
    if (selectedTipo) return tonsPorCamionDeTipo(selectedTipo);
    const manual = parseFloat(String(tonsPorCamionManual).replace(',', '.'));
    return Number.isFinite(manual) && manual > 0 ? manual : null;
  }, [selectedTipo, tonsPorCamionManual]);

  const camionesNum = Math.max(0, parseInt(camionesPerDay, 10) || 0);
  const tonsPorDia = tonsPorCamion != null && camionesNum > 0 ? camionesNum * tonsPorCamion : 0;

  const visibleMonthKeys = useMemo(() => {
    if (viewMode === 'año') {
      return Array.from({ length: 12 }, (_, i) => `${viewYear}-${pad(i + 1)}`);
    }
    if (viewMode === 'sem' && viewPeriod) {
      return SEM_MONTHS[viewPeriod - 1].map((m) => `${viewYear}-${pad(m)}`);
    }
    if (viewMode === 'trim' && viewPeriod) {
      return TRIM_MONTHS[viewPeriod - 1].map((m) => `${viewYear}-${pad(m)}`);
    }
    if (viewMode === 'mes' && viewPeriod) {
      return [`${viewYear}-${pad(viewPeriod)}`];
    }
    // Default: 6 months from fechaInicio
    const startM = parseInt(fechaInicio.slice(5, 7), 10);
    const startY = parseInt(fechaInicio.slice(0, 4), 10);
    return Array.from({ length: 6 }, (_, i) => {
      const totalM = (startM - 1) + i;
      const y = startY + Math.floor(totalM / 12);
      const m = (totalM % 12) + 1;
      return `${y}-${pad(m)}`;
    });
  }, [viewMode, viewYear, viewPeriod, fechaInicio]);

  const monthStats = useMemo(() => {
    return visibleMonthKeys.map((mk) => {
      const y = parseInt(mk.slice(0, 4), 10);
      const m = parseInt(mk.slice(5, 7), 10);
      const tonsAvail = monthlyTons[mk] || 0;
      const opDays = operatingDaysInMonth(y, m, diasOp, fechaInicio);
      const tonsNeeded = tonsPorDia * opDays;
      const balance = tonsAvail - tonsNeeded;
      let tone = 'green';
      if (tonsNeeded > tonsAvail && tonsAvail === 0) tone = 'empty';
      else if (tonsNeeded > tonsAvail) tone = 'red';
      else if (tonsAvail > 0 && tonsNeeded >= tonsAvail * 0.9) tone = 'yellow';
      return { mk, y, m, tonsAvail, opDays, tonsNeeded, balance, tone };
    });
  }, [visibleMonthKeys, monthlyTons, diasOp, tonsPorDia, fechaInicio]);

  const annualSummary = useMemo(() => ({
    totalAvail: monthStats.reduce((s, ms) => s + ms.tonsAvail, 0),
    totalNeeded: monthStats.reduce((s, ms) => s + ms.tonsNeeded, 0),
    totalOpDays: monthStats.reduce((s, ms) => s + ms.opDays, 0),
  }), [monthStats]);

  const simulation = useMemo(() => {
    if (viewMode || !tonsPorDia || totalTons <= 0 || !fechaInicio) return null;
    return buildSimulation(totalTons, tonsPorDia, fechaInicio, diasOp);
  }, [viewMode, totalTons, tonsPorDia, fechaInicio, diasOp]);

  const monthProviders = useMemo(() => {
    if (!expandedMonth) return [];
    const estadosOk = incluirSemiCerrado ? ['disponible', 'semi_cerrado'] : ['disponible'];
    return items
      .filter((item) => item.mesKey === expandedMonth && estadosOk.includes(item.estado || 'disponible'))
      .sort((a, b) => (Number(b.tons || b.tonsDisponible || 0)) - (Number(a.tons || a.tonsDisponible || 0)));
  }, [expandedMonth, items, incluirSemiCerrado]);

  const toggleDia = (dow) => {
    setDiasOp((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b),
    );
  };

  const handleMode = (mode) => {
    if (viewMode === mode) {
      setViewMode(null);
      setViewPeriod(null);
    } else {
      setViewMode(mode);
      setViewPeriod(null);
    }
    setExpandedMonth(null);
  };

  const handleSelectPeriod = (p) => {
    setViewPeriod((prev) => (prev === p ? null : p));
    setExpandedMonth(null);
  };

  const handleExpandMonth = (mk) => {
    setExpandedMonth((prev) => (prev === mk ? null : mk));
  };

  const handleBack = () => {
    setExpandedMonth(null);
    if (viewMode === 'mes') setViewPeriod(null);
  };

  const renderCalendar = () => {
    if (expandedMonth) {
      const y = parseInt(expandedMonth.slice(0, 4), 10);
      const m = parseInt(expandedMonth.slice(5, 7), 10);
      const ms = monthStats.find((s) => s.mk === expandedMonth);
      const tonsAvail = ms?.tonsAvail || 0;
      const effectiveStart = expandedMonth >= fechaInicio.slice(0, 7) ? fechaInicio : null;
      const { firstDow, days } = tonsPorDia > 0
        ? buildMonthlySimulation(y, m, tonsAvail, tonsPorDia, diasOp, effectiveStart)
        : buildMonthlySimulation(y, m, 0, 0, diasOp, effectiveStart);
      return (
        <div className="disp-sim-expanded-layout">
          <MonthGrid year={y} month={m} firstDow={firstDow} days={days} expanded />
          <aside className="disp-sim-exp-providers">
            <div className="disp-sim-exp-providers-title">
              <Fish size={14} />
              {MONTHS_ES[m - 1]} {y}
            </div>
            <div className="disp-sim-exp-providers-total">{fmtTons(tonsAvail)}</div>
            <div className="disp-sim-exp-providers-list">
              {monthProviders.length === 0 ? (
                <div className="disp-sim-exp-providers-empty">Sin biomasa registrada</div>
              ) : (
                monthProviders.map((item) => {
                  const nombre = item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || '—';
                  const hasCalibres = item.calibreMin != null || item.calibreMax != null;
                  return (
                    <div key={item._id} className="disp-sim-exp-provider-row">
                      <span className="disp-sim-exp-provider-name" title={nombre}>{nombre}</span>
                      <span className="disp-sim-exp-provider-tons">{fmtTons(Number(item.tons || item.tonsDisponible || 0))}</span>
                      {hasCalibres && (
                        <span className="disp-sim-exp-calibre">{item.calibreMin ?? '?'}–{item.calibreMax ?? '?'} uk</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      );
    }

    // Modes that need a sub-period before showing the calendar
    if (!viewPeriod && (viewMode === 'mes' || viewMode === 'sem' || viewMode === 'trim')) {
      const hint = viewMode === 'mes' ? 'Selecciona un mes'
        : viewMode === 'sem' ? 'Selecciona un semestre'
        : 'Selecciona un trimestre';
      return (
        <div className="disp-sim-calendar-empty">
          <CalendarDays size={44} />
          <p>{hint}</p>
        </div>
      );
    }

    // Period modes (trim, año, mes+period)
    if (viewMode) {
      if (!tonsPorDia) {
        return <div className="disp-sim-calendar-empty"><CalendarDays size={44} /><p>Configura el transporte para ver la proyección</p></div>;
      }
      return monthStats.map((ms) => {
        const { firstDow, days } = ms.tonsAvail > 0
          ? buildMonthlySimulation(ms.y, ms.m, ms.tonsAvail, tonsPorDia, diasOp, fechaInicio)
          : { firstDow: dayOfWeekFromKey(`${ms.mk}-01`), days: Array.from({ length: new Date(ms.y, ms.m, 0).getDate() }, (_, d) => {
              const dateKey = `${ms.mk}-${pad(d + 1)}`;
              const isBeforeStart = dateKey < fechaInicio;
              const dow = dayOfWeekFromKey(dateKey);
              const isOp = !isBeforeStart && diasOp.includes(dow);
              return { dateKey, day: d + 1, dow, isBeforeStart, isOperating: isOp, tonsDia: 0, balanceAfter: 0, tone: isBeforeStart ? 'before' : isOp ? 'exhausted' : 'rest' };
            }) };
        return <MonthGrid key={ms.mk} year={ms.y} month={ms.m} firstDow={firstDow} days={days} onClick={() => handleExpandMonth(ms.mk)} />;
      });
    }

    // Default: per-month simulation (usa tons disponibles por mes, no acumulado total)
    if (tonsPorDia > 0) {
      return monthStats.map((ms) => {
        const { firstDow, days } = ms.tonsAvail > 0
          ? buildMonthlySimulation(ms.y, ms.m, ms.tonsAvail, tonsPorDia, diasOp, fechaInicio)
          : { firstDow: dayOfWeekFromKey(`${ms.mk}-01`), days: Array.from({ length: new Date(ms.y, ms.m, 0).getDate() }, (_, d) => {
              const dateKey = `${ms.mk}-${pad(d + 1)}`;
              const isBeforeStart = dateKey < fechaInicio;
              const dow = dayOfWeekFromKey(dateKey);
              const isOp = !isBeforeStart && diasOp.map(Number).includes(dow);
              return { dateKey, day: d + 1, dow, isBeforeStart, isOperating: isOp, tonsDia: 0, balanceAfter: 0, tone: isBeforeStart ? 'before' : isOp ? 'exhausted' : 'rest', isStockout: false };
            }) };
        return <MonthGrid key={ms.mk} year={ms.y} month={ms.m} firstDow={firstDow} days={days} onClick={() => handleExpandMonth(ms.mk)} />;
      });
    }

    return (
      <div className="disp-sim-calendar-empty">
        <CalendarDays size={44} />
        <p>Configura los parámetros para ver la proyección día a día</p>
      </div>
    );
  };

  return (
    <div className="disp-simulator">
      {/* ── Panel izquierdo ── */}
      <aside className="disp-sim-panel">
        <div className="disp-sim-section">
          <h4 className="disp-sim-section-title">Stock MMPP</h4>
          <div className="disp-sim-total">
            <span className="disp-sim-total-value">{fmtTons(totalTons)}</span>
            <span className="disp-sim-total-label">toneladas disponibles</span>
          </div>
          <label className="disp-sim-checkbox">
            <input type="checkbox" checked={incluirSemiCerrado} onChange={(e) => setIncluirSemiCerrado(e.target.checked)} />
            Incluir semi-cerrado
          </label>
        </div>

        <div className="disp-sim-section">
          <h4 className="disp-sim-section-title">Transporte</h4>
          <div className="mx-form-group">
            <label className="mx-label">Tipo de camión</label>
            <select className="mx-select" value={tipoTransporteId} onChange={(e) => setTipoTransporteId(e.target.value)}>
              <option value="">— seleccionar —</option>
              {tiposTransporte.map((t) => {
                const tc = tonsPorCamionDeTipo(t);
                return <option key={t._id} value={t._id}>{t.nombre}{tc ? ` · ${fmtNumber(tc, 1)} t` : ''}</option>;
              })}
            </select>
          </div>
          {!tipoTransporteId && (
            <div className="mx-form-group">
              <label className="mx-label">Tons / camión (manual)</label>
              <input className="mx-input" type="number" min="0.1" step="0.1" value={tonsPorCamionManual} onChange={(e) => setTonsPorCamionManual(e.target.value)} placeholder="ej: 11" />
            </div>
          )}
          {tonsPorCamion != null && <div className="disp-sim-computed">{fmtNumber(tonsPorCamion, 2)} t por camión</div>}
          <div className="mx-form-group">
            <label className="mx-label">Camiones por día</label>
            <input
              className="mx-input"
              type="number"
              min="1"
              max="30"
              value={camionesPerDay}
              onChange={(e) => setCamionesPerDay(e.target.value)}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                setCamionesPerDay(String(v > 0 ? v : 1));
              }}
            />
          </div>
          {tonsPorDia > 0 && <div className="disp-sim-computed disp-sim-computed--accent">{fmtTons(tonsPorDia)} / día operacional</div>}
        </div>

        <div className="disp-sim-section">
          <h4 className="disp-sim-section-title">Planificación</h4>
          <div className="mx-form-group">
            <label className="mx-label">Fecha inicio</label>
            <input className="mx-input" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div className="mx-form-group">
            <label className="mx-label">Días de operación</label>
            <div className="disp-sim-dias">
              {DIAS_SEMANA.map(({ value, label }) => (
                <button key={value} type="button" className={`disp-sim-dia-btn${diasOp.includes(value) ? ' is-active' : ''}`} onClick={() => toggleDia(value)}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {!viewMode && simulation && (
          <div className="disp-sim-summary">
            <div className="disp-sim-summary-row">
              <span>Días hábiles</span>
              <strong>{simulation.operatingDays}</strong>
            </div>
            <div className={`disp-sim-summary-row${simulation.stockoutKey ? ' disp-sim-summary-row--alert' : ''}`}>
              <span>Agotamiento estimado</span>
              <strong>{simulation.stockoutKey ? fmtDateKey(simulation.stockoutKey) : 'No se agota'}</strong>
            </div>
            <div className="disp-sim-summary-row">
              <span>Consumo diario</span>
              <strong>{fmtTons(tonsPorDia)}</strong>
            </div>
          </div>
        )}

        {!viewMode && !simulation && (
          <div className="disp-sim-empty-hint">Selecciona tipo de camión y configura los parámetros para ver la simulación.</div>
        )}
      </aside>

      {/* ── Sección derecha ── */}
      <div className="disp-sim-right">

        {/* Barra de filtro — una sola fila */}
        <div className="disp-sim-period-bar">
          {/* Navegador de año */}
          <button type="button" className="disp-sim-year-nav-btn" onClick={() => setViewYear((y) => y - 1)} aria-label="Año anterior">‹</button>
          <span className="disp-sim-year-label">{viewYear}</span>
          <button type="button" className="disp-sim-year-nav-btn" onClick={() => setViewYear((y) => y + 1)} aria-label="Año siguiente">›</button>

          <div className="disp-sim-period-sep" />

          {/* Modos: Año → Sem → Trim → Mes */}
          {[
            { key: 'año',  label: 'Año'  },
            { key: 'sem',  label: 'Sem'  },
            { key: 'trim', label: 'Trim' },
            { key: 'mes',  label: 'Mes'  },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`disp-sim-period-btn${viewMode === key ? ' is-active' : ''}`}
              onClick={() => handleMode(key)}
            >{label}</button>
          ))}

          {/* Sub-opciones: Semestres */}
          {viewMode === 'sem' && (
            <>
              <div className="disp-sim-period-sep" />
              {[
                { s: 1, label: 'S1', title: 'Ene–Jun' },
                { s: 2, label: 'S2', title: 'Jul–Dic' },
              ].map(({ s, label, title }) => (
                <button
                  key={s}
                  type="button"
                  className={`disp-sim-period-sub-btn${viewPeriod === s ? ' is-active' : ''}`}
                  onClick={() => handleSelectPeriod(s)}
                  title={title}
                >{label}</button>
              ))}
            </>
          )}

          {/* Sub-opciones: Trimestres */}
          {viewMode === 'trim' && (
            <>
              <div className="disp-sim-period-sep" />
              {[
                { t: 1, title: 'Ene–Mar' },
                { t: 2, title: 'Abr–Jun' },
                { t: 3, title: 'Jul–Sep' },
                { t: 4, title: 'Oct–Dic' },
              ].map(({ t, title }) => (
                <button
                  key={t}
                  type="button"
                  className={`disp-sim-period-sub-btn${viewPeriod === t ? ' is-active' : ''}`}
                  onClick={() => handleSelectPeriod(t)}
                  title={title}
                >T{t}</button>
              ))}
            </>
          )}

          {/* Sub-opciones: Meses */}
          {viewMode === 'mes' && (
            <>
              <div className="disp-sim-period-sep" />
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`disp-sim-period-sub-btn${viewPeriod === m ? ' is-active' : ''}`}
                  onClick={() => {
                    handleSelectPeriod(m);
                    handleExpandMonth(`${viewYear}-${pad(m)}`);
                  }}
                >{MONTHS_SHORT[m - 1]}</button>
              ))}
            </>
          )}
        </div>

        {/* Tarjetas mensuales de resumen */}
        <div className="disp-sim-month-cards">
          {monthStats.map((ms) => (
            <button
              key={ms.mk}
              type="button"
              className={`disp-sim-month-card disp-sim-month-card--${ms.tone}${expandedMonth === ms.mk ? ' is-expanded' : ''}`}
              onClick={() => handleExpandMonth(ms.mk)}
              title={`Ver detalle de ${MONTHS_ES[ms.m - 1]} ${ms.y}`}
            >
              <span className="disp-sim-mc-name">{MONTHS_SHORT[ms.m - 1]} {ms.y}</span>
              {ms.tone === 'empty' ? (
                <span className="disp-sim-mc-no-bio">Sin biomasa</span>
              ) : (
                <>
                  <span className="disp-sim-mc-avail">{fmtTons(ms.tonsAvail)}</span>
                  <span className="disp-sim-mc-label">disponible</span>
                  {tonsPorDia > 0 && (
                    <>
                      <span className="disp-sim-mc-needed">{fmtTons(ms.tonsNeeded)}</span>
                      <span className="disp-sim-mc-label">a procesar</span>
                      <span className={`disp-sim-mc-balance disp-sim-mc-balance--${ms.balance >= 0 ? 'pos' : 'neg'}`}>
                        {ms.balance >= 0 ? '+' : ''}{fmtTons(ms.balance)}
                      </span>
                      {ms.balance < 0 ? (
                        <span className="disp-sim-mc-covered">
                          Solo {Math.max(0, Math.floor(ms.tonsAvail / tonsPorDia))} de {ms.opDays} días cubiertos
                        </span>
                      ) : (
                        <span className="disp-sim-mc-days">{ms.opDays} días hábiles</span>
                      )}
                    </>
                  )}
                </>
              )}
            </button>
          ))}

          {tonsPorDia > 0 && monthStats.length > 1 && (
            <div className="disp-sim-month-card disp-sim-month-card--total">
              <span className="disp-sim-mc-name">Total</span>
              <span className="disp-sim-mc-avail">{fmtTons(annualSummary.totalAvail)}</span>
              <span className="disp-sim-mc-label">disponible</span>
              <span className="disp-sim-mc-needed">{fmtTons(annualSummary.totalNeeded)}</span>
              <span className="disp-sim-mc-label">a procesar</span>
              <span className={`disp-sim-mc-balance disp-sim-mc-balance--${annualSummary.totalAvail >= annualSummary.totalNeeded ? 'pos' : 'neg'}`}>
                {annualSummary.totalAvail - annualSummary.totalNeeded >= 0 ? '+' : ''}{fmtTons(annualSummary.totalAvail - annualSummary.totalNeeded)}
              </span>
              <span className="disp-sim-mc-days">{annualSummary.totalOpDays} días hábiles</span>
            </div>
          )}
        </div>

        {/* Encabezado cuando hay un mes expandido */}
        {expandedMonth && (
          <div className="disp-sim-expanded-header">
            <button type="button" className="disp-sim-back-btn" onClick={handleBack}>
              <ChevronLeft size={16} /> Volver
            </button>
            <span>Detalle: {MONTHS_ES[parseInt(expandedMonth.slice(5, 7), 10) - 1]} {expandedMonth.slice(0, 4)}</span>
          </div>
        )}

        {/* Calendario */}
        <div className={`disp-sim-calendar${expandedMonth ? ' disp-sim-calendar--single' : ''}`}>
          {renderCalendar()}
        </div>
      </div>
    </div>
  );
}
