export const QUALITY_SCOPE_ALL = 'all';
export const QUALITY_SCOPE_HARVEST = 'harvest';

export function formatQualityValue(value, suffix = '') {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  return `${value}${suffix}`;
}

export function qualitySubtitle({ sampleCount = 0, mesLabel, scope = QUALITY_SCOPE_ALL } = {}) {
  if (!sampleCount) return 'Sin muestreos válidos en el mes';
  const samples = `${sampleCount} muestreo${sampleCount === 1 ? '' : 's'}`;
  return `${samples} · ${scope === QUALITY_SCOPE_HARVEST ? 'marcados para cosecha' : mesLabel}`;
}
