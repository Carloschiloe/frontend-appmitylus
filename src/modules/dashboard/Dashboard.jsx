import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';
import {
  Activity,
  CheckCircle,
  ShieldAlert,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Users,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Handshake,
  AlertTriangle,
  ClipboardList,
  Calendar,
  Droplet,
  TestTube2,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';

const QUICK_LINKS = [
  { label: 'Resumen Operativo', to: '/gestion/bandeja',   icon: ClipboardList },
  { label: 'Agenda',            to: '/gestion/agenda',     icon: Calendar },
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

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#b45309', '#64748b', '#64748b'];

const DashboardBiomasaChart = lazy(() => import('./DashboardBiomasaChart.jsx'));

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
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)} días`;
}

const KpiCard = ({ title, value, sub, icon: Icon, color, trend }) => (
  <div className="dsh-kpi-card" style={{ '--accent': color }}>
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
  </div>
);

export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  async function loadData(signal) {
    setLoading(true);
    setError(null);
    try {
      const json = await apiClient.get('/dashboard/summary', { signal });
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
    loadData(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  const speciesData = useMemo(() => ({
    labels: ['Disponible', 'Semicerrada', 'Cerrada', 'Descartada', 'Perdida'],
    datasets: [{
      data: [
        data?.biomasa?.disponible    || 0,
        data?.biomasa?.semi_cerrado  || 0,
        data?.biomasa?.cerrado       || 0,
        data?.biomasa?.descartado    || 0,
        data?.biomasa?.perdido       || 0,
      ],
      backgroundColor: ['#10b981', '#f59e0b', '#dc2626', '#94a3b8', '#334155'],
      borderWidth: 0,
    }],
  }), [data]);

  const mesActual  = data?.acordadoMes     || 0;
  const mesProximo = data?.acordadoProxMes || 0;
  const deltaMes   = mesActual > 0 ? Math.round(((mesProximo - mesActual) / mesActual) * 100) : null;

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

  const hasAlerts = (data?.alertas || 0) > 0;

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

          {/* ── Barra de navegación rápida ─────────────────────────────── */}
          <section className="dsh-nav-bar">
            <div className="dsh-nav-links">
              {QUICK_LINKS.map(({ label, to, icon: Icon }) => (
                <Link key={to} to={to} className="dsh-nav-link">
                  <Icon size={13} />
                  {label}
                </Link>
              ))}
            </div>
            <button className="mx-btn mx-btn-outline dsh-refresh-btn" onClick={() => loadData()}>
              <RotateCcw size={13} /> Actualizar
            </button>
          </section>

          {/* ── KPIs ───────────────────────────────────────────────────── */}
          <section className="dsh-kpi-grid">
            <KpiCard
              title="Tons Acordadas (mes)"
              value={formatTons(data?.acordadoMes)}
              sub="Acumulado este mes"
              icon={CheckCircle}
              color="#0A5CFF"
            />
            <KpiCard
              title="Tons Próximo Mes"
              value={formatTons(data?.acordadoProxMes)}
              sub="Proyección siguiente mes"
              icon={TrendingUp}
              color="#3b82f6"
              trend={deltaMes}
            />
            <KpiCard
              title="En Negociación"
              value={data?.enNegociacion ?? '—'}
              sub="Oportunidades activas"
              icon={Handshake}
              color="#6366f1"
            />
            <KpiCard
              title="Alertas Sanitarias"
              value={data?.alertas ?? '—'}
              sub="Áreas naranja/rojo activas"
              icon={ShieldAlert}
              color={hasAlerts ? '#ef4444' : '#10b981'}
            />
          </section>

          {/* ── Actividad + Top Proveedores ────────────────────────────── */}
          <div className="dsh-main-grid">

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
                  const cfg = ESTADO_CONFIG[estado] || {};
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

            <article className="dsh-card">
              <div className="dsh-card-header">
                <h3 className="dsh-card-title">Top Proveedores</h3>
                <Link to="/centros" className="dsh-link-all">
                  Ver directorio <ChevronRight size={12} />
                </Link>
              </div>
              {!data?.topProveedores?.length ? (
                <div className="dsh-empty">
                  <Users size={26} />
                  <p>Sin datos de proveedores</p>
                </div>
              ) : (
                <div className="dsh-providers">
                  {data.topProveedores.map((p, i) => {
                    const max = data.topProveedores[0]?.tons || 1;
                    const pct = max > 0 ? Math.round((p.tons / max) * 100) : 0;
                    return (
                      <div key={i} className="dsh-provider-row">
                        <span className="dsh-provider-rank" style={{ color: RANK_COLORS[i] }}>
                          {i + 1}
                        </span>
                        <div className="dsh-provider-info">
                          <span className="dsh-provider-name">{p.nombre}</span>
                          <div className="dsh-bar-track">
                            <div
                              className="dsh-bar-fill"
                              style={{ '--w': `${pct}%`, background: i === 0 ? RANK_COLORS[0] : '#0A5CFF' }}
                            />
                          </div>
                        </div>
                        <span className="dsh-provider-tons">
                          {(p.tons ?? 0).toLocaleString('es-CL')} t
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </div>

          {/* ── Fila inferior ──────────────────────────────────────────── */}
          <div className="dsh-secondary-grid">

            {/* Donut de estados */}
            <article className="dsh-card">
              <h3 className="dsh-section-label">Estado de Biomasa</h3>
              <div className="dsh-donut-wrap">
                <Suspense fallback={<div className="mx-skeleton dsh-chart-skeleton" />}>
                  <DashboardBiomasaChart data={speciesData} />
                </Suspense>
              </div>
            </article>

            {/* Proyección mensual */}
            <article className="dsh-card dsh-card-dark">
              <h3 className="dsh-section-label" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Proyección Mensual
              </h3>
              <div className="dsh-projection">
                <div className="dsh-proj-month">
                  <span className="dsh-proj-label">Este mes</span>
                  <span className="dsh-proj-value">{formatTons(data?.acordadoMes)}</span>
                </div>
                <div className="dsh-proj-arrow">
                  {deltaMes != null ? (
                    <>
                      {deltaMes >= 0
                        ? <TrendingUp size={18} style={{ color: '#4ade80' }} />
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
                  <span className="dsh-proj-label">Próximo mes</span>
                  <span className="dsh-proj-value">{formatTons(data?.acordadoProxMes)}</span>
                </div>
              </div>
              <div className="dsh-proj-divider" />
              <div className="dsh-proj-stat">
                <span className="dsh-proj-stat-label">En negociación</span>
                <span className="dsh-proj-stat-val">{data?.enNegociacion ?? 0} tratos</span>
              </div>
            </article>

            {/* Áreas sanitarias */}
            <article className="dsh-card dsh-sanitario-card">
              <h3 className="dsh-section-label">Áreas Sanitarias</h3>
              <div className="dsh-sanitario-body">
                {!hasAlerts ? (
                  <>
                    <div className="dsh-sanitario-icon ok"><CheckCircle size={26} /></div>
                    <p className="dsh-sanitario-label ok">Sin alertas activas</p>
                    <p className="dsh-sanitario-sub">Todas las áreas en estado normal</p>
                  </>
                ) : (
                  <>
                    <div className="dsh-sanitario-icon alert"><ShieldAlert size={26} /></div>
                    <p className="dsh-sanitario-count">{data.alertas}</p>
                    <p className="dsh-sanitario-label alert">áreas en estado crítico</p>
                    <Link to="/centros" className="dsh-sanitario-link">
                      Ver áreas <ChevronRight size={11} />
                    </Link>
                  </>
                )}
              </div>
            </article>
          </div>

        </div>
      </div>
    </div>
  );
}
