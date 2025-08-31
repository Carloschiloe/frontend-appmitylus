// js/abastecimiento/asignacion/api.js
export const API_URL = 'https://backend-appmitylus.vercel.app/api';

/* ============ Helpers ============ */
async function checkResponse(resp){
  if (!resp.ok) {
    const text = await resp.text().catch(()=> '');
    throw new Error(`HTTP ${resp.status} - ${text}`);
  }
  if (resp.status === 204) return null;
  return await resp.json().catch(()=> null);
}

// devuelve "fallback" si la ruta no existe (404) o ante cualquier error
async function safeGet(url, fallback){
  try{
    const r = await fetch(url, {headers: {'Accept':'application/json'}});
    if (r.status === 404) return fallback;
    return await checkResponse(r);
  }catch(_e){
    return fallback;
  }
}

// Normalizaciones de fecha -> Mes (YYYY-MM) y Semana ISO (YYYY-WW)
function parseDateOrNull(d){
  if (!d && d!==0) return null;
  const s = (typeof d === 'string' && /^\d{4}-\d{2}$/.test(d)) ? (d+'-01') : d;
  const x = new Date(s);
  return (!Number.isNaN(x.getTime()) && x.getTime()!==0) ? x : null;
}
function monthKey(d){
  const x = parseDateOrNull(d);
  if (!x) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,'0');
  return `${y}-${m}`;
}
function isoWeekKey(d){
  const x = parseDateOrNull(d);
  if (!x) return '';
  const dt = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((dt - yearStart)/86400000)+1)/7);
  return `${dt.getUTCFullYear()}-${String(weekNo).padStart(2,'0')}`;
}

/* ============ Ofertas / Inventario ============ */
export async function getOfertas(){
  const raw = await safeGet(`${API_URL}/planificacion/ofertas`, []);
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);

  return arr
    .map(it=>{
      const fechaBase = it.fecha || it.fechaPlan || it.fch || it.mes || it.mesKey || '';
      const mesKey = it.mesKey || monthKey(fechaBase);
      const semanaKey = isoWeekKey(fechaBase);

      return {
        FechaBase : fechaBase,
        Mes       : mesKey,                 // p.ej. "2025-08"
        Semana    : semanaKey,              // p.ej. "2025-36"
        proveedorId: it.proveedorId ?? null,
        Proveedor : it.proveedorNombre || it.proveedor || '',
        Centro    : it.centroCodigo || '',
        Área      : it.areaCodigo || it.area || '',
        Comuna    : it.comuna || it.centroComuna || '',
        Tons      : Number(it.tons) || 0,
        Tipo      : (it.tipo || 'NORMAL').toUpperCase(), // NORMAL / BAP
        Fuente    : it.fuente ? (it.fuente[0].toUpperCase()+it.fuente.slice(1)) : 'Disponibilidad'
      };
    })
    .filter(r => r.Tons > 0);
}

export async function getAsignacionesMapa(){
  const raw = await safeGet(`${API_URL}/asignaciones/map`, {});
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  const map = new Map();
  for (const it of arr){
    const key = it.key || it.mesKey || (it.anio && it.mes ? `${it.anio}-${String(it.mes).padStart(2,'0')}` : '');
    const val = Number(it.asignado ?? it.tons ?? it.total ?? it.valor ?? 0);
    if (key && Number.isFinite(val)) map.set(key, (map.get(key)||0) + val);
  }
  return map;
}

export async function crearAsignacion({mesKey, proveedorNombre, tons, tipo='NORMAL', fuente='ui'}){
  const r = await fetch(`${API_URL}/asignaciones`, {
    method : 'POST',
    headers: {'Content-Type':'application/json', 'Accept':'application/json'},
    body   : JSON.stringify({mesKey, proveedorNombre, tons, tipo, fuente})
  });
  return checkResponse(r);
}

/* ============ Programa semanal (placeholder seguro) ============ */
// Nota: Si tu backend usa otras rutas, cámbialas aquí. Con safeGet([]) no revienta si es 404.
export async function getProgramaSemana(weekKey){
  const raw = await safeGet(`${API_URL}/programa?week=${encodeURIComponent(weekKey)}`, []);
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
  return arr.map(x => ({
    id               : x.id || `${x.fecha}-${x.proveedorNombre}-${x.tipo || 'NORMAL'}`,
    fecha            : x.fecha,
    proveedorNombre  : x.proveedorNombre || '',
    comuna           : x.comuna || '',
    tipo             : (x.tipo || 'NORMAL').toUpperCase(),
    camiones         : Number(x.camiones) || 0,
    tons             : Number(x.tons) || 0,
    notas            : x.notas || '',
    estado           : x.estado || 'BORRADOR',
  }));
}

export async function guardarPrograma(entry){
  const r = await fetch(`${API_URL}/programa`, {
    method : 'POST',
    headers: {'Content-Type':'application/json', 'Accept':'application/json'},
    body   : JSON.stringify(entry)
  });
  return checkResponse(r);
}

export async function getEstadosDia(desdeISO, hastaISO){
  const raw = await safeGet(`${API_URL}/programa/days?from=${desdeISO}&to=${hastaISO}`, []);
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
  return arr.map(x => ({
    date  : x.date || x.fecha,
    status: x.status || 'OPEN',
    reason: x.reason || '',
  }));
}

export async function guardarEstadoDia({date, status, reason}){
  const r = await fetch(`${API_URL}/programa/days`, {
    method : 'POST',
    headers: {'Content-Type':'application/json', 'Accept':'application/json'},
    body   : JSON.stringify({date, status, reason})
  });
  return checkResponse(r);
}
