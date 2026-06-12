import { describe, it, expect } from 'vitest';
import {
  fmtTons,
  formatMuestreoFecha,
  formatMuestreoResumen,
  tonsPorCamionDeTipo,
  calcTotalToneladasDia,
} from '../modules/biomasa/utils/programaCalculos';

describe('fmtTons', () => {
  it('formatea cero', () => {
    expect(fmtTons(0)).toBe('0 t');
  });
  it('formatea entero positivo', () => {
    expect(fmtTons(5)).toBe('5 t');
  });
  it('trata null como cero', () => {
    expect(fmtTons(null)).toBe('0 t');
  });
  it('trata undefined como cero', () => {
    expect(fmtTons(undefined)).toBe('0 t');
  });
  it('resultado siempre termina en " t"', () => {
    expect(fmtTons(12.7)).toMatch(/ t$/);
  });
});

describe('formatMuestreoFecha', () => {
  it('formato corto por defecto DD-MM', () => {
    expect(formatMuestreoFecha('2024-03-15')).toBe('15-03');
  });
  it('formato largo DD-MM-YYYY', () => {
    expect(formatMuestreoFecha('2024-03-15', 'long')).toBe('15-03-2024');
  });
  it('devuelve null para null', () => {
    expect(formatMuestreoFecha(null)).toBeNull();
  });
  it('devuelve null para string vacío', () => {
    expect(formatMuestreoFecha('')).toBeNull();
  });
  it('devuelve null para formato no ISO', () => {
    expect(formatMuestreoFecha('15/03/2024')).toBeNull();
  });
});

describe('formatMuestreoResumen', () => {
  it('devuelve null sin datos', () => {
    expect(formatMuestreoResumen({})).toBeNull();
  });
  it('devuelve null para null', () => {
    expect(formatMuestreoResumen(null)).toBeNull();
  });
  it('incluye solo uxkg', () => {
    expect(formatMuestreoResumen({ uxkg: 12 })).toBe('12 un/kg');
  });
  it('incluye solo rendimiento', () => {
    expect(formatMuestreoResumen({ rendimiento: 25 })).toBe('Rend. 25%');
  });
  it('combina ambos con separador ·', () => {
    const result = formatMuestreoResumen({ uxkg: 12, rendimiento: 25 });
    expect(result).toBe('12 un/kg · Rend. 25%');
  });
  it('ignora valores cero', () => {
    expect(formatMuestreoResumen({ uxkg: 0, rendimiento: 0 })).toBeNull();
  });
});

describe('tonsPorCamionDeTipo', () => {
  it('calcula maxis * kg / 1000', () => {
    // 200 maxis * 55 kg = 11 t
    expect(tonsPorCamionDeTipo({ maxisPorUnidad: 200, kgPorMaxiRef: 55 })).toBeCloseTo(11);
  });
  it('acepta alias de campo maxis', () => {
    expect(tonsPorCamionDeTipo({ maxis: 100, kgRef: 110 })).toBeCloseTo(11);
  });
  it('devuelve null sin datos', () => {
    expect(tonsPorCamionDeTipo({})).toBeNull();
  });
  it('devuelve null para null', () => {
    expect(tonsPorCamionDeTipo(null)).toBeNull();
  });
  it('devuelve null si falta kgPorMaxiRef', () => {
    expect(tonsPorCamionDeTipo({ maxisPorUnidad: 200 })).toBeNull();
  });
  it('devuelve null si maxis es cero', () => {
    expect(tonsPorCamionDeTipo({ maxisPorUnidad: 0, kgPorMaxiRef: 55 })).toBeNull();
  });
});

describe('calcTotalToneladasDia', () => {
  it('suma varios transportes', () => {
    const transportes = [
      { cantidadDia: 5, toneladasPorCamion: 11 },
      { cantidadDia: 3, toneladasPorCamion: 10 },
    ];
    expect(calcTotalToneladasDia(transportes)).toBeCloseTo(85);
  });
  it('devuelve 0 para array vacío', () => {
    expect(calcTotalToneladasDia([])).toBe(0);
  });
  it('devuelve 0 sin argumento', () => {
    expect(calcTotalToneladasDia()).toBe(0);
  });
  it('trata valores faltantes como 0', () => {
    expect(calcTotalToneladasDia([{ cantidadDia: 3 }])).toBe(0);
  });
});
