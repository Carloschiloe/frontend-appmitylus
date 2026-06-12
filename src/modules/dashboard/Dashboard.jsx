import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';
import {
  Activity,
  CheckCircle,
  ShieldAlert,
  RotateCcw,
  TrendingUp,
  Users,
  ChevronRight,
  ArrowUpRight,
  Handshake,
  AlertTriangle,
  ClipboardList,
  Calendar,
  Droplet,
  TestTube2,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';

const QUICK_LINKS = [
  { label: 'Resumen Operativo', to: '/gestion/bandeja', icon: ClipboardList },
  { label: 'Agenda',            to: '/gestion/agenda',   icon: Calendar },
  { label: 'Tratos',            to: '/gestion/tratos',   icon: Handshake },
  { label: 'Prog. de Cosecha',  to: '/biomasa/programa', icon: Droplet },
  { label: 'Muestreos',         to: '/biomasa/muestreos',icon: TestTube2 },
];

const DashboardBiomasaChart = lazy(() => import('./DashboardBiomasaChart.jsx'));

const KpiCard = ({ title, value, sub, icon: Icon, color, trend }) => (
  <div className="mx-kpi-card-new">
    <div className="mx-kpi-card-header">
      <p className="mx-kpi-card-title">{title}</p>
      <div className="mx-kpi-card-icon" style={{ backgroundColor: `${color}15`, color }}>
        <Icon size={18} />
      </div>
    </div>
    <div className="mx-kpi-card-body">
      <h4 className="mx-kpi-card-value">{value ?? '—'}</h4>
      <div className="mx-kpi-card-footer">
        {trend != null && (
          <span className={`mx-kpi-trend ${trend >= 0 ? 'positive' : 'negative'}`}>
            <ArrowUpRight size={12} /> {Math.abs(trend)}%
          </span>
        )}
        {sub && <p className="mx-kpi-card-sub">{sub}</p>}
      </div>
    </div>
  </div>
);

function formatTons(n) {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)} kt`;
  return `${n} t`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  return `Hace ${Math.floor(hrs / 24)} días`;
}

const ESTADO_COLOR = {
  acordado: '#0A5CFF',
  negociando: '#3b82f6',
  compra_efectuada: '#10b981',
  caido: '#ef4444',
  prospecto: '#6366f1',
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, []);

  const speciesData = {
    labels: ['Disponible', 'Semicerrada', 'Cerrada', 'Descartada', 'Perdida'],
    datasets: [
      {
        data: [
          data?.biomasa?.disponible || 0,
          data?.biomasa?.semi_cerrado || 0,
          data?.biomasa?.cerrado || 0,
          data?.biomasa?.descartado || 0,
          data?.biomasa?.perdido || 0
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#dc2626', '#94a3b8', '#1e293b'],
        borderWidth: 0,
      },
    ],
  };

  if (loading) {
    return (
      <div className="mx-loading-screen">
        <div className="mx-spinner"></div>
        <p>Sincronizando métricas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-page dsh-premium">
        <div className="mx-content-frame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <AlertTriangle size={48} style={{ marginBottom: '16px', color: '#ef4444' }} />
            <h3 style={{ marginBottom: '8px' }}>{error}</h3>
            <button className="mx-btn mx-btn-primary" onClick={() => loadData()} style={{ marginTop: '16px' }}>
              <RotateCcw size={16} /> Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-page dsh-premium">
      <header className="mx-hero mx-hero--with-desc">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Inicio · Panel Ejecutivo</p>
          <h1>Panel Principal</h1>
          <p>Vista general de operación, biomasa y actividad reciente.</p>
        </div>
      </header>

      <div className="mx-content-frame">
        <div className="mx-page-stack">

          {/* Accesos rápidos + Actualizar */}
          <section style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {QUICK_LINKS.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="mx-btn mx-btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 600 }}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </div>
            <button className="mx-btn mx-btn-outline" onClick={() => loadData()}>
              <RotateCcw size={16} /> Actualizar
            </button>
          </section>

          {/* KPIs reales de la API */}
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
              color="#ef4444"
            />
          </section>

          <div className="dsh-main-grid">

            {/* Feed de actividad real */}
            <article className="dsh-card activity-feed">
              <div className="dsh-card-header">
                <h3 className="dsh-card-title">Actividad Reciente</h3>
              </div>
              <div className="dsh-activity-list">
                {!data?.actividad?.length ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                    <Activity size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '13px' }}>Sin actividad reciente</p>
                  </div>
                ) : data.actividad.map(item => (
                  <div key={item.id} className="dsh-activity-item">
                    <div className="activity-icon" style={{ color: ESTADO_COLOR[item.tipo] || '#64748b' }}>
                      <Activity size={16} />
                    </div>
                    <div className="activity-content">
                      <p className="activity-text">{item.titulo}</p>
                      <span className="activity-time">{item.descripcion} · {timeAgo(item.fecha)}</span>
                    </div>
                    <ChevronRight size={14} className="activity-arrow" />
                  </div>
                ))}
              </div>
            </article>

            {/* Top proveedores reales */}
            <article className="dsh-card">
              <div className="dsh-card-header">
                <h3 className="dsh-card-title">Top Proveedores</h3>
              </div>
              {!data?.topProveedores?.length ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                  <Users size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                  <p style={{ fontSize: '13px' }}>Sin datos de proveedores</p>
                </div>
              ) : (
                <div className="dsh-area-stats" style={{ marginTop: '16px' }}>
                  {data.topProveedores.map((p, i) => {
                    const max = data.topProveedores[0]?.tons || 1;
                    const pct = max > 0 ? Math.round((p.tons / max) * 100) : 0;
                    return (
                      <div key={i} className="area-stat-row">
                        <span style={{ fontSize: '12px', flex: '0 0 120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                        <div className="area-bar-wrap">
                          <div className="area-bar" style={{ width: `${pct}%`, background: '#0A5CFF' }}></div>
                        </div>
                        <span className="area-val">{p.tons ?? 0} t</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </div>

          <div className="dsh-secondary-grid">
            <article className="dsh-card">
              <h3 className="dsh-card-title sm">Estado de Biomasa</h3>
              <div style={{ height: '200px', marginTop: '16px' }}>
                <Suspense fallback={<div className="mx-skeleton dsh-chart-skeleton" />}>
                  <DashboardBiomasaChart data={speciesData} />
                </Suspense>
              </div>
            </article>

            <article className="dsh-card bg-primary-gradient">
              <h3 className="dsh-card-title sm text-white">Resumen Mensual</h3>
              <div className="dsh-white-box">
                <div className="white-box-kpi">
                  <span className="label">Acordado Mes</span>
                  <span className="value">{formatTons(data?.acordadoMes)}</span>
                </div>
                <div className="white-box-divider"></div>
                <div className="white-box-kpi">
                  <span className="label">En negociación</span>
                  <span className="value">{data?.enNegociacion ?? '—'}</span>
                </div>
              </div>
            </article>

            <article className="dsh-card">
              <div className="dsh-card-header">
                <h3 className="dsh-card-title sm">Áreas Sanitarias</h3>
              </div>
              {data?.alertas === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#10b981' }}>
                  <CheckCircle size={32} style={{ marginBottom: '8px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 600 }}>Sin alertas activas</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: '#ef4444' }}>
                  <ShieldAlert size={32} style={{ marginBottom: '8px' }} />
                  <p style={{ fontSize: '24px', fontWeight: 700 }}>{data?.alertas ?? '—'}</p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>áreas en estado crítico</p>
                </div>
              )}
            </article>
          </div>

        </div>
      </div>
    </div>
  );
}
