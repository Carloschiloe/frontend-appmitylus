// js/abastecimiento/contactos/interacciones/api.js
// API helper SOLO para Interacciones, sin tocar globals ni window.API_BASE
(function(){ /* no-op IIFE para aislar scope */ })();

const FRONT_VERCEL = 'frontend-appmitylus.vercel.app';
const BACK_VERCEL  = 'https://backend-appmitylus.vercel.app/api';

/** Determina base sin modificar globals */
function resolveBase(){
  // respeta window.API_BASE si ya existe
  const preset = (typeof window !== 'undefined' && window.API_BASE) ? String(window.API_BASE).replace(/\/$/, '') : '';
  if (preset) return preset;

  if (typeof window !== 'undefined' && window.location){
    const host = String(window.location.host || '');
    if (host === FRONT_VERCEL) return BACK_VERCEL;
    if (/localhost(:\d+)?/i.test(host)) return '/api';
  }
  return '/api';
}

// Base FINAL para este módulo (SCOPE LOCAL)
const API_INT = resolveBase() + '/interacciones';

/* =========================
   Utils
   ========================= */
function toISODateOnly(v){
  if (!v) return '';
  const d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function asNumBoolDate(value){
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return toISODateOnly(value);
  if (typeof value === 'string'){
    const t = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
    if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  }
  return value;
}

function buildQuery(params = {}){
  const entries = [];
  for (const [k,v] of Object.entries(params)){
    if (v === undefined || v === null || v === '') continue;
    entries.push(`${encodeURIComponent(k)}=${encodeURIComponent(asNumBoolDate(v))}`);
  }
  return entries.length ? `?${entries.join('&')}` : '';
}

async function fx(url, opts = {}){
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
  if (!res.ok){
    const txt = await res.text().catch(()=>'');
    throw new Error(`HTTP ${res.status} – ${txt}`);
  }
  const ct = res.headers.get('content-type')||'';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

/* ============ ENDPOINTS (scoped) ============ */
export function pingAlive(){ return fx(API_INT + '/_alive'); }

export function list(params){ return fx(API_INT + buildQuery(params)); }

export function create(payload){ 
  return fx(API_INT, { method:'POST', body: JSON.stringify(payload||{}) });
}

export function update(id, payload){
  if (!id) throw new Error('update(): id requerido');
  return fx(`${API_INT}/${encodeURIComponent(id)}`, { method:'PUT', body: JSON.stringify(payload||{}) });
}

export function remove_(id){
  if (!id) throw new Error('remove_(): id requerido');
  return fx(`${API_INT}/${encodeURIComponent(id)}`, { method:'DELETE' });
}

/** Normaliza payload antes de enviar */
export function normalizeForSave(data = {}){
  const out = { ...data };
  if (out.fecha) out.fecha = toISODateOnly(out.fecha);
  if (out.tonsConversadas != null) out.tonsConversadas = Number(out.tonsConversadas)||0;
  for (const k of Object.keys(out)){
    if (out[k] === '') delete out[k];
  }
  return out;
}
