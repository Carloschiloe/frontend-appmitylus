import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInitialConditions,
  buildProviderDirectory,
  buildTratoShareMessage,
  deriveCamionesXDia,
  derivePlazoDesdeCondiciones,
  derivePrecioDesdeCondiciones,
  deriveVolumenDesdeCondiciones,
  formatDateOnlySafe,
  getApiEstadoFromUi,
  getUiEstadoFromApi,
  isEquivalentEstado,
  normalizeDateOnlyForUiSafe,
  parseNumberOrNull,
} from './tratos.helpers.js';

test('mapea estados entre UI y API sin depender de texto visible', () => {
  assert.equal(getApiEstadoFromUi('pendiente'), 'negociando');
  assert.equal(getApiEstadoFromUi('cerrado_ok'), 'compra_efectuada');
  assert.equal(getUiEstadoFromApi('semi_acordado'), 'pendiente');
  assert.equal(getUiEstadoFromApi('compra_efectuada'), 'cerrado_ok');
  assert.equal(getUiEstadoFromApi('desconocido'), 'pendiente');
});

test('detecta estados API equivalentes para evitar patches redundantes', () => {
  assert.equal(isEquivalentEstado('cerrado', 'cerrado_ok'), true);
  assert.equal(isEquivalentEstado('perdido', 'rechazado'), true);
  assert.equal(isEquivalentEstado('negociando', 'pendiente'), true);
  assert.equal(isEquivalentEstado('acordado', 'rechazado'), false);
});

test('deriva condiciones comerciales con texto normalizado', () => {
  const condiciones = [
    { nombre: 'Precio base', valor: '480' },
    { nombre: 'Volumen total', valor: '1200' },
    { nombre: 'Camiones dia', valor: '8' },
    { nombre: 'Plazo pago', valor: '30' },
  ];

  assert.equal(derivePrecioDesdeCondiciones(condiciones), 480);
  assert.equal(deriveVolumenDesdeCondiciones(condiciones), 1200);
  assert.equal(deriveCamionesXDia(condiciones), 8);
  assert.equal(derivePlazoDesdeCondiciones(condiciones), '30');
});

test('normaliza fechas de solo dia sin desfase horario visible', () => {
  assert.equal(formatDateOnlySafe('2026-05-21T00:00:00.000Z'), '21-05-2026');
  assert.equal(normalizeDateOnlyForUiSafe('2026-05-21'), '2026-05-21T12:00:00.000Z');
  assert.equal(formatDateOnlySafe('valor-invalido'), '-');
});

test('construye formularios iniciales desde maestros de condiciones', () => {
  const result = buildInitialConditions([
    { _id: '1', nombre: 'Precio', tipoValor: 'moneda' },
    { _id: '2', nombre: 'Plazo', tipoValor: 'dias' },
  ]);

  assert.deepEqual(result, [
    { condicionId: '1', nombre: 'Precio', tipoValor: 'moneda', estado: 'pendiente', valor: null },
    { condicionId: '2', nombre: 'Plazo', tipoValor: 'dias', estado: 'pendiente', valor: null },
  ]);
});

test('arma directorio de proveedores mezclando centros y contactos sin duplicar claves', () => {
  const result = buildProviderDirectory(
    [
      { _id: 'c1', proveedor: 'Proveedor Sur', proveedorKey: 'SUR', comuna: 'Castro' },
      { _id: 'c2', proveedor: 'Proveedor Sur', proveedorKey: 'SUR', comuna: 'Quellon' },
      { _id: 'c3', proveedor: 'Proveedor Norte', proveedorKey: 'NORTE', comuna: 'Calbuco' },
    ],
    [
      {
        _id: 'p1',
        proveedorKey: 'sur',
        proveedorNombre: 'Proveedor Sur',
        contactoNombre: 'Ana',
        contactoTelefono: '123',
        contactoEmail: 'ana@test.cl',
      },
      {
        _id: 'p2',
        proveedorNombre: 'Proveedor Contacto',
        contactoNombre: 'Solo Contacto',
        contactoTelefono: '999',
        contactoEmail: 'solo@test.cl',
        comuna: 'Ancud',
      },
    ],
  );

  assert.equal(result.length, 3);

  const sur = result.find((item) => item.proveedorKey === 'sur');
  assert.equal(sur.centros, 2);
  assert.equal(sur.contactoId, 'p1');
  assert.equal(sur.contactoNombre, 'Ana');
  assert.equal(sur.contactoTelefono, '123');
  assert.equal(sur.contactoEmail, 'ana@test.cl');

  const contactOnly = result.find((item) => item.proveedorKey === 'proveedor contacto');
  assert.equal(contactOnly.centros, 0);
  assert.equal(contactOnly.contactoId, 'p2');
  assert.equal(contactOnly.comuna, 'Ancud');
});

test('parsea numeros estrictamente y deja vacios como null', () => {
  assert.equal(parseNumberOrNull('42'), 42);
  assert.equal(parseNumberOrNull(''), null);
  assert.equal(parseNumberOrNull('abc'), null);
});

test('arma mensaje publico de trato con datos derivados', () => {
  const message = buildTratoShareMessage({
    proveedorNombre: 'Proveedor Sur',
    estado: 'acordado',
    condiciones: [
      { nombre: 'Precio', valor: 510 },
      { nombre: 'Volumen total', valor: 900 },
      { nombre: 'Camiones dia', valor: 6 },
    ],
    fechaCierre: '2026-05-21',
  }, 'https://mitynex.test/trato/abc');

  assert.match(message, /Proveedor: Proveedor Sur/);
  assert.match(message, /Volumen acordado: 900 t/);
  assert.match(message, /Precio: \$510 \/ kg/);
  assert.match(message, /Carga: 6 cam\/dia/);
  assert.match(message, /Inicio probable cosecha: 21-05-2026/);
  assert.match(message, /Estado: Acordado/);
  assert.match(message, /https:\/\/mitynex\.test\/trato\/abc/);
});
