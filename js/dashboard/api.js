/**
 * js/dashboard/api.js
 * Llamadas a la API para el Dashboard principal.
 */

const API_BASE = window.API_URL || '/api';

export async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { 
    headers: { Accept: 'application/json' } 
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

/**
 * Carga todos los datos necesarios para el Dashboard de forma concurrente.
 */
export async function fetchAllDashboardData() {
  const y = new Date().getFullYear();
  // Ampliamos el rango para cubrir años adyacentes si es necesario
  const qArr = new URLSearchParams({ from: `${y - 1}-01`, to: `${y + 1}-12` });
  const qStr = qArr.toString();

  return Promise.all([
    fetchJson('/contactos').catch(() => []),
    fetchJson('/visitas').catch(() => []),
    fetchJson('/interacciones').catch(() => []),
    fetchJson(`/disponibilidades?${qStr}`).catch(() => []),
    fetchJson('/oportunidades').catch(() => [])
  ]);
}
