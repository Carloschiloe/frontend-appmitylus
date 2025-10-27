// api.js (Interacciones) — FIX apuntando SIEMPRE al backend correcto
// - Auto-detecta si estás en el dominio del frontend de Vercel y fuerza la base del backend.
// - Respeta VITE_API_BASE si está configurado.
// - Mantiene compatibilidad local (localhost) con rutas relativas /api.
// - Incluye suggestContactos y suggestProveedores.

(function initApiBase(){
  const FRONT_VERCEL = 'frontend-appmitylus.vercel.app';
  const BACK_VERCEL  = 'https://backend-appmitylus.vercel.app/api';

  // 1) Si viene por env, úsalo
  let base =
    (typeof import !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_API_BASE) ||
    (typeof window !== 'undefined' && window.API_BASE);

  // 2) Si estamos en el dominio del frontend de Vercel, fuerza backend vercel
  if (!base && typeof window !== 'undefined' && window.location && window.location.host === FRONT_VERCEL) {
    base = BACK_VERCEL;
  }

  // 3) Fallback:
  //    - En local (vite/localhost) funciona con /api (proxy o server local).
  //    - En otras origins, intenta usar BACK_VERCEL para evitar pegarle al mismo dominio del FE.
  if (!base) {
    const host = (typeof window !== 'undefined' && window.location && window.location.host) || '';
    base = host && /localhost:?\d*/i.test(host) ? '/api' : BACK_VERCEL;
  }

  // Normaliza (sin slash final)
  base = String(base).replace(/\/$/, '');
  window.API_BASE = base;
})();

const API = window.API_BASE;

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
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j = await r.json();
          if (j?.error) msg = j.error;
          else if (j?.message) msg = j.message;
          else if (j?.msg) msg = j.msg;
        } else {
          msg = await r.text();
        }
      } catch {/* ignore */}
      const e = new Error(msg || `HTTP ${r.status}`);
      e.status = r.status;
      throw e;
    }
    if (r.status === 204) return null; // No Content
    const ct = r.headers.get('content-type') || '';
    return ct.includes('application/json') ? r.json() : r.text();
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

// GET /api/interacciones/:id
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
   Sugerencias
   ========================= */

// GET /api/suggest/contactos?q=...
export async function suggestContactos(q) {
  const url = `${API}/suggest/contactos${buildQuery({ q })}`;
  return fx(url); // { ok, items: [{contactoId,...}] }
}

// GET /api/suggest/proveedores?q=...
export async function suggestProveedores(q) {
  const url = `${API}/suggest/proveedores${buildQuery({ q })}`;
  return fx(url); // { ok, items: [{ proveedorKey, proveedorNombre, codigos:[] }] }
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
  if (out.fechaProx)    out.fechaProx    = toISODateOnly(out.fechaProx);
  if (out.proximoPasoFecha) out.proximoPasoFecha = toISODateOnly(out.proximoPasoFecha);

  // Números
  if (out.tonsCompromiso !== undefined && out.tonsCompromiso !== null) {
    const n = Number(out.tonsCompromiso);
    out.tonsCompromiso = Number.isFinite(n) ? n : undefined;
  }
  if (out.tonsConversadas !== undefined && out.tonsConversadas !== null) {
    const n = Number(out.tonsConversadas);
    out.tonsConversadas = Number.isFinite(n) ? n : undefined;
  }

  // Booleanos
  if (typeof out.nuevo === 'string') out.nuevo = out.nuevo.trim().toLowerCase() === 'true';

  // Limpia vacíos "" -> undefined para no sobreescribir con string vacío
  for (const k of Object.keys(out)) {
    if (out[k] === '') delete out[k];
  }
  return out;
}

/* =========================
   Debug helper opcional
   ========================= */
export function pingAlive(){
  return fx(`${API}/_alive`);
}
