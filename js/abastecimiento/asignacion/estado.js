// estado.js
import { claveSemana } from './utilidades.js'; // OJO: no usamos claveMes acá

const listeners = new Map();
export const datos = { ofertas: [], asignadoPorMes: new Map(), programaSemana: [], estadosDia: [] };

export function on(evt, fn){ if(!listeners.has(evt)) listeners.set(evt,new Set()); listeners.get(evt).add(fn); }
function emit(evt){ (listeners.get(evt)||[]).forEach(fn=>{ try{fn();}catch{} }); }

// ===== Debug helper =====
function DBG(...a){ if (window.DEBUG_INV) console.log(...a); }
function DBGg(name){ if (window.DEBUG_INV) console.groupCollapsed(name); }
function DBGend(){ if (window.DEBUG_INV) console.groupEnd(); }

/* ========= Helpers locales: YYYY-MM sin TZ ========= */
const MES_RE = /^\d{4}-\d{2}$/;
const pad2 = (n) => String(n).padStart(2,'0');

/**
 * Deriva la clave de mes (YYYY-MM) respetando SIEMPRE:
 * 1) r.mesKey
 * 2) r.anio + r.mes
 * 3) r.Mes (si ya vino como YYYY-MM)
 * 4) fallback: r.FechaBase (solo si no hay nada anterior)
 * Devuelve {mes, source}
 */
function pickMes(r) {
  if (MES_RE.test(r?.mesKey ?? '')) return { mes: r.mesKey, source: 'mesKey' };
  if (r?.anio && r?.mes)            return { mes: `${r.anio}-${pad2(r.mes)}`, source: 'anio+mes' };
  if (MES_RE.test(r?.Mes ?? ''))    return { mes: r.Mes, source: 'Mes(ya venía)' };
  if (typeof r?.FechaBase === 'string' && /^\d{4}-\d{2}/.test(r.FechaBase))
    return { mes: r.FechaBase.slice(0,7), source: 'FechaBase(fallback)' };
  return { mes: '', source: 'none' };
}

/** Semana: conserva r.Semana si viene; si no, calcula desde FechaBase */
function pickSemana(r){
  if (typeof r?.Semana === 'string' && /^\d{4}-\d{2}$/.test(r.Semana)) return r.Semana;
  return claveSemana(r?.FechaBase);
}

/* ========= Core ========= */

export function ofertasConClaves(){
  const out = datos.ofertas.map(r => {
    const { mes, source } = pickMes(r);
    const Semana = pickSemana(r);
    const row = { ...r, Mes: mes, Semana, __mesSource: source };
    return row;
  });

  if (window.DEBUG_INV) {
    DBGg('[estado.ofertasConClaves] resumen');
    const resumenFuente = out.reduce((acc, x) => (acc[x.__mesSource]=(acc[x.__mesSource]||0)+1, acc), {});
    const resumenMes = out.reduce((acc, x) => (acc[x.Mes]=(acc[x.Mes]||0)+1, acc), {});
    DBG('Fuente Mes -> conteo:', resumenFuente);
    DBG('Distribución Mes -> conteo:', resumenMes);
    const inconsistentes = out.filter(x => MES_RE.test(x?.mesKey ?? '') && x.Mes !== x.mesKey);
    if (inconsistentes.length) {
      DBG('⚠️ Inconsistentes Mes vs mesKey (primeros 10):',
        inconsistentes.slice(0,10).map(x => ({
          Proveedor: (x.Proveedor || x.proveedorNombre || '').slice(0,40),
          mesKey: x.mesKey, Mes: x.Mes, src: x.__mesSource, anio: x.anio, mes: x.mes,
          FechaBase: x.FechaBase || x.fecha || x.createdAt || ''
        }))
      );
    }
    DBGend();
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
  const invPorTipo = totalesMesPorTipo();

  const filas = ofertasConClaves()
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

  if (window.DEBUG_INV) {
    DBGg('[estado.filasEnriquecidas] verificación Mes');
    const dist = filas.reduce((a,x)=> (a[x.Mes]=(a[x.Mes]||0)+1, a), {});
    DBG('Distribución Mes post-enriquecido:', dist);
    DBG('Primeras 10:', filas.slice(0,10).map(x => ({
      Mes:x.Mes, src:x.__mesSource, Proveedor:(x.Proveedor||'').slice(0,35), Tons:x.Tons
    })));
    DBGend();
  }
  return filas;
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
    const asig = asigPorTipo.get(`${mesKey}|`${tipo}`) || 0;
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

  if (window.DEBUG_INV) {
    DBGg('[estado.cargarTodo] RAW del API (primeros 10)');
    console.table((datos.ofertas || []).slice(0,10).map(o => ({
      Proveedor: (o.Proveedor || o.proveedorNombre || '').slice(0,40),
      mesKey: o.mesKey || '',
      anio: o.anio || '',
      mes: o.mes || '',
      Mes_api: o.Mes || '',
      FechaBase: o.FechaBase || o.fecha || o.createdAt || ''
    })));
    DBGend();
  }

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
