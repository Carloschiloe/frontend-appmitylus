const API = (window.API_BASE ? String(window.API_BASE).replace(/\/$/, '') : '') || '/api';

// Util: limpia params vacíos y formatea booleanos/arrays
function buildQuery(params = {}) {
  const entries = Object.entries(params).filter(([, v]) =>
    v !== undefined && v !== null && v !== ''
  ).map(([k, v]) => {
    if (Array.isArray(v)) return [k, v.join(',')];
    if (typeof v === 'boolean') return [k, v ? 'true' : 'false'];
    return [k, v];
  });
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : '';
}

// Util: fetch con timeout + mejores mensajes
async function fx(url, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, ...opts /* , credentials:'include' */ });
    if (!r.ok) {
      let msg = 'Error HTTP ' + r.status;
      try { const j = await r.json(); if (j && j.error) msg = j.error; } catch {}
      const e = new Error(msg); e.status = r.status; throw e;
    }
    // 204 No Content
    if (r.status === 204) return null;
    return r.json();
  } finally {
    clearTimeout(t);
  }
}

// GET /api/interacciones?{semana|from,to,...}
export async function list(params = {}) {
  // Si vienen from/to y semana juntos, prioriza rango
  const { from, to, semana, ...rest } = params || {};
  const q = {};
  if (from) q.from = from;
  if (to) q.to = to;
  else if (!from && semana) q.semana = semana; // solo si no hay rango
  Object.assign(q, rest);

  const url = `${API}/interacciones${buildQuery(q)}`;
  return fx(url); // { ok, items, total? }
}

// GET /api/interacciones/:id (por si lo necesitas)
export async function getOne(id) {
  if (!id) throw new Error('Falta id');
  return fx(`${API}/interacciones/${encodeURIComponent(id)}`);
}

export async function create(payload) {
  return fx(`${API}/interacciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function update(id, payload) {
  if (!id) throw new Error('Falta id');
  return fx(`${API}/interacciones/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function remove(id) {
  if (!id) throw new Error('Falta id');
  return fx(`${API}/interacciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
