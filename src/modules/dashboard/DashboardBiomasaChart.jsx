import React, { useMemo } from 'react';

export default function DashboardBiomasaChart({ data }) {
  const chart = useMemo(() => {
    const labels = data?.labels || [];
    const values = data?.datasets?.[0]?.data || [];
    const colors = data?.datasets?.[0]?.backgroundColor || [];
    const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
    let offset = 0;

    const segments = values.map((value, index) => {
      const numericValue = Number(value || 0);
      const pct = total > 0 ? numericValue / total : 0;
      const segment = {
        label: labels[index] || `Item ${index + 1}`,
        value: numericValue,
        color: colors[index] || '#94a3b8',
        dash: `${pct * 100} ${100 - pct * 100}`,
        offset: -offset,
      };
      offset += pct * 100;
      return segment;
    });

    return { total, segments };
  }, [data]);

  return (
    <div className="dsh-donut-chart" aria-label="Estado de biomasa">
      <svg viewBox="0 0 42 42" role="img" className="dsh-donut-svg">
        <circle className="dsh-donut-track" cx="21" cy="21" r="15.915" />
        {chart.segments.map((segment) => (
          <circle
            key={segment.label}
            className="dsh-donut-segment"
            cx="21"
            cy="21"
            r="15.915"
            stroke={segment.color}
            strokeDasharray={segment.dash}
            strokeDashoffset={segment.offset}
          />
        ))}
        <text x="21" y="20" className="dsh-donut-total">
          {chart.total.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
        </text>
        <text x="21" y="25" className="dsh-donut-unit">t</text>
      </svg>

      <div className="dsh-donut-legend">
        {chart.segments.map((segment) => (
          <div key={segment.label} className="dsh-donut-legend-item">
            <span style={{ background: segment.color }} />
            <b>{segment.label}</b>
            <em>{segment.value.toLocaleString('es-CL', { maximumFractionDigits: 0 })} t</em>
          </div>
        ))}
      </div>
    </div>
  );
}
