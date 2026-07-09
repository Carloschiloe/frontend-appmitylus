import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';
import {
  Activity,
  CheckCircle,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Users,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  Handshake,
  AlertTriangle,

  Calendar,
  Droplet,
  TestTube2,
  Scissors,
  Award,
  Clock,
  Truck,
  CalendarClock,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';

const DashboardBiomasaChart = lazy(() => import('./DashboardBiomasaChart.jsx'));

const QUICK_LINKS = [
  { label: 'Agenda',            to: '/gestion/agenda',     icon: Calendar },
  { label: 'Proveedores',       to: '/gestion/proveedores', icon: Users },
  { label: 'Tratos',            to: '/biomasa/tratos',     icon: Handshake },
  { label: 'Prog. de Cosecha',  to: '/biomasa/programa',   icon: Droplet },
  { label: 'Muestreos',         to: '/biomasa/muestreos',  icon: TestTube2 },
];

const ESTADO_CONFIG = {
  acordado:         { label: 'Acordado',        color: '#0A5CFF', bg: '#eff4ff' },
  negociando:       { label: 'Negociando',       color: '#f59e0b', bg: '#fffbeb' },
  compra_efectuada: { label: 'Compra efectuada', color: '#10b981', bg: '#f0fdf4' },
  caido:            { label: 'Caído',            color: '#ef4444', bg: '#fef2f2' },
  prospecto:        { label: 'Prospecto',        color: '#6366f1', bg: '#eef2ff' },
  disponible:       { label: 'Disponible',       color: '#10b981', bg: '#f0fdf4' },
};

const PIPELINE_STAGES = [
  { estado: 'prospecto',        label: 'Prospectos',    color: '#6366f1', bg: '#eef2ff' },
  { estado: 'negociando',       label: 'Negociando',    color: '#f59e0b', bg: '#fffbeb' },
  { estado: 'acordado',         label: 'Acordados',     color: '#0A5CFF', bg: '#eff4ff' },
  { estado: 'compra_efectuada', label: 'En cosecha',    color: '#10b981', bg: '#f0fdf4' },
];

const SEMAPHORE_CONFIG = [
  { key: 'verde',    label: 'Verde',    dot: '#16a34a' },
  { key: 'amarillo', label: 'Amarillo', dot: '#ca8a04' },
  { key: 'naranja',  label: 'Naranja',  dot: '#ea580c' },
  { key: 'rojo',     label: 'Rojo',     dot: '#dc2626' },
];

function getEstado(descripcion) {
  return descripcion?.replace('Estado actual: ', '').trim() || '';
}

function formatTons(n) {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)} kt`;
  return `${n.toLocaleString('es-CL')} t`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)} días`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function mesActualKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesLabel(key) {
  const [y, m] = String(key).split('-');
  return `${MESES_ES[parseInt(m, 10) - 1] || ''} ${y}`;
}

