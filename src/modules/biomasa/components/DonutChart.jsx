import { PRODUCT_COLORS } from '../utils/productoLabels';

export default function DonutChart({ products, totalTons, activeKey = null }) {
  const r = 30;
  const cx = 40;
  const cy = 40;
  const stroke = 16;
  const circ = 2 * Math.PI * r;
  if (!products.length || totalTons === 0) {
    return (
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      </svg>
    );
  }
  let offsetPct = 0;
  const slices = products.map((p) => {
    const pct = p.tons / totalTons;
    const slice = { key: p.key, pct, offset: offsetPct, color: PRODUCT_COLORS[p.key] || '#94a3b8' };
    offsetPct += pct;
    return slice;
  });
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
      {slices.map((s) => (
        <circle
          key={s.key}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${circ * s.pct} ${circ * (1 - s.pct)}`}
          strokeDashoffset={-circ * s.offset}
          opacity={activeKey && s.key !== activeKey ? 0.2 : 1}
          style={{ transition: 'opacity 0.2s' }}
        />
      ))}
    </svg>
  );
}
