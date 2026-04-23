const BASE = '/api/oportunidades';

export async function listOportunidades(filters = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null))
  ).toString();
  const r = await fetch(`${BASE}${qs ? `?${qs}` : ''}`);
  if (!r.ok) throw new Error(`Error al cargar oportunidades (${r.status})`);
  const data = await r.json();
  return Array.isArray(data) ? data : (data.items || []);
}

export async function cambiarEstado(id, estado, observacion) {
  const r = await fetch(`${BASE}/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado, observacion: observacion || '' }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.error || `Error al cambiar estado (${r.status})`);
  }
  return r.json();
}

export async function cerrarExitoso(id, observacion) {
  const r = await fetch(`${BASE}/${id}/cerrar-exitoso`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ observacion: observacion || '' }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.error || `Error al cerrar (${r.status})`);
  }
  return r.json();
}

export async function cerrarPerdido(id, motivoPerdida, observacion, estado = 'perdido') {
  const r = await fetch(`${BASE}/${id}/cerrar-perdido`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivoPerdida, observacion: observacion || '', estado }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.error || `Error al cerrar perdido (${r.status})`);
  }
  return r.json();
}
