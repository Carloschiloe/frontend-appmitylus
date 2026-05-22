const LEGACY_AUTH_KEYS = ['ammpp_token', 'ammpp_refresh_token'];
const USER_CACHE_KEY = 'ammpp_user';
const TENANT_KEYS = ['selected_tenant_db', 'selected_tenant_nombre', 'selected_tenant_logo'];

function getStorage() {
  return globalThis.localStorage;
}

export function clearSessionCache({ clearTenant = false } = {}) {
  const storage = getStorage();
  if (!storage) return;

  LEGACY_AUTH_KEYS.forEach((key) => storage.removeItem(key));
  storage.removeItem(USER_CACHE_KEY);

  if (clearTenant) {
    TENANT_KEYS.forEach((key) => storage.removeItem(key));
  }
}

export function clearRuntimeLayoutState() {
  if (typeof document === 'undefined') return;

  document.body.classList.remove('biomasa-calendar-board-open', 'mu-modal-open', 'modo-lectura');
  document.body.style.overflow = '';

  const sidebar = document.querySelector('.mx-sidebar');
  if (sidebar) {
    sidebar.style.display = '';
  }

  if (typeof window !== 'undefined') {
    window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }
}

export function resolveUserTenant(user) {
  if (!user) return null;

  const empresaData = user.empresaId;
  if (empresaData && typeof empresaData === 'object' && empresaData.dbName) {
    return {
      dbName: empresaData.dbName,
      nombre: empresaData.nombre || '',
      logo: empresaData.config?.logo || '',
    };
  }

  if (user.dbName) {
    return {
      dbName: user.dbName,
      nombre: '',
      logo: '',
    };
  }

  return null;
}

export function applyTenantForUser(user) {
  const storage = getStorage();
  if (!storage || !user || user.rol === 'superadmin') return;

  const tenant = resolveUserTenant(user);
  if (!tenant?.dbName) {
    TENANT_KEYS.forEach((key) => storage.removeItem(key));
    return;
  }

  storage.setItem('selected_tenant_db', tenant.dbName);
  storage.setItem('selected_tenant_nombre', tenant.nombre);
  storage.setItem('selected_tenant_logo', tenant.logo);
}

export function persistUserSession(user) {
  const storage = getStorage();
  if (!storage || !user) return;

  storage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  applyTenantForUser(user);
}

export function readCachedUser() {
  const storage = getStorage();
  if (!storage) return null;

  const cachedUserRaw = storage.getItem(USER_CACHE_KEY);
  if (!cachedUserRaw) return null;

  try {
    return JSON.parse(cachedUserRaw);
  } catch {
    storage.removeItem(USER_CACHE_KEY);
    return null;
  }
}
