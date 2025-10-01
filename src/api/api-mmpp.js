const API_BASE =
  (typeof window !== 'undefined' && window.API_URL)
    ? `${window.API_URL}`
    : (import.meta?.env?.VITE_API_URL || 'https://backend-appmitylus.vercel.app/api');

export async function getDisponibilidades({ mesKey, proveedorKey } = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries({ mesKey, proveedorKey }).filter(([,v]) => v !== '' && v != null))
  ).toString();
  const r = await fetch(`${API_BASE}/planificacion/disponibilidades${qs ? `?${qs}` : ''}`);
  if (!r.ok) throw new Error(`Error al cargar disponibilidades (${r.status})`);
  return r.json();
}

export async function crearDisponibilidad(payload) {
  const r = await fetch(`${API_BASE}/planificacion/disponibilidades`, {
    method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Error al crear disponibilidad (${r.status})`);
  return r.json();
}

export async function editarDisponibilidad(id, payload) {
  const r = await fetch(`${API_BASE}/planificacion/disponibilidades/${id}`, {
    method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Error al editar disponibilidad (${r.status})`);
  return r.json();
}

export async function borrarDisponibilidad(id) {
  const r = await fetch(`${API_BASE}/planificacion/disponibilidades/${id}`, { method:'DELETE' });
  if (!r.ok) throw new Error(`Error al borrar disponibilidad (${r.status})`);
  return r.json();
}

export async function getResumenMensual({ mesKey }) {
  const r = await fetch(`${API_BASE}/planificacion/resumen?mesKey=${mesKey}`);
  if (!r.ok) throw new Error(`Error al cargar resumen (${r.status})`);
  return r.json();
}

export async function getAsignaciones({ mesKey }) {
  const r = await fetch(`${API_BASE}/planificacion/asignaciones?mesKey=${mesKey}`);
  if (!r.ok) throw new Error(`Error al cargar asignaciones (${r.status})`);
  const arr = await r.json();
  return Array.isArray(arr) ? arr : [];
}


export async function getSaldos({ anio, from, to } = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries({ anio, from, to }).filter(([,v]) => v !== '' && v != null))
  ).toString();
  const r = await fetch(`${API_BASE}/planificacion/saldos${qs ? `?${qs}` : ''}`);
  if (!r.ok) throw new Error(`Error al cargar saldos (${r.status})`);
  return r.json();
}
