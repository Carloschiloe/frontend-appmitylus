// /js/abastecimiento/visitas/api.js
import {
  apiGetVisitas,
  apiGetVisitasByContacto,
  apiCreateVisita,
  apiUpdateVisita,   // suele usar PATCH
  apiDeleteVisita,
} from '../../core/api.js';
import { normalizeVisita } from './normalizers.js';

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
 * Fuerza PUT si el servidor rechaza PATCH, o directamente usa PUT si PATCH lanza 500/405.
 * Mantiene la misma forma de retorno que apiUpdateVisita.
 */
export async function update(id, payload) {
  try {
    // 1) Intento PATCH (lo que hace hoy core)
    return await apiUpdateVisita(id, payload);
  } catch (err) {
    // 2) Fallback robusto a PUT (independiente de la lógica de core/api.js)
    const url = `/api/visitas/${encodeURIComponent(String(id))}`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`;
      try { const j = await resp.json(); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    return resp.json();
  }
}

export async function remove(id) {
  return apiDeleteVisita(id);
}
