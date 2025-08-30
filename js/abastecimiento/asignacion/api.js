// api.js
const API_URL = 'https://backend-appmitylus.vercel.app/api';

async function checkResponse(resp){
  if(!resp.ok){const text=await resp.text().catch(()=> ''); throw new Error(`HTTP ${resp.status} - ${text}`)}
  if(resp.status===204) return null;
  return await resp.json().catch(()=> null);
}
async function safeGet(url, fallback){
  try{ const r=await fetch(url); return await checkResponse(r); } catch(_e){ return fallback; }
}

export async function getOfertas(){
  const raw = await safeGet(`${API_URL}/planificacion/ofertas`, []);
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
  return arr.map(it=>{
    const fechaBase = it.fecha || it.fechaPlan || it.fch || it.mes || it.mesKey || '';
    return {
      FechaBase: fechaBase,
      Mes: it.mesKey || '',
      Semana: '',
      proveedorId: it.proveedorId || null,
      Proveedor: it.proveedorNombre || it.proveedor || '',
      Centro: it.centroCodigo || '',
      Área: it.areaCodigo || it.area || '',
      Comuna: it.comuna || it.centroComuna || '',
      Tons: Number(it.tons)||0,
      Tipo: (it.tipo || 'NORMAL').toUpperCase(),
      Fuente: it.fuente ? it.fuente[0].toUpperCase()+it.fuente.slice(1) : 'Disponibilidad'
    };
  }).filter(r=>r.Tons>0);
}

export async function getAsignacionesMapa(){
  const raw = await safeGet(`${API_URL}/asignaciones/map`, {});
  const arr=Array.isArray(raw)?raw:(Array.isArray(raw?.items)?raw.items:[]);
  const map=new Map();
  for(const it of arr){
    const key = it.key || it.mesKey || (it.anio && it.mes ? `${it.anio}-${String(it.mes).padStart(2,'0')}` : '');
    const val = Number(it.asignado ?? it.tons ?? it.total ?? it.valor ?? 0);
    if(key && Number.isFinite(val)) map.set(key, (map.get(key)||0) + val);
  }
  return map;
}

export async function crearAsignacion({mesKey, proveedorNombre, tons, tipo='NORMAL', fuente='ui'}){
  const r = await fetch(`${API_URL}/asignaciones`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({mesKey, proveedorNombre, tons, tipo, fuente})
  });
  return checkResponse(r);
}

// ------- Programa semanal (placeholders seguros) -------
export async function getProgramaSemana(weekKey){
  const raw = await safeGet(`${API_URL}/programa?week=${encodeURIComponent(weekKey)}`, []);
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
  return arr.map(x=>({
    id: x.id || `${x.fecha}-${x.proveedorNombre}-${x.tipo || 'NORMAL'}`,
    fecha: x.fecha,
    proveedorNombre: x.proveedorNombre || '',
    comuna: x.comuna || '',
    tipo: (x.tipo || 'NORMAL').toUpperCase(),
    camiones: Number(x.camiones)||0,
    tons: Number(x.tons)||0,
    notas: x.notas || '',
    estado: x.estado || 'BORRADOR'
  }));
}
export async function guardarPrograma(entry){
  const r = await fetch(`${API_URL}/programa`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(entry)
  });
  return checkResponse(r);
}
export async function getEstadosDia(desde, hasta){
  const raw = await safeGet(`${API_URL}/programa/days?from=${desde}&to=${hasta}`, []);
  const arr = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
  return arr.map(x=>({ date: x.date || x.fecha, status: x.status || 'OPEN', reason: x.reason || '' }));
}
export async function guardarEstadoDia({date, status, reason}){
  const r = await fetch(`${API_URL}/programa/days`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({date, status, reason})
  });
  return checkResponse(r);
}
