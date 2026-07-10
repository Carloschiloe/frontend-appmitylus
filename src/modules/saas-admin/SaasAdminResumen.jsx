import React from 'react';
import { Building2, Users, Activity, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { empresasApi } from '../../api/api-empresas';
import { usuariosApi } from '../../api/api-usuarios';
import './SaasAdminResumen.css';

const DIA_MS = 24 * 60 * 60 * 1000;

function timeAgo(dateStr) {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Hace ${weeks} sem`;
  return new Date(dateStr).toLocaleDateString('es-CL');
}

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="sar-kpi-card">
      <div className="sar-kpi-icon" style={{ background: `${color}18`, color }}>
        <Icon size={18} />
      </div>
      <div>
        <div className="sar-kpi-value">{value}</div>
        <div className="sar-kpi-label">{label}</div>
        {sub && <div className="sar-kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function SaasAdminResumen() {
  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery({
    queryKey: ['empresas'],
    queryFn: empresasApi.getEmpresas,
  });

  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ['usuarios', 'all'],
    queryFn: () => usuariosApi.getUsuarios({ scope: 'all' }),
  });

  const loading = loadingEmpresas || loadingUsuarios;
  const now = Date.now();

  const empresasActivas = empresas.filter((e) => e.activo).length;
  const usuariosActivos = usuarios.filter((u) => u.activo).length;
  const conectados24h = usuarios.filter((u) => u.ultimoLogin && now - new Date(u.ultimoLogin).getTime() <= DIA_MS).length;
  const conectados7d = usuarios.filter((u) => u.ultimoLogin && now - new Date(u.ultimoLogin).getTime() <= 7 * DIA_MS).length;

  const ultimosConectados = [...usuarios]
    .filter((u) => u.ultimoLogin)
    .sort((a, b) => new Date(b.ultimoLogin) - new Date(a.ultimoLogin))
    .slice(0, 8);

  const empresaNombre = (empresaId) => empresas.find((e) => e._id === empresaId)?.nombre || 'Sin empresa';

  if (loading) {
    return <div className="mx-state-placeholder"><div className="mx-spinner" /></div>;
  }

  return (
    <div className="mx-content-frame sar-content-frame">
      <div className="sar-kpi-grid">
        <KpiCard icon={Building2} label="Empresas activas" value={empresasActivas} sub={`de ${empresas.length} totales`} color="#7c3aed" />
        <KpiCard icon={Users} label="Usuarios activos" value={usuariosActivos} sub={`de ${usuarios.length} totales`} color="#0d9488" />
        <KpiCard icon={Activity} label="Conectados últimas 24h" value={conectados24h} color="#2563eb" />
        <KpiCard icon={Clock} label="Conectados últimos 7 días" value={conectados7d} color="#ea580c" />
      </div>

      <div className="mx-table-card sar-recent-card">
        <div className="sar-recent-header">Últimas conexiones</div>
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Empresa</th>
                <th>Último acceso</th>
              </tr>
            </thead>
            <tbody>
              {ultimosConectados.length === 0 ? (
                <tr><td colSpan="3"><div className="mx-state-placeholder">Aún no hay conexiones registradas.</div></td></tr>
              ) : (
                ultimosConectados.map((u) => (
                  <tr key={u._id}>
                    <td data-label="Usuario">
                      <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{u.email}</div>
                    </td>
                    <td data-label="Empresa">{empresaNombre(u.empresaId)}</td>
                    <td data-label="Último acceso" title={new Date(u.ultimoLogin).toLocaleString('es-CL')}>
                      {timeAgo(u.ultimoLogin)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
