// js/abastecimiento/asignacion/api.js
export const API_URL = 'https://backend-appmitylus.vercel.app/api';

const DEBUG = true;
const DBG  = (...a) => { if (DEBUG) console.log(...a); };
const DBGg = (t)     => { if (DEBUG) console.groupCollapsed(t); };
const DBGend = ()    => { if (DEBUG) console.groupEnd(); };

/* ============ Helpers ============ */
async function checkResponse(resp){
  if (!resp.ok) {
    const text = await resp.text().catch(()=> '');
    throw new Error(`HTTP ${resp.status} - ${text}`);
  }
  if (resp.status === 204) return null;
  return await resp.json().catch(()=> null);
}
async function safeGet(url, fallback){
  try{
    const r = await fetch(url, {headers: {'Accept':'application/json'}});
    if (r.status === 404) return fallback;
    return await checkResponse(r);
  }catch(_e){
    return fallback;
  }
}

// ---- fechas
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
const MES_RE = /^\d{4}-\d{2}$/;
const pad2 = (n) => String(n).padStart(2,'0');

/* ============ Ofertas / Inventario ============ */
export async function getOfertas(){
  const raw = await safeGet(`${API_URL}/planificacion/ofertas`, []);
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);

  const out = arr
    .map((it, idx)=>{
      // --- toma mesKey si viene; si no, construye desde anio+mes; si no, cae a fechas ---
      const rawMesKey   = typeof it.mesKey === 'string' && MES_RE.test(it.mesKey) ? it.mesKey : null;
      const ymFromNums  = (it.anio && it.mes) ? `${it.anio}-${pad2(it.mes)}` : null;
      const fechaBase   =
        rawMesKey
        || ymFromNums
        || it.fecha
        || it.fechaPlan
        || it.fch
        || it.createdAt
        || it.mes
        || '';

      const mesKeyVal   = rawMesKey || ymFromNums || monthKey(fechaBase);
      const semanaKey   = isoWeekKey(fechaBase || (mesKeyVal ? `${mesKeyVal}-01` : ''));

      // soporta distintos nombres de campo para toneladas
      const tons = Number(
        it.tonsDisponible ?? it.tons ?? it.total ?? it.valor ?? 0
      ) || 0;

      // --- objeto normalizado ---
      const row = {
        // claves tiempo
        Mes        : mesKeyVal,         // YYYY-MM para agrupar
        Semana     : semanaKey,         // YYYY-WW
        FechaBase  : fechaBase || '',   // referencia/depuración

        // también dejamos los originales
        mesKey     : rawMesKey || mesKeyVal,
        anio       : it.anio ?? (mesKeyVal ? Number(mesKeyVal.slice(0,4)) : null),
        mes        : it.mes  ?? (mesKeyVal ? Number(mesKeyVal.slice(5,7)) : null),

        // otros campos
        proveedorId: it.proveedorId ?? null,
        Proveedor  : it.proveedorNombre || it.proveedor || '',
        Centro     : it.centroCodigo || '',
        Área       : it.areaCodigo || it.area || '',
        Comuna     : it.comuna || it.centroComuna || '',
        Tons       : tons,
        Tipo       : (it.tipo || 'NORMAL').toUpperCase(),
        Fuente     : it.fuente ? (it.fuente[0].toUpperCase()+it.fuente.slice(1)) : 'Disponibilidad',
      };

      if (DEBUG) {
        if (!rawMesKey && !ymFromNums) {
          console.warn('[getOfertas] Fila sin mesKey/anio+mes; usando fallback por fecha.',
            { idx, proveedor: row.Proveedor.slice(0,60), mes: row.Mes, fechaBase: row.FechaBase });
        }
        if (rawMesKey && rawMesKey !== mesKeyVal) {
          console.warn('[getOfertas] Inconsistencia mesKey vs Mes calculado',
            { idx, mesKey: rawMesKey, mesCalc: mesKeyVal, fechaBase: row.FechaBase, proveedor: row.Proveedor.slice(0,60) });
        }
      }

      return row;
    })
    .filter(r => r.Tons > 0);

  if (DEBUG) {
    DBGg('[getOfertas] resumen');
    const dist = out.reduce((acc,x)=> (acc[x.Mes]=(acc[x.Mes]||0)+1, acc), {});
    console.log('Distribución por Mes (conteo):', dist);
    const porMes = out.reduce((acc,x)=> (acc[x.Mes]=(acc[x.Mes]||0)+x.Tons, acc), {});
    console.table(Object.entries(porMes).map(([k,v])=>({Mes:k, Tons:v})));
    const ago = out.filter(x => x.Mes === '2025-08');
    if (ago.length) {
      console.warn('[getOfertas] Filas en 2025-08:', ago.length);
      console.table(ago.map(x => ({
        Proveedor: x.Proveedor.slice(0,60),
        mesKey: x.mesKey, anio: x.anio, mes: x.mes,
        FechaBase: x.FechaBase, Tons: x.Tons
      })));
    }
    DBGend();
  }

  return out;
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
  if (DEBUG) {
    DBGg('[getAsignacionesMapa] resumen');
    console.table([...map.entries()].map(([k,v])=>({Mes:k, Asignado:v})));
    DBGend();
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

/* ======= NUEVO: listado/edición/anulación de asignaciones ======= */

// GET /asignaciones?mesKey=YYYY-MM&q=texto
export async function getAsignacionesListado({ mesKey, q='' } = {}){
  const url = new URL(`${API_URL}/asignaciones`);
  if (mesKey) url.searchParams.set('mesKey', mesKey);
  if (q)      url.searchParams.set('q', q);
  const r = await fetch(url.toString(), { headers:{'Accept':'application/json'} });
  const json = await checkResponse(r);
  const arr = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
  // normaliza campos comunes por si te sirven directo en Tabulator
  return arr.map(x => ({
    _id: x._id || x.id,
    mesKey: x.mesKey,
    proveedorNombre: x.proveedorNombre || x.proveedor || '',
    plantaNombre: x.plantaNombre || x.planta || '',
    comuna: x.comuna || '',
    tipo: (x.tipo || 'NORMAL').toUpperCase(),
    tonsAsignadas: Number(x.tonsAsignadas ?? x.tons ?? 0) || 0,
    estado: x.estado || 'planificada',
    fecha: x.fecha || x.createdAt || null,
    notas: x.notas || '',
  }));
}

// PATCH /asignaciones/:id  (edición inline)
export async function updateAsignacion(id, payload){
  const r = await fetch(`${API_URL}/asignaciones/${encodeURIComponent(id)}`, {
    method:'PATCH',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify(payload)
  });
  return checkResponse(r);
}

// PATCH /asignaciones/:id  (anular)
export async function anularAsignacion(id){
  const r = await fetch(`${API_URL}/asignaciones/${encodeURIComponent(id)}`, {
    method:'PATCH',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify({ estado:'anulado' })
  });
  return checkResponse(r);
}

/* ============ Programa semanal (placeholder seguro) ============ */
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
// --- REQUERIMIENTO MENSUAL (planificacionmes) -----------------------------

// Opción A (recomendada): /planificacion/mes?mesKey=YYYY-MM&tipo=NORMAL
export async function getPlanMes(mesKey, tipo='NORMAL'){
  // Si tu backend usa /planificacionmes en vez de /planificacion/mes,
  // cambia la línea de abajo por la opción B.
  const url = `${API_URL}/planificacion/mes?mesKey=${encodeURIComponent(mesKey)}&tipo=${encodeURIComponent(tipo)}`;
  const r = await fetch(url, { headers:{'Accept':'application/json'} });
  if (r.status === 404) return null;
  const data = await checkResponse(r);
  // normalizo: devolver {mesKey, tons}
  if (!data) return null;
  if (Array.isArray(data)) return data[0] || null;   // si viene como array
  return data;                                       // si viene como objeto
}

/* // Opción B (si tu backend expone /planificacionmes)
export async function getPlanMes(mesKey, tipo='NORMAL'){
  const url = `${API_URL}/planificacionmes?mesKey=${encodeURIComponent(mesKey)}&tipo=${encodeURIComponent(tipo)}`;
  const r = await fetch(url, { headers:{'Accept':'application/json'} });
  if (r.status === 404) return null;
  return await checkResponse(r);
}
*/

export async function guardarPlanMes({mesKey, tons, tipo='NORMAL'}){
  const r = await fetch(`${API_URL}/planificacion/mes`, {
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify({ mesKey, tons, tipo })
  });
  return checkResponse(r);
}

