// estado.js
import { claveSemana } from './utilidades.js'; // <- OJO: ya no importamos claveMes

const listeners = new Map();
export const datos = { ofertas: [], asignadoPorMes: new Map(), programaSemana: [], estadosDia: [] };

export function on(evt, fn){ if(!listeners.has(evt)) listeners.set(evt,new Set()); listeners.get(evt).add(fn); }
function emit(evt){ (listeners.get(evt)||[]).forEach(fn=>{ try{fn();}catch{} }); }

/* ========= Helpers locales sin TZ para derivar YYYY-MM ========= */
const MES_RE = /^\d{4}-\d{2}$/;
const pad2 = (n) => String(n).padStart(2,'0');

/**
 * Deriva la clave de mes (YYYY-MM) respetando SIEMPRE:
 * 1) r.mesKey
 * 2) r.anio + r.mes
 * 3) r.Mes si ya vino como YYYY-MM
 * 4) fallback: FechaBase (solo si no hay nada anterior)
 */
function mesFromRecord(r) {
  if (MES_RE.test(r?.mesKey ?? '')) return r.mesKey;
  if (r?.anio && r?.mes) return `${r.anio}-${pad2(r.mes)}`;
  if (MES_RE.test(r?.Mes ?? '')) return r.Mes;
  if (typeof r?.FechaBase === 'string' && /^\d{4}-\d{2}/.test(r.FechaBase)) return r.FechaBase.slice(0,7);
  return '';
}

/**
 * Semana: mantenemos la lógica previa, pero sin tocar el mes.
 * Usa r.Semana si ya viene; si no, la calcula desde FechaBase.
 */
function semanaFromRecord(r){
  if (typeof r?.Semana === 'string' && /^\d{4}-\d{2}$/.test(r.Semana)) return r.Semana;
  return claveSemana(r?.FechaBase);
}

/* ========= Core ========= */

export function ofertasConClaves(){
  const out = datos.ofertas.map(r => {
    const Mes = mesFromRecord(r);              // <- FIX: ya no usamos claveMes(FechaBase)
    const Semana = semanaFromRecord(r);
    return { ...r, Mes, Semana };
  });

  // DEBUG: alerta si algún registro trae mesKey pero terminó con Mes distinto
  const malos = out.filter(x => MES_RE.test(x?.mesKey ?? '') && x.Mes !== x.mesKey);
  if (malos.length) {
    console.warn('[estado.ofertasConClaves] Mes corregido (respetando mesKey). Ejemplos:',
      malos.slice(0, 5).map(x => ({ mesKey: x.mesKey, Mes: x.Mes, anio: x.anio, mes: x.mes, FechaBase: x.FechaBase }))
    );
  }
  return out;
}

export function totalesMesPorTipo(){
  const m = new Map();
  for(const r of ofertasConClaves()){
    const key = `${r.Mes}|${(r.Tipo||'NORMAL').toUpperCase()}`;
    m.set(key, (m.get(key)||0) + (Number(r.Tons)||0));
  }
  return m;
}

export function asignadoMesPorTipo(){
  const invPorTipo = totalesMesPorTipo();
  const res = new Map();
  for (const [mes, asigTotal] of datos.asignadoPorMes.entries()){
    const invTotal = [...invPorTipo.entries()]
      .filter(([k]) => k.startsWith(`${mes}|`))
      .reduce((s,[,v]) => s + v, 0);
    if (invTotal <= 0) continue;
    for (const [k, invT] of invPorTipo.entries()){
      if (!k.startsWith(`${mes}|`)) continue;
      res.set(k, (res.get(k)||0) + asigTotal * (invT / invTotal));
    }
  }
  return res;
}

export function filasEnriquecidas({tipo='ALL'} = {}){
  const asigT = asignadoMesPorTipo();
  const invPorTipo = totalesMesPorTipo(); // evitar recomputar dentro del map

  return ofertasConClaves()
    .map(r => {
      const t = (r.Tipo || 'NORMAL').toUpperCase();
      const tons = +r.Tons || 0;

      const invMesTipo   = invPorTipo.get(`${r.Mes}|${t}`) || 0;
      const asigMesTipo  = asigT.get(`${r.Mes}|${t}`) || 0;
      const factor       = invMesTipo > 0 ? (tons / invMesTipo) : 0;

      const Asignado = (tipo === 'ALL' || tipo === t) ? asigMesTipo * factor : 0;
      const Saldo    = tons - Asignado;

      return { ...r, Asignado, Saldo };
    })
    .filter(r => tipo==='ALL' ? true : (r.Tipo||'NORMAL').toUpperCase() === tipo);
}

export function saldoMes({mesKey, tipo='ALL'}){
  const invPorTipo = totalesMesPorTipo();
  const asigPorTipo = asignadoMesPorTipo();

  if (tipo === 'ALL'){
    const inv  = [...invPorTipo.entries()].filter(([k]) => k.startsWith(`${mesKey}|`)).reduce((s,[,v]) => s+v, 0);
    const asig = datos.asignadoPorMes.get(mesKey) || 0;
    return inv - asig;
  } else {
    const inv  = invPorTipo.get(`${mesKey}|${tipo}`) || 0;
    const asig = asigPorTipo.get(`${mesKey}|${tipo}`) || 0;
    return inv - asig;
  }
}

export function esNoOperacion(dateISO){
  const f = datos.estadosDia.find(x => x.date === dateISO);
  return f && (f.status === 'NO_OP' || f.status === 'HOLIDAY') ? f : null;
}

export async function cargarTodo(api){
  const [ofertas, asignMap] = await Promise.all([
    api.getOfertas(),
    api.getAsignacionesMapa()
  ]);
  datos.ofertas = ofertas;
  datos.asignadoPorMes = asignMap;
  emit('actualizado');
}

export async function cargarProgramaSemana(api, weekKey, rangoFechas){
  const [entries, estados] = await Promise.all([
    api.getProgramaSemana(weekKey),
    api.getEstadosDia(rangoFechas[0], rangoFechas.at(-1))
  ]);
  datos.programaSemana = entries;
  datos.estadosDia = estados;
  emit('actualizado-programa');
}

export async function refrescar(api){
  await cargarTodo(api);
  emit('actualizado');
}
