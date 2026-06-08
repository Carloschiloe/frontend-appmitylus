import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tiposDescontables,
  diffDaysKeys,
  buildImpactoAjuste,
  fraseCambioTermino,
} from './programaImpacto.js';

const SIMPLE = 'aa01';
const CARRO = 'bb02';

test('tiposDescontables solo devuelve líneas con cantidad > 0', () => {
  const comp = [
    { tipoTransporteId: SIMPLE, tipoTransporteNombre: 'Camion Simple', cantidad: 1, toneladasPorCamion: 11 },
    { tipoTransporteId: CARRO, tipoTransporteNombre: 'Camion con carro', cantidad: 0, toneladasPorCamion: 22 },
  ];
  const r = tiposDescontables(comp);
  assert.equal(r.length, 1);
  assert.equal(r[0].tipoTransporteId, SIMPLE);
});

test('diffDaysKeys calcula diferencia en días', () => {
  assert.equal(diffDaysKeys('2026-06-14', '2026-06-17'), 3);
  assert.equal(diffDaysKeys('2026-06-14', '2026-06-11'), -3);
  assert.equal(diffDaysKeys('2026-06-14', '2026-06-14'), 0);
});

test('buildImpactoAjuste (sumar) detecta extensión y arma mensaje', () => {
  const before = { vigenciaHasta: '2026-06-14T23:59:59Z', diasEspeciales: [], diasSemana: [0, 1, 2, 3, 4], camionesDefault: 1 };
  const after = { vigenciaHasta: '2026-06-17T23:59:59Z', diasEspeciales: [{ fecha: '2026-06-11T12:00:00Z', camiones: 2 }], diasSemana: [0, 1, 2, 3, 4], camionesDefault: 1 };
  const payload = { fecha: '2026-06-11', accion: 'sumar', camiones: 1, tipoTransporteNombre: 'Camion con carro' };
  const imp = buildImpactoAjuste(before, after, payload);
  assert.equal(imp.vigenciaHastaAnterior, '2026-06-14');
  assert.equal(imp.vigenciaHastaNueva, '2026-06-17');
  assert.equal(imp.diferenciaDias, 3);
  assert.equal(imp.direccionCambio, 'extendio');
  assert.match(imp.mensaje, /Se agregó 1 Camion con carro/);
  assert.equal(fraseCambioTermino(imp), 'El programa se extendió 3 días.');
});

test('buildImpactoAjuste: la DIRECCIÓN sale de las fechas, no de la acción (sumar real adelanta)', () => {
  // Caso REAL: sumar un camión consume más por día → el término se adelanta (nueva < anterior).
  // Esto confirma que el helper NO infiere la consecuencia desde la acción: usa vigenciaHasta
  // antes (programa) vs después (respuesta del backend). No puede mostrar algo invertido.
  const before = { vigenciaHasta: '2026-06-14T23:59:59Z', diasEspeciales: [] };
  const after = { vigenciaHasta: '2026-06-11T23:59:59Z', diasEspeciales: [{ fecha: '2026-06-11T12:00:00Z', camiones: 2 }] };
  const payload = { fecha: '2026-06-11', accion: 'sumar', camiones: 1, tipoTransporteNombre: 'Camion con carro' };
  const imp = buildImpactoAjuste(before, after, payload);
  assert.equal(imp.diferenciaDias, -3);
  assert.equal(imp.direccionCambio, 'adelanto');
  assert.match(imp.mensaje, /Se agregó 1 Camion con carro/);
  assert.equal(fraseCambioTermino(imp), 'El programa se adelantó 3 días.');
});

test('buildImpactoAjuste (suspender_dia) sin cambio de término', () => {
  const before = { vigenciaHasta: '2026-06-14T23:59:59Z', diasEspeciales: [] };
  const after = { vigenciaHasta: '2026-06-14T23:59:59Z', diasEspeciales: [{ fecha: '2026-06-11T12:00:00Z', camiones: 0 }] };
  const payload = { fecha: '2026-06-11', accion: 'suspender_dia', camiones: 0, motivo: 'Planta' };
  const imp = buildImpactoAjuste(before, after, payload);
  assert.equal(imp.direccionCambio, 'sin_cambio');
  assert.match(imp.mensaje, /Se suspendió/);
  assert.match(imp.mensaje, /por Planta/);
  assert.equal(fraseCambioTermino(imp), 'La fecha de término no cambió.');
});

test('buildImpactoAjuste (descontar) detecta adelanto de término', () => {
  const before = { vigenciaHasta: '2026-06-17T23:59:59Z', diasEspeciales: [] };
  const after = { vigenciaHasta: '2026-06-14T23:59:59Z', diasEspeciales: [] };
  const payload = { fecha: '2026-06-11', accion: 'suspender', camiones: 1, tipoTransporteNombre: 'Camion Simple' };
  const imp = buildImpactoAjuste(before, after, payload);
  assert.equal(imp.direccionCambio, 'adelanto');
  assert.match(imp.mensaje, /Se descontó 1 Camion Simple/);
  assert.equal(fraseCambioTermino(imp), 'El programa se adelantó 3 días.');
});
