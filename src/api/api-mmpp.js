const BASE = '/api/planificacion';
const BASE_ASIG = '/api/asignaciones';
const BASE_DISP = '/api/disponibilidades';

// ── Disponibilidades ──────────────────────────────────────────────────────────

export async function getDisponibilidades({ mesKey, proveedorKey } = {}) {
  const params = new URLSearchParams();
  if (mesKey) { params.set('from', mesKey); params.set('to', mesKey); }
  if (proveedorKey) params.set('proveedorKey', proveedorKey);

  const r = await fetch(`${BASE}/disponibilidad${params.size ? `?${params}` : ''}`);
  if (!r.ok) throw new Error(`Error al cargar disponibilidades (${r.status})`);
  const data = await r.json();
  const items = Array.isArray(data) ? data : (data.items || []);
  return items.map(d => ({ ...d, tons: d.tonsDisponible ?? d.tons ?? 0 }));
}

export async function crearDisponibilidad(payload) {
  const r = await fetch(`${BASE_DISP}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Error al crear disponibilidad (${r.status})`);
  const data = await r.json();
  return data.item || data;
}

export async function editarDisponibilidad(id, payload) {
  const r = await fetch(`${BASE_DISP}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Error al editar disponibilidad (${r.status})`);
  const data = await r.json();
  return data.item || data;
}

export async function borrarDisponibilidad(id) {
  const r = await fetch(`${BASE_DISP}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`Error al borrar disponibilidad (${r.status})`);
  return r.json();
}

// ── Asignaciones (Compras) ────────────────────────────────────────────────────

export async function getAsignaciones({ mesKey, from, to, anio } = {}) {
  const params = new URLSearchParams();
  const fromKey = mesKey || from;
  const toKey = mesKey || to;
  if (fromKey) params.set('from', fromKey);
  if (toKey)   params.set('to', toKey);
  if (anio && !fromKey) params.set('anio', anio);

  const r = await fetch(`${BASE_ASIG}${params.size ? `?${params}` : ''}`);
  if (!r.ok) throw new Error(`Error al cargar asignaciones (${r.status})`);
  const data = await r.json();
  return Array.isArray(data) ? data : (data.items || []);
}

export async function crearAsignacion(payload) {
  const r = await fetch(`${BASE_ASIG}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Error al crear asignación (${r.status})`);
  const data = await r.json();
  return data.item || data;
}

export async function editarAsignacion(id, payload) {
  const r = await fetch(`${BASE_ASIG}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Error al editar asignación (${r.status})`);
  const data = await r.json();
  return data.item || data;
}

export async function borrarAsignacion(id) {
  const r = await fetch(`${BASE_ASIG}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`Error al borrar asignación (${r.status})`);
  return r.json();
}

// ── Resumen mensual ───────────────────────────────────────────────────────────

export async function getResumenMensual({ mesKey } = {}) {
  const items = await getDisponibilidades({ mesKey });
  const totalDisponible = items.reduce((s, d) => s + (d.tons || 0), 0);
  return { totalDisponible, totalAsignado: 0, saldo: totalDisponible };
}

// ── Saldos (Balance) ──────────────────────────────────────────────────────────

export async function getSaldos({ anio, from, to } = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries({ anio, from, to }).filter(([, v]) => v != null && v !== ''))
  );
  const r = await fetch(`${BASE}/saldos${params.size ? `?${params}` : ''}`);
  if (!r.ok) throw new Error(`Error al cargar saldos (${r.status})`);
  const data = await r.json();
  return Array.isArray(data) ? data : (data.items || []);
}