function sumarMeses(key, delta) {
  const [y, m] = String(key).split('-').map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function KpiCard({ title, value, sub, icon: Icon, color, trend, tooltip }) {
  const [open, setOpen] = React.useState(false);
  const hasTooltip = tooltip && tooltip.length > 0;
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div
      ref={ref}
      className={`dsh-kpi-card${open ? ' is-open' : ''}`}
      style={{ '--accent': color, cursor: hasTooltip ? 'pointer' : 'default' }}
      onClick={() => hasTooltip && setOpen(o => !o)}
    >
      <div className="dsh-kpi-accent" />
      <div className="dsh-kpi-header">
        <p className="dsh-kpi-title">{title}</p>
        <div className="dsh-kpi-icon" style={{ background: `${color}18`, color }}>
          <Icon size={17} />
        </div>
      </div>
      <h4 className="dsh-kpi-value">{value ?? '—'}</h4>
      <div className="dsh-kpi-footer">
        {trend != null && (
          <span className={`dsh-kpi-trend ${trend >= 0 ? 'up' : 'down'}`}>
            {trend >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="dsh-kpi-sub">{sub}</span>}
      </div>
      {hasTooltip && open && (
        <div className="dsh-kpi-tooltip" onClick={e => e.stopPropagation()}>
          {tooltip.map((line, i) => <div key={i} className="dsh-kpi-tooltip-row">{line}</div>)}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(mesActualKey);
  const esMesActual = mesSeleccionado === mesActualKey();

  async function loadData(signal, mes = mesSeleccionado) {
    setLoading(true);
    setError(null);
    try {
      const json = await apiClient.get(`/dashboard/summary?mes=${mes}`, { signal });
      setData(json);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError('No se pudieron cargar las métricas. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    loadData(ctrl.signal, mesSeleccionado);
    return () => ctrl.abort();
  }, [mesSeleccionado]); // eslint-disable-line react-hooks/exhaustive-deps

  const speciesData = useMemo(() => ({
    labels:   ['Disponible', 'Semicerrada', 'Cerrada', 'Descartada', 'Perdida'],
    datasets: [{
      data: [
        data?.biomasa?.disponible   || 0,
        data?.biomasa?.semi_cerrado || 0,
        data?.biomasa?.cerrado      || 0,
        data?.biomasa?.descartado   || 0,
        data?.biomasa?.perdido      || 0,
      ],
      backgroundColor: ['#10b981', '#f59e0b', '#dc2626', '#94a3b8', '#334155'],
      borderWidth: 0,
    }],
  }), [data]);

  const mesActual  = data?.acordadoMes     || 0;
  const mesProximo = data?.acordadoProxMes || 0;
  const deltaMes   = mesActual > 0 ? Math.round(((mesProximo - mesActual) / mesActual) * 100) : null;

  const pipelineMap = useMemo(() => {
    const m = {};
    (data?.pipeline || []).forEach(p => { m[p.estado] = p; });
    return m;
  }, [data]);

  const pipelineMaxCount = useMemo(
    () => PIPELINE_STAGES.reduce((max, s) => Math.max(max, pipelineMap[s.estado]?.count || 0), 1),
    [pipelineMap],
  );

  const cosechaData = data?.cosecha          || { programasHoy: 0, camionesHoy: 0, camionesHoyDetalle: [], vencenProximo: 0, vencenProximoDetalle: [], programasList: [] };
  const calidadData = data?.calidad          || null;
  const sanDetalle  = data?.sanitarioDetalle || {};
  const hasAlerts   = (data?.alertas || 0) > 0;
  const sanTotal    = Object.values(sanDetalle).reduce((s, d) => s + (d?.count || 0), 0);

  if (loading) {
    return (
      <div className="mx-loading-screen">
        <div className="mx-spinner" />
        <p>Sincronizando métricas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-page dsh-root">
        <div className="mx-content-frame dsh-error-frame">
          <AlertTriangle size={44} style={{ color: '#ef4444', marginBottom: 16 }} />
          <h3>{error}</h3>
          <button className="mx-btn mx-btn-primary" onClick={() => loadData()} style={{ marginTop: 16 }}>
            <RotateCcw size={15} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-page dsh-root">
      <header className="mx-hero mx-hero--with-desc">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Inicio · Panel Ejecutivo</p>
          <h1>Panel Principal</h1>
          <p>Vista general de operación, biomasa y actividad reciente.</p>
        </div>
      </header>

      <div className="mx-content-frame dsh-content-frame">
        <div className="mx-page-stack">

          {/* ── Barra de navegación rápida ───────────────────────────── */}
          <section className="dsh-nav-bar">
            <div className="dsh-nav-links">
              {QUICK_LINKS.map(({ label, to, icon: Icon }) => (
                <Link key={to} to={to} className="dsh-nav-link">
                  <Icon size={13} />
                  {label}
                </Link>
              ))}
            </div>
            <div className="dsh-month-picker">
              <button
                type="button"
                className="dsh-month-picker-arrow"
                title="Mes anterior"
                onClick={() => setMesSeleccionado((prev) => sumarMeses(prev, -1))}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="dsh-month-picker-label">{mesLabel(mesSeleccionado)}</span>
              <button
                type="button"
                className="dsh-month-picker-arrow"
                title="Mes siguiente"
                onClick={() => setMesSeleccionado((prev) => sumarMeses(prev, 1))}
              >
                <ChevronRight size={14} />
              </button>
              {!esMesActual && (
                <button
                  type="button"
                  className="dsh-month-picker-today"
                  onClick={() => setMesSeleccionado(mesActualKey())}
                >
                  Hoy
                </button>
              )}
            </div>
            <button className="mx-btn mx-btn-outline dsh-refresh-btn" onClick={() => loadData()}>
              <RotateCcw size={13} /> Actualizar
            </button>
          </section>

          {/* ── Row 1: KPIs ──────────────────────────────────────────── */}
          <section className="dsh-kpi-grid">
            <KpiCard
              title={`Tons Acordadas (${mesLabel(mesSeleccionado)})`}
              value={formatTons(data?.acordadoMes)}
              sub={esMesActual ? 'Acumulado este mes' : 'Acumulado ese mes'}
              icon={CheckCircle}
              color="#0A5CFF"
              tooltip={[
                `${mesLabel(sumarMeses(mesSeleccionado, 1))}: ${formatTons(data?.acordadoProxMes || 0)}`,
                ...(data?.topProveedores || []).slice(0, 4).map(p => `${p.nombre}: ${formatTons(p.tons)}`),
              ]}
            />
            <KpiCard
              title="Programas Activos Hoy"
              value={cosechaData.programasHoy}
              sub="Proveedores cosechando"
              icon={Scissors}
              color="#10b981"
              tooltip={(cosechaData.programasList || []).map(p => `${p.nombre} — hasta ${formatShortDate(p.vigenciaHasta)}`)}
            />
            <KpiCard
              title="Camiones Hoy"
              value={cosechaData.camionesHoy}
              sub="Programados para hoy"
              icon={Truck}
              color="#0891b2"
              tooltip={(cosechaData.camionesHoyDetalle || []).map(p => `${p.nombre}: ${p.camiones} cam`)}
            />
            <KpiCard
              title="Vencen en 7 días"
              value={cosechaData.vencenProximo}
              sub="Programas por vencer"
              icon={CalendarClock}
              color={cosechaData.vencenProximo > 0 ? '#f59e0b' : '#10b981'}
              tooltip={(cosechaData.vencenProximoDetalle || []).map(p => `${p.nombre} — ${formatShortDate(p.vigenciaHasta)}`)}
            />
            <KpiCard
              title="En Negociación"
              value={data?.enNegociacion ?? '—'}
              sub="Oportunidades activas"
              icon={Handshake}
              color="#6366f1"
              tooltip={(data?.pipeline || [])
                .filter(p => ['prospecto', 'negociando', 'acordado', 'compra_efectuada'].includes(p.estado) && p.count > 0)
                .map(p => {
                  const s = PIPELINE_STAGES.find(s => s.estado === p.estado);
                  return `${s?.label || p.estado}: ${p.count}${p.tons > 0 ? ' · ' + formatTons(p.tons) : ''}`;
                })}
            />
            <KpiCard
              title="Alertas Sanitarias"
              value={data?.alertas ?? '—'}
              sub="Áreas naranja / rojo"
              icon={hasAlerts ? ShieldAlert : ShieldCheck}
              color={hasAlerts ? '#ef4444' : '#10b981'}
              tooltip={[
                ...(sanDetalle.rojo?.areas || []).slice(0, 5).map(a => `Rojo: ${a}`),
                ...(sanDetalle.naranja?.areas || []).slice(0, 5).map(a => `Naranja: ${a}`),
              ]}
            />
          </section>

          {/* ── Row 2: Pipeline + Cosecha + Actividad ───────────────── */}
          <div className="dsh-trio-grid">

            {/* Pipeline funnel */}
            <article className="dsh-card">
              <div className="dsh-card-header">
                <div>
                  <h3 className="dsh-card-title">Pipeline de Tratos</h3>
                  <p className="dsh-card-subtitle">Ciclo comercial activo por etapa</p>
                </div>
                <Link to="/biomasa/tratos" className="dsh-link-all">
                  Ver tratos <ChevronRight size={12} />
                </Link>
              </div>

              <div className="dsh-funnel">
                {PIPELINE_STAGES.map(({ estado, label, color, bg }) => {
                  const st   = pipelineMap[estado] || { count: 0, tons: 0 };
                  const barW = Math.round((st.count / pipelineMaxCount) * 100);
                  return (
                    <div key={estado} className="dsh-funnel-row">
                      <div className="dsh-funnel-dot" style={{ background: color }} />
                      <span className="dsh-funnel-label">{label}</span>
                      <div className="dsh-funnel-track">
                        <div className="dsh-funnel-fill" style={{ '--fw': `${barW}%`, '--fc': color }} />
                      </div>
                      <span className="dsh-funnel-count" style={{ color, background: bg }}>
                        {st.count}
                      </span>
                      <span className="dsh-funnel-tons">{st.tons > 0 ? formatTons(st.tons) : '—'}</span>
                    </div>
                  );
                })}
              </div>

              {(() => {
                const caidos    = pipelineMap['caido']?.count || 0;
                const cierres   = (pipelineMap['acordado']?.count || 0) + (pipelineMap['compra_efectuada']?.count || 0);
                const conv      = (cierres + caidos) > 0 ? Math.round((cierres / (cierres + caidos)) * 100) : null;
                return (
                  <div className="dsh-funnel-footer">
                    <span>
                      <span className="dsh-funnel-footer-label">Caídos</span>
                      <span className="dsh-funnel-footer-val" style={{ color: '#ef4444' }}>{caidos}</span>
                    </span>
                    {conv != null && (
                      <span>
                        <span className="dsh-funnel-footer-label">Tasa de cierre</span>
                        <span className="dsh-funnel-footer-val" style={{ color: '#10b981' }}>{conv}%</span>
                      </span>
                    )}
                  </div>
                );
              })()}
            </article>

            {/* Cosecha activa */}
            <article className="dsh-card dsh-cosecha-card">
              <div className="dsh-card-header">
                <div>
                  <h3 className="dsh-card-title">Cosecha Activa</h3>
                  <p className="dsh-card-subtitle">Programas cosechando hoy</p>
                </div>
                <span className={`dsh-cosecha-badge ${cosechaData.programasHoy > 0 ? 'active' : ''}`}>
                  {cosechaData.programasHoy}
                </span>
              </div>

              {cosechaData.programasList.length === 0 ? (
                <div className="dsh-empty">
                  <Scissors size={26} />
                  <p>Sin programas activos hoy</p>
                </div>
              ) : (
                <div className="dsh-cosecha-list">
                  {cosechaData.programasList.map((p, i) => (
                    <div key={i} className="dsh-cosecha-item">
                      <div className="dsh-cosecha-dot" />
                      <div className="dsh-cosecha-info">
                        <span className="dsh-cosecha-name">{p.nombre}</span>
                        <span className="dsh-cosecha-until">
                          <Clock size={10} />
                          hasta {formatShortDate(p.vigenciaHasta)}
                        </span>
                      </div>
                      {p.tons != null && (
                        <span className="dsh-cosecha-tons">{formatTons(p.tons)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Link to="/biomasa/programa" className="dsh-cosecha-footer-link">
                Ver programa de cosecha <ChevronRight size={12} />
              </Link>
            </article>

            {/* Actividad Reciente */}
            <article className="dsh-card">
              <div className="dsh-card-header">
                <h3 className="dsh-card-title">Actividad Reciente</h3>
                <Link to="/biomasa/tratos" className="dsh-link-all">
                  Ver todos <ChevronRight size={12} />
                </Link>
              </div>
              <div className="dsh-feed">
                {!data?.actividad?.length ? (
                  <div className="dsh-empty">
                    <Activity size={26} />
                    <p>Sin actividad reciente</p>
                  </div>
                ) : data.actividad.map((item) => {
                  const estado = getEstado(item.descripcion);
                  const cfg    = ESTADO_CONFIG[estado] || {};
                  return (
                    <Link key={item.id} to="/biomasa/tratos" className="dsh-feed-item">
                      <div className="dsh-feed-icon" style={{ background: `${cfg.color || '#64748b'}18`, color: cfg.color || '#64748b' }}>
                        <Handshake size={14} />
                      </div>
                      <div className="dsh-feed-body">
                        <p className="dsh-feed-title">{item.titulo}</p>
                        <span className="dsh-feed-time">{timeAgo(item.fecha)}</span>
                      </div>
                      {estado && cfg.label && (
                        <span className="dsh-estado-pill" style={{ color: cfg.color, background: cfg.bg }}>
                          {cfg.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </article>
          </div>

          {/* ── Row 3: Proveedores · Distribución · Sanitario · Calidad · Proyección */}
          <div className="dsh-quad-grid">

            <article className="dsh-card">
              <div className="dsh-card-header">
                <div>
                  <h3 className="dsh-card-title">Top Proveedores</h3>
                  <p className="dsh-card-subtitle">Biomasa disponible aproximada</p>
                </div>
                <Link to="/centros" className="dsh-link-all">
                  Ver directorio <ChevronRight size={12} />
                </Link>
              </div>
              {(() => {
                const withTons  = (data?.topProveedores || []).filter(p => (p.tons || 0) > 0 && p.nombre);
                if (!withTons.length) {
                  return (
                    <div className="dsh-empty">
                      <Users size={26} />
                      <p>Sin biomasa registrada</p>
                    </div>
                  );
                }
                const maxTons   = withTons[0]?.tons || 1;
                const totalTons = withTons.reduce((s, p) => s + (p.tons || 0), 0);
                return (
                  <>
                    <div className="dsh-providers">
                      {withTons.map((p, i) => {
                        const barPct   = Math.round((p.tons / maxTons) * 100);
                        const sharePct = Math.round((p.tons / totalTons) * 100);
                        return (
                          <div key={i} className="dsh-provider-row">
                            <span className="dsh-provider-rank">{i + 1}</span>
                            <div className="dsh-provider-info">
                              <div className="dsh-provider-nameline">
                                <span className="dsh-provider-name">{p.nombre}</span>
                                <span className="dsh-provider-share">{sharePct}%</span>
                              </div>
                              <div className="dsh-bar-track">
                                <div className="dsh-bar-fill" style={{ '--w': `${barPct}%` }} />
                              </div>
                            </div>
                            <span className="dsh-provider-tons">{p.tons.toLocaleString('es-CL')} t</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="dsh-providers-total">
                      <span>Total registrado</span>
                      <strong>{totalTons.toLocaleString('es-CL')} t</strong>
                    </div>
                  </>
                );
              })()}
            </article>

            {/* Distribución de tratos (donut) */}
            <article className="dsh-card">
              <h3 className="dsh-section-label">Distribución de Tratos</h3>
              <div className="dsh-donut-wrap">
                <Suspense fallback={<div className="mx-skeleton dsh-chart-skeleton" />}>
                  <DashboardBiomasaChart data={speciesData} />
                </Suspense>
              </div>
            </article>

            {/* Semáforo sanitario */}
            <article className="dsh-card">
              <div className="dsh-card-header">
                <h3 className="dsh-card-title">Estado Sanitario</h3>
                <Link to="/centros" className="dsh-link-all">
                  Ver áreas <ChevronRight size={12} />
                </Link>
              </div>
              <div className="dsh-semaphore">
                {SEMAPHORE_CONFIG.map(({ key, label, dot }) => {
                  const sd         = sanDetalle[key] || { count: 0, areas: [] };
                  const isCritical = (key === 'naranja' || key === 'rojo') && sd.count > 0;
                  return (
                    <div key={key} className={`dsh-semaphore-row${isCritical ? ' critical' : ''}`}>
                      <div className="dsh-semaphore-left">
                        <div className="dsh-semaphore-dot" style={{ background: dot }} />
                        <span className="dsh-semaphore-label">{label}</span>
                      </div>
                      <span className="dsh-semaphore-count" style={{ color: dot }}>
                        {sd.count}
                      </span>
                      {isCritical && sd.areas.length > 0 && (
                        <div className="dsh-semaphore-areas">{sd.areas.join(', ')}</div>
                      )}
                    </div>
                  );
                })}
                {sanTotal > 0 && (
                  <div className="dsh-semaphore-total">
                    <span>Total monitoreadas</span>
                    <strong>{sanTotal}</strong>
                  </div>
                )}
              </div>
            </article>

            {/* Calidad promedio */}
            <article className="dsh-card">
              <div className="dsh-card-header">
                <div>
                  <h3 className="dsh-card-title">Calidad Promedio</h3>
                  <p className="dsh-card-subtitle">
                    {calidadData?.count
                      ? `${calidadData.count} proveedor${calidadData.count === 1 ? '' : 'es'} · cosecha activa`
                      : 'Sin datos de proveedores activos'}
                  </p>
                </div>
                <Link to="/biomasa/muestreos" className="dsh-link-all">
                  Ver <ChevronRight size={12} />
                </Link>
              </div>
              {!calidadData || calidadData.count === 0 ? (
                <div className="dsh-empty">
                  <TestTube2 size={26} />
                  <p>Sin muestreos de proveedores activos</p>
                </div>
              ) : (
                <div className="dsh-calidad-grid">
                  <div className="dsh-calidad-metric">
                    <span className="dsh-calidad-value">
                      {calidadData.avgRendimiento != null ? `${calidadData.avgRendimiento}%` : '—'}
                    </span>
                    <span className="dsh-calidad-label">Rendimiento</span>
                  </div>
                  <div className="dsh-calidad-metric">
                    <span className="dsh-calidad-value">
                      {calidadData.avgUxkg != null ? calidadData.avgUxkg : '—'}
                    </span>
                    <span className="dsh-calidad-label">u/kg Calibre</span>
                  </div>
                  <div className="dsh-calidad-metric danger">
                    <span className="dsh-calidad-value">
                      {calidadData.avgRechazos != null ? `${calidadData.avgRechazos}%` : '—'}
                    </span>
                    <span className="dsh-calidad-label">Rechazos</span>
                  </div>
                </div>
              )}
            </article>

            {/* Proyección mensual */}
            <article className="dsh-card dsh-card-dark">
              <h3 className="dsh-section-label" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Proyección Mensual
              </h3>
              <div className="dsh-projection">
                <div className="dsh-proj-month">
                  <span className="dsh-proj-label">{esMesActual ? 'Este mes' : mesLabel(mesSeleccionado)}</span>
                  <span className="dsh-proj-value">{formatTons(data?.acordadoMes)}</span>
                </div>
                <div className="dsh-proj-arrow">
                  {deltaMes != null ? (
                    <>
                      {deltaMes >= 0
                        ? <TrendingUp  size={18} style={{ color: '#4ade80' }} />
                        : <TrendingDown size={18} style={{ color: '#fca5a5' }} />}
                      <span className={`dsh-proj-delta ${deltaMes >= 0 ? 'up' : 'down'}`}>
                        {deltaMes >= 0 ? '+' : ''}{deltaMes}%
                      </span>
                    </>
                  ) : (
                    <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.25)' }} />
                  )}
                </div>
                <div className="dsh-proj-month">
                  <span className="dsh-proj-label">{esMesActual ? 'Próximo mes' : mesLabel(sumarMeses(mesSeleccionado, 1))}</span>
                  <span className="dsh-proj-value">{formatTons(data?.acordadoProxMes)}</span>
                </div>
              </div>
              <div className="dsh-proj-divider" />
              <div className="dsh-proj-stat">
                <span className="dsh-proj-stat-label">En negociación</span>
                <span className="dsh-proj-stat-val">{data?.enNegociacion ?? 0} tratos</span>
              </div>
            </article>
          </div>

        </div>
      </div>
    </div>
  );
}
