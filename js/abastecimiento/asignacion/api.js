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

      // --- objeto normalizado (¡propaga mesKey, anio, mes!) ---
      const row = {
        // claves tiempo
        Mes        : mesKeyVal,         // YYYY-MM para agrupar
        Semana     : semanaKey,         // YYYY-WW
        FechaBase  : fechaBase || '',   // referencia/depuración

        // también dejamos los originales, por si los usa estado/inventario en debug
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

      // ---- LOGS por fila problemática ----
      if (DEBUG) {
        // fila que cayó al fallback (sin mesKey ni anio/mes)
        if (!rawMesKey && !ymFromNums) {
          console.warn('[getOfertas] Fila sin mesKey/anio+mes; usando fallback por fecha.',
            { idx, proveedor: row.Proveedor.slice(0,60), mes: row.Mes, fechaBase: row.FechaBase });
        }
        // si hay mesKey y no coincide con el Mes calculado (no debería ocurrir)
        if (rawMesKey && rawMesKey !== mesKeyVal) {
          console.warn('[getOfertas] Inconsistencia mesKey vs Mes calculado',
            { idx, mesKey: rawMesKey, mesCalc: mesKeyVal, fechaBase: row.FechaBase, proveedor: row.Proveedor.slice(0,60) });
        }
      }

      return row;
    })
    .filter(r => r.Tons > 0);

  // ---- resumenes para detectar el caso de AGO con 100 t ----
  if (DEBUG) {
    DBGg('[getOfertas] resumen');
    const dist = out.reduce((acc,x)=> (acc[x.Mes]=(acc[x.Mes]||0)+1, acc), {});
    console.log('Distribución por Mes (conteo):', dist);
    const porMes = out.reduce((acc,x)=> (acc[x.Mes]=(acc[x.Mes]||0)+x.Tons, acc), {});
    console.table(Object.entries(porMes).map(([k,v])=>({Mes:k, Tons:v})));
    // Lista la(s) fila(s) que quedaron en 2025-08 (tu caso)
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
