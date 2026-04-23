const BASE = '/api/planificacion';

// ── Disponibilidades ──────────────────────────────────────────────────────────

export async function getDisponibilidades({ mesKey, proveedorKey } = {}) {
  const params = new URLSearchParams();
  if (mesKey) { params.set('from', mesKey); params.set('to', mesKey); }
  if (proveedorKey) params.set('proveedorKey', proveedorKey);

  const r = await fetch(`${BASE}/disponibilidad${params.size ? `?${params}` : ''}`);
  if (!r.ok) throw new Error(`Error al cargar disponibilidades (${r.status})`);
  const data = await r.json();
  // El backend devuelve { items: [...] }
  const items = Array.isArray(data) ? data : (data.items || []);
  // Normalizar: el campo real es tonsDisponible, exponemos como tons
  return items.map(d => ({ ...d, tons: d.tonsDisponible ?? d.tons ?? 0 }));
}

export async function crearDisponibilidad(payload) {
  const r = await fetch(`${BASE}/disponibilidad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Error al crear disponibilidad (${r.status})`);
  const data = await r.json();
  return data.item || data;
}

export async function editarDisponibilidad(id, payload) {
  const r = await fetch(`${BASE}/disponibilidad/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Error al editar disponibilidad (${r.status})`);
  const data = await r.json();
  return data.item || data;
}

export async function borrarDisponibilidad(id) {
  const r = await fetch(`${BASE}/disponibilidad/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`Error al borrar disponibilidad (${r.status})`);
  return r.json();
}

// ── Resumen mensual ───────────────────────────────────────────────────────────
// En vez de un endpoint separado calculamos el resumen desde los items
export async function getResumenMensual({ mesKey } = {}) {
  const items = await getDisponibilidades({ mesKey });
  const totalDisponible = items.reduce((s, d) => s + (d.tons || 0), 0);
  return { totalDisponible, totalAsignado: 0, saldo: totalDisponible };
}

// ── Asignaciones ──────────────────────────────────────────────────────────────

export async function getAsignaciones({ mesKey } = {}) {
  const qs = mesKey ? `?mesKey=${mesKey}` : '';
  const r = await fetch(`${BASE}/asignaciones${qs}`);
  if (!r.ok) throw new Error(`Error al cargar asignaciones (${r.status})`);
  const data = await r.json();
  return Array.isArray(data) ? data : (data.items || []);
}

// ── Saldos (Balance) ──────────────────────────────────────────────────────────

export async function getSaldos({ anio, from, to } = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries({ anio, from, to }).filter(([, v]) => v != null && v !== ''))
  );
  const r = await fetch(`${BASE}/saldos${params.size ? `?${params}` : ''}`);
  if (!r.ok) throw new Error(`Error al cargar saldos (${r.status})`);
  return r.json();
}
