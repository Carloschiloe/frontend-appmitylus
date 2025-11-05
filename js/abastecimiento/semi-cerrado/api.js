// /js/abastecimiento/semi-cerrado/api.js
// Wrapper minimal para la API de semi-cerrados

const API_BASE = (window.API_BASE ? String(window.API_BASE).replace(/\/$/, '') : '') || '';

function jsonHeaders() {
  return { 'Content-Type': 'application/json' };
}

function handle(res) {
  if (!res.ok) {
    return res.json().catch(() => ({})).then(body => {
      const msg = body?.error || `${res.status} ${res.statusText}`;
      throw Object.assign(new Error(msg), { status: res.status, body });
    });
  }
  return res.json();
}

export async function crearSemiCerrado(payload) {
  // payload: { proveedorId, centroId?, periodo:'YYYY-MM', toneladas:Number, responsable?, notas?, origenContactoId? }
  return fetch(`${API_BASE}/api/semi-cerrados`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  }).then(handle);
}

export async function listarSemiCerrados(params = {}) {
  const q = new URLSearchParams(params).toString();
  return fetch(`${API_BASE}/api/semi-cerrados${q ? `?${q}` : ''}`).then(handle);
}

export async function actualizarSemiCerrado(id, patch) {
  return fetch(`${API_BASE}/api/semi-cerrados/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify(patch),
  }).then(handle);
}

export async function eliminarSemiCerrado(id) {
  return fetch(`${API_BASE}/api/semi-cerrados/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(handle);
}

export async function summarySemiCerrados(year) {
  const y = year || new Date().getFullYear();
  return fetch(`${API_BASE}/api/semi-cerrados/summary?year=${encodeURIComponent(y)}`).then(handle);
}
