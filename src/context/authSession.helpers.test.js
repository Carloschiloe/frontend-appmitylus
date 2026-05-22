import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTenantForUser,
  clearSessionCache,
  persistUserSession,
  readCachedUser,
  resolveUserTenant,
} from './authSession.helpers.js';

function createStorageMock() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

test('resuelve tenant desde empresa poblada o dbName directo', () => {
  assert.deepEqual(resolveUserTenant({
    empresaId: {
      dbName: 'tenant_sur',
      nombre: 'Empresa Sur',
      config: { logo: 'logo.svg' },
    },
  }), {
    dbName: 'tenant_sur',
    nombre: 'Empresa Sur',
    logo: 'logo.svg',
  });

  assert.deepEqual(resolveUserTenant({ dbName: 'tenant_directo' }), {
    dbName: 'tenant_directo',
    nombre: '',
    logo: '',
  });
});

test('limpia tokens legacy y tenant cuando cambia la sesion completa', () => {
  globalThis.localStorage = createStorageMock();
  localStorage.setItem('ammpp_token', 'token');
  localStorage.setItem('ammpp_refresh_token', 'refresh');
  localStorage.setItem('ammpp_user', '{"id":"u1"}');
  localStorage.setItem('selected_tenant_db', 'tenant_viejo');
  localStorage.setItem('selected_tenant_nombre', 'Tenant Viejo');
  localStorage.setItem('selected_tenant_logo', 'viejo.svg');

  clearSessionCache({ clearTenant: true });

  assert.equal(localStorage.getItem('ammpp_token'), null);
  assert.equal(localStorage.getItem('ammpp_refresh_token'), null);
  assert.equal(localStorage.getItem('ammpp_user'), null);
  assert.equal(localStorage.getItem('selected_tenant_db'), null);
  assert.equal(localStorage.getItem('selected_tenant_nombre'), null);
  assert.equal(localStorage.getItem('selected_tenant_logo'), null);
});

test('fija tenant del usuario normal e ignora seleccion heredada', () => {
  globalThis.localStorage = createStorageMock();
  localStorage.setItem('selected_tenant_db', 'tenant_manipulado');

  applyTenantForUser({
    rol: 'admin',
    empresaId: {
      dbName: 'tenant_real',
      nombre: 'Tenant Real',
      config: { logo: 'real.svg' },
    },
  });

  assert.equal(localStorage.getItem('selected_tenant_db'), 'tenant_real');
  assert.equal(localStorage.getItem('selected_tenant_nombre'), 'Tenant Real');
  assert.equal(localStorage.getItem('selected_tenant_logo'), 'real.svg');
});

test('no pisa el tenant manual de superadmin', () => {
  globalThis.localStorage = createStorageMock();
  localStorage.setItem('selected_tenant_db', 'tenant_manual');

  applyTenantForUser({ rol: 'superadmin', dbName: 'tenant_global' });

  assert.equal(localStorage.getItem('selected_tenant_db'), 'tenant_manual');
});

test('persiste y lee usuario cacheado; elimina cache corrupto', () => {
  globalThis.localStorage = createStorageMock();

  persistUserSession({ _id: 'u1', rol: 'user', dbName: 'tenant_a' });
  assert.deepEqual(readCachedUser(), { _id: 'u1', rol: 'user', dbName: 'tenant_a' });
  assert.equal(localStorage.getItem('selected_tenant_db'), 'tenant_a');

  localStorage.setItem('ammpp_user', '{mal-json');
  assert.equal(readCachedUser(), null);
  assert.equal(localStorage.getItem('ammpp_user'), null);
});
