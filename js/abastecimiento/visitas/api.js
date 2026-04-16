// /js/abastecimiento/visitas/api.js
import {
  apiGetVisitas,
  apiGetVisitasByContacto,
  apiCreateVisita,
  apiUpdateVisita,   // suele usar PATCH
  apiDeleteVisita,
} from '../../core/api.js';
import { normalizeVisita } from './normalizers.js';
import { fetchJson } from '../contactos/ui-common.js';

const normList = (raw) => {
  const arr = Array.isArray(raw) ? raw : raw?.items || [];
  return arr.map(normalizeVisita);
};

export async function getAll() {
  const raw = await apiGetVisitas();
  return normList(raw);
}

export async function getByContacto(contactoId) {
  const raw = await apiGetVisitasByContacto(contactoId);
  return normList(raw);
}

export async function create(payload) {
  return apiCreateVisita(payload);
}

/**
 * Fuerza PUT si el servidor rechaza PATCH, o directamente usa PUT si PATCH falla.
 * Mantiene la misma forma de retorno que apiUpdateVisita.
 */
export async function update(id, payload) {
  try {
    // 1) Intento PATCH (lo que hace hoy core)
    return await apiUpdateVisita(id, payload);
  } catch {
    // 2) Fallback robusto a PUT
    const url = `/api/visitas/${encodeURIComponent(String(id))}`;
    return fetchJson(url, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
}

export async function remove(id) {
  return apiDeleteVisita(id);
}

function buildQuery(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Lista visitas con filtros opcionales (requiere backend con soporte de filtros).
 * Ej: { monthProx:'2026-03' } o { from:'2026-03-01', to:'2026-04-01' }
 */
export async function list(filters = {}) {
  const raw = await fetchJson(`/api/visitas${buildQuery(filters)}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  return normList(raw);
}
