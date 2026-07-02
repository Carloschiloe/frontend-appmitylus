import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { fmtTons, fmtNumber, tonsPorCamionDeTipo } from '../utils/programaCalculos';
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

      days.push({
        dateKey,
        day: d,
        dow,
        isBeforeStart,
        isOperating,
        tonsDia,
        balanceAfter: Math.max(0, totalTons - consumed),
        tone,
        isStockout: stockoutKey === dateKey,
      });
    }

    monthsData.push({ year: y, month: m, firstDow, days });

    // Stop rendering after stockout month + 1 buffer, always at least 2 months
    if (stockoutKey && mi >= 1) break;
  }

  return { monthsData, stockoutKey, operatingDays };
}

function fmtDateKey(key) {
  if (!key) return '—';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export default function DisponibilidadSimulador({ items, tiposTransporte }) {
  const [incluirSemiCerrado, setIncluirSemiCerrado] = useState(true);
  const [tipoTransporteId, setTipoTransporteId] = useState('');
  const [tonsPorCamionManual, setTonsPorCamionManual] = useState('');
  const [camionesPerDay, setCamionesPerDay] = useState(2);
  const [fechaInicio, setFechaInicio] = useState(() => todayKey());
  const [diasOp, setDiasOp] = useState([0, 1, 2, 3, 4]); // Dom–Jue por defecto

  const totalTons = useMemo(() => {
    const estados = incluirSemiCerrado ? ['disponible', 'semi_cerrado'] : ['disponible'];
    return items
      .filter((item) => estados.includes(item.estado || 'disponible'))
      .reduce((sum, item) => sum + Number(item.tons || item.tonsDisponible || 0), 0);
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

  const tonsPorDia = tonsPorCamion != null ? camionesPerDay * tonsPorCamion : 0;

  const simulation = useMemo(() => {
    if (!tonsPorDia || totalTons <= 0 || !fechaInicio) return null;
    return buildSimulation(totalTons, tonsPorDia, fechaInicio, diasOp);
  }, [totalTons, tonsPorDia, fechaInicio, diasOp]);

  const toggleDia = (dow) => {
    setDiasOp((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b),
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
            <input
              type="checkbox"
              checked={incluirSemiCerrado}
              onChange={(e) => setIncluirSemiCerrado(e.target.checked)}
            />
            Incluir semi-cerrado
          </label>
        </div>

        <div className="disp-sim-section">
          <h4 className="disp-sim-section-title">Transporte</h4>
          <div className="mx-form-group">
            <label className="mx-label">Tipo de camión</label>
            <select
              className="mx-select"
              value={tipoTransporteId}
              onChange={(e) => setTipoTransporteId(e.target.value)}
            >
              <option value="">— seleccionar —</option>
              {tiposTransporte.map((t) => {
                const tc = tonsPorCamionDeTipo(t);
                return (
                  <option key={t._id} value={t._id}>
                    {t.nombre}{tc ? ` · ${fmtNumber(tc, 1)} t` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          {!tipoTransporteId && (
            <div className="mx-form-group">
              <label className="mx-label">Tons / camión (manual)</label>
              <input
                className="mx-input"
                type="number"
                min="0.1"
                step="0.1"
                value={tonsPorCamionManual}
                onChange={(e) => setTonsPorCamionManual(e.target.value)}
                placeholder="ej: 11"
              />
            </div>
          )}
          {tonsPorCamion != null && (
            <div className="disp-sim-computed">{fmtNumber(tonsPorCamion, 2)} t por camión</div>
          )}
          <div className="mx-form-group">
            <label className="mx-label">Camiones por día</label>
            <input
              className="mx-input"
              type="number"
              min="1"
              max="30"
              value={camionesPerDay}
              onChange={(e) => setCamionesPerDay(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
          {tonsPorDia > 0 && (
            <div className="disp-sim-computed disp-sim-computed--accent">
              {fmtTons(tonsPorDia)} / día operacional
            </div>
          )}
        </div>

        <div className="disp-sim-section">
          <h4 className="disp-sim-section-title">Planificación</h4>
          <div className="mx-form-group">
            <label className="mx-label">Fecha inicio</label>
            <input
              className="mx-input"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="mx-form-group">
            <label className="mx-label">Días de operación</label>
            <div className="disp-sim-dias">
              {DIAS_SEMANA.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`disp-sim-dia-btn${diasOp.includes(value) ? ' is-active' : ''}`}
                  onClick={() => toggleDia(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {simulation && (
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
            <div className="disp-sim-summary-row">
              <span>Stock total</span>
              <strong>{fmtTons(totalTons)}</strong>
            </div>
          </div>
        )}

        {!simulation && (
          <div className="disp-sim-empty-hint">
            Selecciona tipo de camión y configura los parámetros para ver la simulación.
          </div>
        )}
      </aside>

      {/* ── Calendario ── */}
      <div className="disp-sim-calendar">
        {simulation ? (
          simulation.monthsData.map(({ year, month, firstDow, days }) => (
            <div key={`${year}-${month}`} className="disp-sim-month">
              <div className="disp-sim-month-title">{MONTHS_ES[month]} {year}</div>
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
                    {tonsDia > 0 && (
                      <span className="disp-sim-day-tons">
                        {fmtNumber(tonsDia, 0)}t
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="disp-sim-calendar-empty">
            <CalendarDays size={44} />
            <p>Configura los parámetros para ver la proyección día a día</p>
          </div>
        )}
      </div>
    </div>
  );
}
