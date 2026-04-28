// js/centros/sanitario/api.js
const BASE = '/api/sanitario';

async function req(url, opts = {}) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(json?.error || r.statusText), { status: r.status });
  return json;
}

export const getAreas       = (params = {}) => {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null && v !== ''))).toString();
  return req(`${BASE}/areas${qs ? '?' + qs : ''}`).then(d => d.items || []);
};
export const getAlertas     = () => req(`${BASE}/alertas`).then(d => d);
export const getResumen     = () => req(`${BASE}/resumen`);
export const getHistorial   = (areaPSMB, limit = 50) => req(`${BASE}/historial/${encodeURIComponent(areaPSMB)}?limit=${limit}`).then(d => d.items || []);
export const getCentroEstado= (codigo) => req(`${BASE}/centro/${encodeURIComponent(codigo)}`);
export const getCentrosMapa = () => req(`${BASE}/centros-mapa`).then(d => d.items || []);

export const syncMrSat             = () => req(`${BASE}/sync/mrsat`, { method: 'POST' });
export const syncSernapescaAreas   = (force = false) => req(`${BASE}/sync/sernapesca-areas${force ? '?force=1' : ''}`, { method: 'POST' });
export const saveAreaSernapesca = (data) => req(`${BASE}/areas`, { method: 'POST', body: JSON.stringify(data) });
export const patchArea      = (id, data) => req(`${BASE}/areas/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const saveCentroMapa = (data) => req(`${BASE}/centros-mapa`, { method: 'POST', body: JSON.stringify(data) });
export const deleteCentroMapa = (id) => req(`${BASE}/centros-mapa/${id}`, { method: 'DELETE' });
export const recalcular     = () => req(`${BASE}/recalcular`, { method: 'POST' });
export const limpiarInvalidas = () => req(`${BASE}/limpiar`, { method: 'POST' });
