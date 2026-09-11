import { describe, expect, it } from 'vitest';
import { formatQualityValue, qualitySubtitle, QUALITY_SCOPE_ALL, QUALITY_SCOPE_HARVEST } from '../modules/dashboard/dashboardQuality';

describe('dashboard quality card', () => {
  it('uses all monthly samples by default and labels harvest scope explicitly', () => {
    expect(qualitySubtitle({ sampleCount: 8, mesLabel: 'Septiembre 2026', scope: QUALITY_SCOPE_ALL })).toBe('8 muestreos · Septiembre 2026');
    expect(qualitySubtitle({ sampleCount: 3, mesLabel: 'Septiembre 2026', scope: QUALITY_SCOPE_HARVEST })).toBe('3 muestreos · marcados para cosecha');
  });

  it('keeps each KPI safe when data is absent or non-finite', () => {
    expect(formatQualityValue(null, '%')).toBe('—');
    expect(formatQualityValue(Number.NaN, '%')).toBe('—');
    expect(formatQualityValue(Number.POSITIVE_INFINITY, '%')).toBe('—');
    expect(formatQualityValue(15, '%')).toBe('15%');
    expect(formatQualityValue(74)).toBe('74');
    expect(qualitySubtitle({ sampleCount: 0, mesLabel: 'Septiembre 2026' })).toBe('Sin muestreos válidos en el mes');
  });
});
