import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProviderDirectory,
  createEmptyInteraccionForm,
  filterInteracciones,
  filterProviders,
  getTipoLabel,
  toItems,
} from './interacciones.helpers.js';

test('normaliza payloads de interacciones desde array o pagina', () => {
  const rows = [{ _id: '1' }];
  assert.deepEqual(toItems(rows), rows);
  assert.deepEqual(toItems({ items: rows }), rows);
  assert.deepEqual(toItems(null), []);
});

test('crea formulario inicial con fecha inyectable', () => {
  const form = createEmptyInteraccionForm(new Date('2026-05-21T15:00:00.000Z'));

  assert.deepEqual(form, {
    proveedorNombre: '',
    tipo: 'interaccion',
    fecha: '2026-05-21',
    resumen: '',
    notas: '',
    proximaAccion: '',
    fechaProxima: '',
  });
});

test('arma directorio de proveedores desde centros y primer contacto', () => {
  const result = buildProviderDirectory(
    [
      { _id: 'c1', proveedor: 'Proveedor Sur', proveedorKey: 'SUR', comuna: 'Castro' },
      { _id: 'c2', proveedor: 'Proveedor Sur', proveedorKey: 'SUR', comuna: '' },
      { _id: 'c3', proveedor: 'Proveedor Norte', proveedorKey: 'NORTE', comuna: 'Calbuco' },
    ],
    [
      { _id: 'p1', proveedorKey: 'sur', contactoNombre: 'Ana' },
      { _id: 'p2', proveedorKey: 'sur', contactoNombre: 'Segundo contacto' },
    ],
  );

  assert.equal(result.length, 2);
  assert.deepEqual(result[1], {
    id: 'prov-sur',
    contactoId: 'p1',
    proveedorKey: 'sur',
    proveedorNombre: 'Proveedor Sur',
    contactoNombre: 'Ana',
    comuna: 'Castro',
  });
});

test('filtra proveedores por nombre o comuna con limite', () => {
  const providers = [
    { proveedorNombre: 'Proveedor Sur', comuna: 'Castro' },
    { proveedorNombre: 'Proveedor Norte', comuna: 'Calbuco' },
    { proveedorNombre: 'Proveedor Austral', comuna: 'Quellon' },
  ];

  assert.deepEqual(filterProviders(providers, 'calbuco'), [providers[1]]);
  assert.equal(filterProviders(providers, '', 2).length, 2);
});

test('filtra interacciones por proveedor o resumen', () => {
  const items = [
    { proveedorNombre: 'Proveedor Sur', resumen: 'Llamada precio' },
    { proveedorNombre: 'Proveedor Norte', resumen: 'Seguimiento logistico' },
  ];

  assert.deepEqual(filterInteracciones(items, 'precio'), [items[0]]);
  assert.deepEqual(filterInteracciones(items, 'norte'), [items[1]]);
});

test('resuelve label de tipo con fallback a nota', () => {
  assert.equal(getTipoLabel('reunion'), 'Reunion');
  assert.equal(getTipoLabel('desconocido'), 'Nota');
});
