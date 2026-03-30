// /js/abastecimiento/contactos/data.js
import { apiGetCentros, apiGetContactos } from '../../core/api.js';
import { state } from './state.js';
import { coerceArray, normalizeContacto } from './normalizers.js';
import { slug } from './state.js';

/* =========================================================================
   Config cache + utils
   ========================================================================= */
const TTL_MS = 15 * 60 * 1000; // 15 minutos
const LS_KEYS = {
  centros: 'mmpp.cache.centros.v1',
  contactos: 'mmpp.cache.contactos.v1',
};

const inflight = new Map(); // de-dup promesas por clave

const log = (...args) => {
  try {
    if (window.DEBUG) console.log(...args);
  } catch {}
};

function now() { return Date.now(); }

function loadCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    if (!obj.ts || (now() - obj.ts) > TTL_MS) return null; // expirado
    return obj.data ?? null;
  } catch { return null; }
}

function saveCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: now(), data }));
  } catch {}
}

function dedup(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try { return await fn(); }
    finally { inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}

/* =========================================================================
   Indexado de proveedores a partir de centros
   ========================================================================= */
function indexarProveedoresDesdeCentros(centros) {
  const mapa = new Map();
  const idx = {};

  for (const c of centros) {
    const nombre = String(c.proveedor || c.name || '').trim();
    if (!nombre) continue;

    const pKey = (c.proveedorKey && String(c.proveedorKey).trim().length)
      ? String(c.proveedorKey).trim()
      : slug(nombre);

    if (!mapa.has(pKey)) {
      mapa.set(pKey, {
        nombreOriginal: nombre,
        nombreNormalizado: nombre.toLowerCase().replace(/\s+/g, ' '),
        proveedorKey: pKey,
      });
    }
    if (!idx[pKey]) {
      idx[pKey] = { proveedor: nombre, proveedorKey: pKey };
    }
  }

  state.listaProveedores = Array.from(mapa.values());
  state.proveedoresIndex  = idx;
}

/* =========================================================================
   Carga de Centros (SWR + de-dup)
   ========================================================================= */
/**
 * Carga catálogo de centros y arma índice de proveedores.
 * - Usa cache inmediato si existe (SWR).
 * - Revalida en background y vuelve a notificar.
 * - Emite 'centros:loaded' cuando hay datos en state.
 */
export async function cargarCentros() {
  // 1) entregar cache rápido si existe
  const cached = loadCache(LS_KEYS.centros);
  if (Array.isArray(cached) && !state.listaCentros?.length) {
    state.listaCentros = cached;
    indexarProveedoresDesdeCentros(state.listaCentros);
    log('[cargarCentros][cache] ←', state.listaCentros.length, 'centros');
    document.dispatchEvent(new Event('centros:loaded'));
  }

  // 2) siempre revalidar con de-dup
  try {
    const lista = await dedup('centros', async () => {
      log('[cargarCentros][net] → apiGetCentros()');
      const res = await apiGetCentros();
      return coerceArray(res);
    });

    state.listaCentros = Array.isArray(lista) ? lista : [];
    saveCache(LS_KEYS.centros, state.listaCentros);
    indexarProveedoresDesdeCentros(state.listaCentros);
    log('[cargarCentros][net] ←', state.listaCentros.length, 'centros / proveedores:', state.listaProveedores.length);

    // 🔔 Notificar a otros módulos (asociar-empresa.js, visitas/ui.js, etc.)
    document.dispatchEvent(new Event('centros:loaded'));
  } catch (e) {
    console.error('[cargarCentros] error:', e?.message || e);
    if (!state.listaCentros) state.listaCentros = [];
    if (!state.listaProveedores) state.listaProveedores = [];
    if (!state.proveedoresIndex) state.proveedoresIndex = {};
    M.toast?.({ html: 'Error al cargar centros', displayLength: 2500, classes: 'red' });
  }
}

/* =========================================================================
   Carga de Contactos (SWR + de-dup)
   ========================================================================= */
/**
 * Trae contactos guardados, normaliza y cachea.
 * - Entrega cache inmediato si existe (SWR).
 * - Revalida en background.
 */
export async function cargarContactosGuardados() {
  // 1) cache rápido
  const cached = loadCache(LS_KEYS.contactos);
  if (Array.isArray(cached) && !state.contactosGuardados?.length) {
    state.contactosGuardados = cached.map(normalizeContacto);
    log('[cargarContactosGuardados][cache] ←', state.contactosGuardados.length, 'contactos');
  }

  // 2) revalidar
  try {
    const raw = await dedup('contactos', async () => {
      log('[cargarContactosGuardados][net] → apiGetContactos()');
      return coerceArray(await apiGetContactos());
    });

    const normalizados = raw.map(normalizeContacto);
    state.contactosGuardados = normalizados;
    saveCache(LS_KEYS.contactos, normalizados); // guardamos ya normalizados
    log('[cargarContactosGuardados][net] ←', state.contactosGuardados.length, 'contactos');
  } catch (e) {
    console.error('[cargarContactosGuardados] error:', e?.message || e);
    if (!state.contactosGuardados) state.contactosGuardados = [];
    M.toast?.({ html: 'Error al cargar contactos', displayLength: 2500, classes: 'red' });
  }
}

/* =========================================================================
   (Opcional) Helpers exportables a futuro
   ========================================================================= */
// export function getProveedorByKey(key){ return state.proveedoresIndex?.[key] || null; }
// export function getCentros(){ return state.listaCentros || []; }
// export function getContactos(){ return state.contactosGuardados || []; }
