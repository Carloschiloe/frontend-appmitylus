import { fmtTons } from '../utils/programaCalculos';

export default function BiomasaKpiCards({ statusSubTab, kpis, negociacionKpis, statusPeriod }) {
  if (statusSubTab === 'disponibilidad') {
    return (
      <div className="mx-kpi-grid">
        <div className="mx-kpi-card">
          <div className="mx-kpi-label">Disponible</div>
          <div className="mx-kpi-value" style={{ color: 'var(--color-info)' }}>{fmtTons(kpis.disponible)}</div>
        </div>
        <div className="mx-kpi-card">
          <div className="mx-kpi-label">Asignado</div>
          <div className="mx-kpi-value" style={{ color: 'var(--color-success)' }}>{fmtTons(kpis.totalAsignado)}</div>
        </div>
        <div className="mx-kpi-card">
          <div className="mx-kpi-label">Saldo Mensual</div>
          <div className="mx-kpi-value" style={{ color: kpis.saldo >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{fmtTons(kpis.saldo)}</div>
          <div className="mx-progress am-mt-12">
            <div className="mx-progress-fill" style={{ width: `${Math.min(kpis.pct, 100)}%` }}></div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-kpi-grid">
      <div className="mx-kpi-card">
        <div className="mx-kpi-label">En conversación</div>
        <div className="mx-kpi-value" style={{ color: 'var(--color-info)' }}>{fmtTons(negociacionKpis.enConversacionTons)}</div>
      </div>
      <div className="mx-kpi-card">
        <div className="mx-kpi-label">Acordadas</div>
        <div className="mx-kpi-value" style={{ color: 'var(--color-success)' }}>{fmtTons(negociacionKpis.acordadasTons)}</div>
      </div>
      <div className="mx-kpi-card">
        <div className="mx-kpi-label">{statusPeriod === 'week' ? 'Pérdidas de la semana' : 'Pérdidas del mes'}</div>
        <div className="mx-kpi-value" style={{ color: 'var(--color-error)' }}>{fmtTons(negociacionKpis.perdidasTons)}</div>
      </div>
    </div>
  );
}
