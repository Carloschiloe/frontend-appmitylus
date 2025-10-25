const API = (window.API_BASE || '/api');

export async function list(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${API}/interacciones${qs ? `?${qs}` : ''}`);
  if (!r.ok) throw new Error('No se pudo listar interacciones');
  return r.json(); // { items: [...], total }
}

export async function create(payload) {
  const r = await fetch(`${API}/interacciones`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('No se pudo crear la interacción');
  return r.json();
}

export async function update(id, payload) {
  const r = await fetch(`${API}/interacciones/${id}`, {
    method:'PUT',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('No se pudo actualizar');
  return r.json();
}

export async function remove(id) {
  const r = await fetch(`${API}/interacciones/${id}`, { method:'DELETE' });
  if (!r.ok) throw new Error('No se pudo eliminar');
  return r.json();
}
