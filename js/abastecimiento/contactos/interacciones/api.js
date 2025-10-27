// api.js (Interacciones) — versión estable sin import.meta

(function initApiBase(){
  const FRONT_VERCEL = 'frontend-appmitylus.vercel.app';
  const BACK_VERCEL  = 'https://backend-appmitylus.vercel.app/api';

  // 1) Si alguien ya seteó window.API_BASE, úsalo
  var base = (typeof window !== 'undefined' && window.API_BASE) || '';

  // 2) Si no hay base, decide según el host actual
  if (!base && typeof window !== 'undefined' && window.location) {
    var host = String(window.location.host || '');
    if (host === FRONT_VERCEL) {
      // En el dominio del frontend de Vercel: apunta SIEMPRE al backend vercel
      base = BACK_VERCEL;
    } else if (/localhost(:\d+)?/i.test(host)) {
      // En local: deja /api (proxy o server local)
      base = '/api';
    } else {
      // Cualquier otro host: usa backend vercel
      base = BACK_VERCEL;
    }
  }

  // 3) Fallback final
  if (!base) base = BACK_VERCEL;

  // Normaliza (sin slash final)
  base = String(base).replace(/\/$/, '');
  if (typeof window !== 'undefined') window.API_BASE = base;
})();

var API = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : '/api';

/* =========================
   Utils
   ========================= */
function toISODateOnly(v){
  if (!v) return '';
  var d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,'0');
  var day = String(d.getDate()).padStart(2,'0');
  return y + '-' + m + '-' + day;
}

function coerce(value){
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return toISODateOnly(value);
  if (typeof value === 'string'){
    var t = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
    if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  }
  return value;
}

function buildQuery(params) {
  params = params || {};
  var entries = [];
  for (var k in params){
    if (!Object.prototype.hasOwnProperty.call(params,k)) continue;
    var v = params[k];
    if (v === undefined || v === null || v === '') continue;
    if (v instanceof Date) entries.push([k, toISODateOnly(v)]);
    else if (Array.isArray(v)) entries.push([k, v.map(coerce).join(',')]);
    else if (typeof v === 'boolean') entries.push([k, v ? 'true' : 'false']);
    else entries.push([k, coerce(v)]);
  }
  var usp = new URLSearchParams(entries);
  var qs = usp.toString();
  return qs ? ('?' + qs) : '';
}

// fetch con timeout + mejores mensajes
async function fx(url, opts, timeoutMs){
  opts = opts || {};
  var ctrl = new AbortController();
  var t = setTimeout(function(){ try{ ctrl.abort(); }catch(e){} }, timeoutMs || 15000);
  try {
    var r = await fetch(url, Object.assign({ signal: ctrl.signal }, opts));
    if (!r.ok) {
      var msg = 'HTTP ' + r.status;
      try {
        var ct = r.headers.get('content-type') || '';
        if (ct.indexOf('application/json') >= 0) {
          var j = await r.json();
          if (j && j.error) msg = j.error;
          else if (j && j.message) msg = j.message;
          else if (j && j.msg) msg = j.msg;
        } else {
          msg = await r.text();
        }
      } catch(e){}
      var err = new Error(msg || ('HTTP ' + r.status));
      err.status = r.status;
      throw err;
    }
    if (r.status === 204) return null;
    var ct2 = r.headers.get('content-type') || '';
    return (ct2.indexOf('application/json') >= 0) ? r.json() : r.text();
  } finally {
    clearTimeout(t);
  }
}

/* =========================
   Interacciones API
   ========================= */

// GET /api/interacciones?{semana|from,to,...}
export async function list(params){
  params = params || {};
  var from = params.from, to = params.to, semana = params.semana;
  var rest = Object.assign({}, params);
  delete rest.from; delete rest.to; delete rest.semana;

  var q = {};
  if (from) q.from = toISODateOnly(from);
  if (to)   q.to   = toISODateOnly(to);
  else if (!from && semana) q.semana = String(semana);
  for (var k in rest) if (Object.prototype.hasOwnProperty.call(rest,k)) q[k]=rest[k];

  var url = API + '/interacciones' + buildQuery(q);
  return fx(url);
}

export async function getOne(id){
  if (!id) throw new Error('Falta id');
  return fx(API + '/interacciones/' + encodeURIComponent(id));
}

export async function create(payload){
  var body = JSON.stringify(sanitizePayload(payload || {}));
  return fx(API + '/interacciones', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: body
  });
}

export async function update(id, payload){
  if (!id) throw new Error('Falta id');
  var body = JSON.stringify(sanitizePayload(payload || {}));
  return fx(API + '/interacciones/' + encodeURIComponent(id), {
    method:'PUT',
    headers:{ 'Content-Type':'application/json' },
    body: body
  });
}

export async function remove(id){
  if (!id) throw new Error('Falta id');
  return fx(API + '/interacciones/' + encodeURIComponent(id), { method:'DELETE' });
}

/* =========================
   Sugerencias
   ========================= */

export async function suggestContactos(q){
  var url = API + '/suggest/contactos' + buildQuery({ q:q });
  return fx(url);
}

export async function suggestProveedores(q){
  var url = API + '/suggest/proveedores' + buildQuery({ q:q });
  return fx(url);
}

/* =========================
   Helpers de saneo
   ========================= */

function sanitizePayload(p){
  p = p || {};
  var out = Object.assign({}, p);

  if (out.fecha)             out.fecha             = toISODateOnly(out.fecha);
  if (out.fechaProximo)      out.fechaProximo      = toISODateOnly(out.fechaProximo);
  if (out.fechaProx)         out.fechaProx         = toISODateOnly(out.fechaProx);
  if (out.proximoPasoFecha)  out.proximoPasoFecha  = toISODateOnly(out.proximoPasoFecha);

  if (out.tonsCompromiso != null){
    var n1 = Number(out.tonsCompromiso);
    out.tonsCompromiso = isFinite(n1) ? n1 : undefined;
  }
  if (out.tonsConversadas != null){
    var n2 = Number(out.tonsConversadas);
    out.tonsConversadas = isFinite(n2) ? n2 : undefined;
  }
  if (typeof out.nuevo === 'string') out.nuevo = out.nuevo.trim().toLowerCase() === 'true';

  for (var k in out) {
    if (!Object.prototype.hasOwnProperty.call(out,k)) continue;
    if (out[k] === '') delete out[k];
  }
  return out;
}

export function pingAlive(){
  return fx(API + '/_alive');
}
