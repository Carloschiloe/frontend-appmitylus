// api.js (Interacciones)
const API = (window.API_BASE ? String(window.API_BASE).replace(/\/$/, '') : '') || '/api';

/* =========================
   Utils
   ========================= */
function toISODateOnly(v){
  if (!v) return '';
  const d = (v instanceof Date) ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function coerce(value){
  // Convierte strings "true/false/123" a tipos nativos cuando aplica
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return toISODateOnly(value);
  if (typeof value === 'string'){
    const t = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;               // fecha YYYY-MM-DD
    if (/^\d+(\.\d+)?$/.test(t)) return Number(t);             // número
    if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  }
  return value;
}

// Limpia params vacíos y formatea booleanos/arrays/fechas
function buildQuery(params = {}) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      if (v instanceof Date) return [k, toISODateOnly(v)];
      if (Array.isArray(v)) return [k, v.map(coerce).join(',')];
      if (typeof v === 'boolean') return [k, v ? 'true' : 'false'];
      return [k, coerce(v)];
    });
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : '';
}

// fetch con timeout + mejores mensajes de error
async function fx(url, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, ...opts /* , credentials:'include' */ });
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try {
        const j = await r.json();
        if (j?.error) msg = j.error;
        else if (j?.message) msg = j.message;
        else if (j?.msg) msg = j.msg;
      } catch {/* ignore */}
      const e = new Error(msg);
      e.status = r.status;
      throw e;
    }
    if (r.status === 204) return null; // No Content
    return r.json();
  } finally {
    clearTimeout(t);
  }
}

/* =========================
   Interacciones API
   ========================= */

// GET /api/interacciones?{semana|from,to,...}
export async function list(params = {}) {
  // Prioriza rango de fechas por sobre semana
  const { from, to, semana, ...rest } = params || {};
  const q = {};
  if (from) q.from = toISODateOnly(from);
  if (to)   q.to   = toISODateOnly(to);
  else if (!from && semana) q.semana = String(semana);
  Object.assign(q, rest);

  const url = `${API}/interacciones${buildQuery(q)}`;
  return fx(url); // { ok, items }
}

// (Opcional) GET /api/interacciones/:id — sólo si tu backend lo implementó
export async function getOne(id) {
  if (!id) throw new Error('Falta id');
  return fx(`${API}/interacciones/${encodeURIComponent(id)}`);
}

// POST /api/interacciones
export async function create(payload) {
  const body = JSON.stringify(sanitizePayload(payload));
  return fx(`${API}/interacciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
}

// PUT /api/interacciones/:id
export async function update(id, payload) {
  if (!id) throw new Error('Falta id');
  const body = JSON.stringify(sanitizePayload(payload));
  return fx(`${API}/interacciones/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body
  });
}

// DELETE /api/interacciones/:id
export async function remove(id) {
  if (!id) throw new Error('Falta id');
  return fx(`${API}/interacciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/* =========================
   Sugerencias de contactos
   ========================= */

// GET /api/suggest/contactos?q=...
export async function suggestContactos(q) {
  const url = `${API}/suggest/contactos${buildQuery({ q })}`;
  return fx(url); // { ok, items: [{contactoId,...}] }
}

/* =========================
   Helpers de saneo de payload
   ========================= */

function sanitizePayload(p = {}) {
  // Asegura formatos consistentes para backend:
  const out = { ...p };

  // Fechas
  if (out.fecha)        out.fecha        = toISODateOnly(out.fecha);
  if (out.fechaProximo) out.fechaProximo = toISODateOnly(out.fechaProximo);

  // Números
  if (out.tonsCompromiso !== undefined && out.tonsCompromiso !== null) {
    const n = Number(out.tonsCompromiso);
    out.tonsCompromiso = Number.isFinite(n) ? n : undefined;
  }

  // Booleanos
  if (typeof out.nuevo === 'string') out.nuevo = out.nuevo.trim().toLowerCase() === 'true';

  // Limpia vacíos "" -> undefined para no sobreescribir con string vacío
  for (const k of Object.keys(out)) {
    if (out[k] === '') delete out[k];
  }
  return out;
}
