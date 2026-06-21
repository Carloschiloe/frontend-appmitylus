import React, { useMemo } from 'react';

export default function DashboardBiomasaChart({ data }) {
  const chart = useMemo(() => {
    const labels = data?.labels || [];
    const values = data?.datasets?.[0]?.data || [];
    const colors = data?.datasets?.[0]?.backgroundColor || [];
    const total  = values.reduce((sum, v) => sum + Number(v || 0), 0);
    let offset = 0;

    const all = values.map((v, i) => {
      const num = Number(v || 0);
      const pct = total > 0 ? num / total : 0;
      const seg = {
        label:  labels[i] || `Item ${i + 1}`,
        value:  num,
        color:  colors[i] || '#94a3b8',
        pct:    Math.round(pct * 100),
        dash:   `${pct * 100} ${100 - pct * 100}`,
        offset: -offset,
      };
      offset += pct * 100;
      return seg;
    });

    return { total, segments: all, visible: all.filter((s) => s.value > 0) };
  }, [data]);

  if (chart.total === 0) {
    return (
      <div className="dsh-donut-chart" style={{ justifyContent: 'center' }}>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>Sin datos de biomasa</p>
      </div>
    );
  }

  return (
    <div className="dsh-donut-chart" aria-label="Estado de biomasa">
      <svg viewBox="0 0 42 42" role="img" className="dsh-donut-svg">
        <circle className="dsh-donut-track" cx="21" cy="21" r="15.915" />
        {chart.segments.map((s) =>
          s.value > 0 ? (
            <circle
              key={s.label}
              className="dsh-donut-segment"
              cx="21"
              cy="21"
              r="15.915"
              stroke={s.color}
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
            />
          ) : null,
        )}
        <text x="21" y="19.5" className="dsh-donut-center-num">
          {chart.total.toLocaleString('es-CL')}
        </text>
        <text x="21" y="24" className="dsh-donut-center-unit">tratos</text>
      </svg>

      <div className="dsh-donut-legend">
        {chart.visible.map((s) => (
          <div key={s.label} className="dsh-donut-row">
            <span className="dsh-donut-dot" style={{ background: s.color }} />
            <span className="dsh-donut-name">{s.label}</span>
            <span className="dsh-donut-pct">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
