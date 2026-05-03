import React, { useState, useEffect } from 'react';
import { Activity, Calendar, CheckCircle, ShieldAlert, Hourglass, RotateCcw, TrendingUp } from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title 
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

// Registro de componentes de Chart.js
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title
);

const KpiCard = ({ title, value, icon: Icon, color, bgColor }) => (
  <div className="mx-kpi">
    <div className="dsh-kpi-row" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div className="dsh-kpi-icon" style={{ backgroundColor: bgColor, color: color, padding: '12px', borderRadius: '12px', display: 'flex' }}>
        <Icon size={24} />
      </div>
      <div className="dsh-kpi-body">
        <div className="mx-kpi-value">{value || '0'}</div>
        <div className="mx-kpi-label">{title}</div>
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const json = await apiClient.get('/dashboard/summary');
        setData(json);
      } catch (err) {
        console.error('Error cargando dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const doughnutData = {
    labels: ['Acordado', 'En Negociación'],
    datasets: [
      {
        data: [data?.acordadoMes || 0, (data?.enNegociacion || 0) * 10], 
        backgroundColor: ['#10b981', '#f59e0b'],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const barData = {
    labels: data?.topProveedores?.map(p => p.nombre.substring(0, 10)) || [],
    datasets: [
      {
        label: 'Toneladas Disponibles',
        data: data?.topProveedores?.map(p => p.tons) || [],
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderRadius: 6,
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

  return (
    <div className="dashboard-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Panel principal · Mitynex Prime</p>
          <h1>Resumen Operativo</h1>
          <p>Control de abastecimiento y alertas sanitarias en tiempo real.</p>
        </div>
      </header>

      <div className="dsh-content-frame" style={{ padding: '0 var(--page-padding) 40px var(--page-padding)', marginTop: '-30px' }}>
        <div className="mx-page-stack">
          {/* KPIs Principales */}
          <section className="mx-kpis">
            <KpiCard 
              title="Acordado · este mes" 
              value={data?.acordadoMes ? `${data.acordadoMes} t` : '0 t'} 
              icon={CheckCircle} 
              color="#059669" 
              bgColor="#d1fae5" 
            />
            <KpiCard 
              title="Acordado · próx. mes" 
              value={data?.acordadoProxMes ? `${data.acordadoProxMes} t` : '0 t'} 
              icon={Calendar} 
              color="#2563eb" 
              bgColor="#dbeafe" 
            />
            <KpiCard 
              title="En negociación" 
              value={data?.enNegociacion} 
              icon={Hourglass} 
              color="#d97706" 
              bgColor="#fef3c7" 
            />
            <KpiCard 
              title="Alertas sanitarias" 
              value={data?.alertas} 
              icon={ShieldAlert} 
              color="#dc2626" 
              bgColor="#fee2e2" 
            />
          </section>

          <div className="dsh-mid-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            <article className="mx-kpi" style={{ padding: '24px' }}>
              <h3 className="mx-kpi-label" style={{ fontSize: '1rem', marginBottom: '20px' }}>
                <TrendingUp size={18} style={{ marginRight: '8px' }} /> Distribución de Carga
              </h3>
              <div style={{ height: '240px', display: 'flex', justifyContent: 'center' }}>
                <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
              </div>
            </article>

            <article className="mx-kpi" style={{ padding: '24px' }}>
              <h3 className="mx-kpi-label" style={{ fontSize: '1rem', marginBottom: '20px' }}>
                <Activity size={18} style={{ marginRight: '8px' }} /> Top Proveedores (t)
              </h3>
              <div style={{ height: '240px' }}>
                <Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            </article>

            <article className="mx-kpi" style={{ padding: '24px' }}>
              <h3 className="mx-kpi-label" style={{ fontSize: '1rem', marginBottom: '20px' }}>
                <RotateCcw size={18} style={{ marginRight: '8px' }} /> Actividad Reciente
              </h3>
              <div className="mx-state-placeholder" style={{ border: 'none', padding: '20px' }}>
                <p style={{ fontSize: '0.9rem' }}>No hay eventos recientes</p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
