// estado.js
import { claveMes, claveSemana } from './utilidades.js';

const listeners = new Map();
export const datos = { ofertas: [], asignadoPorMes: new Map(), programaSemana: [], estadosDia: [] };

export function on(evt, fn){ if(!listeners.has(evt)) listeners.set(evt,new Set()); listeners.get(evt).add(fn); }
function emit(evt){ (listeners.get(evt)||[]).forEach(fn=>{ try{fn();}catch{} }); }

export function ofertasConClaves(){
  return datos.ofertas.map(r => ({ ...r, Mes: r.Mes || claveMes(r.FechaBase), Semana: r.Semana || claveSemana(r.FechaBase) }));
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
  const invPorTipo = totalesMesPorTipo(); const res = new Map();
  for(const [mes, asigTotal] of datos.asignadoPorMes.entries()){
    const invTotal = [...invPorTipo.entries()].filter(([k])=>k.startsWith(`${mes}|`)).reduce((s,[,v])=>s+v,0);
    if(invTotal<=0) continue;
    for(const [k, invT] of invPorTipo.entries()){
      if(!k.startsWith(`${mes}|`)) continue;
      res.set(k, (res.get(k)||0) + asigTotal * (invT/invTotal));
    }
  }
  return res;
}
export function filasEnriquecidas({tipo='ALL'}={}){
  const asigT = asignadoMesPorTipo();
  return ofertasConClaves().map(r=>{
    const t=(r.Tipo||'NORMAL').toUpperCase(); const tons=+r.Tons||0;
    const invMesTipo = (totalesMesPorTipo().get(`${r.Mes}|${t}`)||0);
    const asigMesTipo = (asigT.get(`${r.Mes}|${t}`)||0);
    const factor = invMesTipo>0 ? (tons/invMesTipo) : 0;
    const Asignado = (tipo==='ALL'||tipo===t) ? asigMesTipo*factor : 0;
    const Saldo = tons - Asignado;
    return {...r, Asignado, Saldo};
  }).filter(r => tipo==='ALL' ? true : (r.Tipo||'NORMAL').toUpperCase()===tipo);
}
export function saldoMes({mesKey, tipo='ALL'}){
  const invPorTipo = totalesMesPorTipo();
  const asigPorTipo = asignadoMesPorTipo();
  if(tipo==='ALL'){
    const inv=[...invPorTipo.entries()].filter(([k])=>k.startsWith(`${mesKey}|`)).reduce((s,[,v])=>s+v,0);
    const asig=datos.asignadoPorMes.get(mesKey)||0; return inv-asig;
  }else{
    const inv=invPorTipo.get(`${mesKey}|${tipo}`)||0; const asig=asigPorTipo.get(`${mesKey}|${tipo}`)||0; return inv-asig;
  }
}
export function esNoOperacion(dateISO){
  const f = datos.estadosDia.find(x=>x.date===dateISO);
  return f && (f.status==='NO_OP' || f.status==='HOLIDAY') ? f : null;
}

export async function cargarTodo(api){
  const [ofertas, asignMap] = await Promise.all([ api.getOfertas(), api.getAsignacionesMapa() ]);
  datos.ofertas = ofertas; datos.asignadoPorMes = asignMap; emit('actualizado');
}
export async function cargarProgramaSemana(api, weekKey, rangoFechas){
  const [entries, estados] = await Promise.all([ api.getProgramaSemana(weekKey), api.getEstadosDia(rangoFechas[0], rangoFechas.at(-1)) ]);
  datos.programaSemana = entries; datos.estadosDia = estados; emit('actualizado-programa');
}
export async function refrescar(api){ await cargarTodo(api); emit('actualizado'); }
