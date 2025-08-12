// /js/abastecimiento/planificacion/calc.js
import { isoWeekString, monthRange, diffDaysInclusive, daysInRange, inRange, fmtMonth, isoWeekRange, yearRange } from '/js/abastecimiento/planificacion/utils.js';

export const round2 = (n)=> Math.round((Number(n)||0) * 100) / 100;
export function sumTons(arr){ return round2(arr.reduce((x,b)=> x + (Number(b.tons)||0), 0)); }

// Agrupadores simples
export function agruparPorDia(rows){
  const map = new Map();
  rows.forEach(b => { if (b.fecha) map.set(b.fecha, (map.get(b.fecha)||0) + (Number(b.tons)||0)); });
  const fechas = Array.from(map.keys()).sort();
  const labels = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  return fechas.map(f => { const d = new Date(f); return { label: labels[d.getDay()], tons: round2(map.get(f)) }; });
}
export function agruparPorSemana(rows){
  const map = new Map();
  rows.forEach(b => { if (!b.fecha) return; const ws = isoWeekString(new Date(b.fecha)); map.set(ws, (map.get(ws)||0) + (Number(b.tons)||0)); });
  const keys = Array.from(map.keys()).sort();
  return keys.map(ws => ({ label: 'Sem ' + ws.split('-W')[1], tons: round2(map.get(ws)) }));
}
export function agruparPorMes(rows){
  const map = new Map();
  rows.forEach(b => { if (b.fecha) { const ym = b.fecha.slice(0,7); map.set(ym, (map.get(ym)||0) + (Number(b.tons)||0)); } });
  const mesesEs = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const keys = Array.from(map.keys()).sort();
  return keys.map(ym => { const [,m] = ym.split('-').map(Number); return { label: mesesEs[(m-1)%12], tons: round2(map.get(ym)) }; });
}

// RPA (requerida, programada, abastecida)
export function buildRPA(rows, rango, vista, { metaSemana, durDias }){
  const nonCancelled = rows.filter(b => b.estado !== 'Cancelado');
  const confirmed    = rows.filter(b => b.estado === 'Confirmado');

  if (vista === 'semana'){
    const byDayPlan = groupSumByDate(nonCancelled);
    const byDayReal = groupSumByDate(confirmed);
    const numDays = durDias || 7;
    const reqPerDay = metaSemana * (numDays/7) / numDays;
    const labels = daysInRange(rango.start, rango.end).map(d => d.label);
    const requerida  = daysInRange(rango.start, rango.end).map(() => round2(reqPerDay));
    const programada = daysInRange(rango.start, rango.end).map(d => round2(byDayPlan.get(d.iso) || 0));
    const abastecida = daysInRange(rango.start, rango.end).map(d => round2(byDayReal.get(d.iso) || 0));
    return { labels, requerida, programada, abastecida };
  }

  if (vista === 'mes'){
    const byWeekPlan = groupSumByWeek(nonCancelled);
    const byWeekReal = groupSumByWeek(confirmed);
    const weeks = Array.from(new Set([...byWeekPlan.keys(), ...byWeekReal.keys()])).sort();
    const labels = weeks.map(ws => 'Sem ' + ws.split('-W')[1]);
    const requerida  = weeks.map(()=> round2(metaSemana));
    const programada = weeks.map(ws => round2(byWeekPlan.get(ws) || 0));
    const abastecida = weeks.map(ws => round2(byWeekReal.get(ws) || 0));
    return { labels, requerida, programada, abastecida };
  }

  // año → por mes
  const byMonthPlan = groupSumByMonth(nonCancelled);
  const byMonthReal = groupSumByMonth(confirmed);
  const months = Array.from(new Set([...byMonthPlan.keys(), ...byMonthReal.keys()])).sort();
  const mesesEs = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const labels = months.map(ym => mesesEs[Number(ym.split('-')[1]) - 1]);
  const requerida  = months.map(ym => { const { start, end } = monthRange(ym); const nd = diffDaysInclusive(start, end); return round2(metaSemana * (nd/7)); });
  const programada = months.map(ym => round2(byMonthPlan.get(ym) || 0));
  const abastecida = months.map(ym => round2(byMonthReal.get(ym) || 0));
  return { labels, requerida, programada, abastecida };
}

// Mensual: resumen + datos para gantt
export function buildMensual(rows, rango, vista, metaSemana){
  if (vista !== 'mes') return { mensualResumen: [], mensualWeeks: [] };
  const planByWeek = groupSumByWeek(rows.filter(b => b.estado !== 'Cancelado'));
  const realByWeek = groupSumByWeek(rows.filter(b => b.estado === 'Confirmado'));
  const weeks = Array.from(new Set([...planByWeek.keys(), ...realByWeek.keys()])).sort();
  const mensualResumen = weeks.map(ws => { const plan = round2(planByWeek.get(ws) || 0); const real = round2(realByWeek.get(ws) || 0); const meta = round2(metaSemana); return { semana: 'Sem ' + ws.split('-W')[1], meta, plan, confirmado: real, gap: round2(Math.max(0, meta - real)) }; });
  const mensualWeeks = mensualResumen.map(r => ({ label: r.semana, meta: r.meta, plan: r.plan, real: r.confirmado }));
  return { mensualResumen, mensualWeeks };
}

// Agrupadores crudos
export function groupSumByDate(rows){ const m = new Map(); rows.forEach(b => { if (b.fecha) m.set(b.fecha, (m.get(b.fecha)||0) + (Number(b.tons)||0)); }); return m; }
export function groupSumByWeek(rows){ const m = new Map(); rows.forEach(b => { if (!b.fecha) return; const ws = isoWeekString(new Date(b.fecha)); m.set(ws, (m.get(ws)||0) + (Number(b.tons)||0)); }); return m; }
export function groupSumByMonth(rows){ const m = new Map(); rows.forEach(b => { if (b.fecha) { const ym = b.fecha.slice(0,7); m.set(ym, (m.get(ym)||0) + (Number(b.tons)||0)); } }); return m; }

// ViewModel para adelgazar controller
export function buildViewModel(state){
  const vista = state.filtros.vista || 'semana';
  const rango = (vista === 'semana') ? isoWeekRange(state.filtros.semana || isoWeekString(new Date()))
               : (vista === 'mes')   ? monthRange(state.filtros.mes || fmtMonth(new Date()))
                                     : yearRange(state.filtros.anio || String(new Date().getFullYear()));

  let rows = state.bloques.filter(b => {
    if (b.escenario && b.escenario !== state.filtros.escenario) return false;
    if (!rango) return true; return inRange(b.fecha, rango.start, rango.end);
  });
  if (state.filtros.soloConfirmado) rows = rows.filter(b => b.estado === 'Confirmado');
  if (state.filtros.ocultarCancelados) rows = rows.filter(b => b.estado !== 'Cancelado');
  const q = (state.filtros.texto || '').toLowerCase();
  if (q) rows = rows.filter(b => (b.proveedor||'').toLowerCase().includes(q) || (b.centro||'').toLowerCase().includes(q) || (b.notas||'').toLowerCase().includes(q));
  rows.sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||''));

  const metaSemana = Number(state.params.objetivo)||0;
  const durDias = rango ? diffDaysInclusive(rango.start, rango.end) : 7;
  const meta = Math.round(metaSemana * (durDias / 7));
  const plan = sumTons(state.bloques.filter(b => (!rango || inRange(b.fecha, rango.start, rango.end)) && (b.escenario === (state.filtros.escenario||'base')) && (b.estado !== 'Cancelado')));
  const confirmado = sumTons(state.bloques.filter(b => (!rango || inRange(b.fecha, rango.start, rango.end)) && (b.escenario === (state.filtros.escenario||'base')) && (b.estado === 'Confirmado')));
  const cumplimiento = meta ? Math.round(Math.min(100, (confirmado/meta)*100)) : 0;

  let dias = []; let labelDias = '';
  if (vista === 'semana') { dias = agruparPorDia(rows.filter(b => b.estado !== 'Cancelado')); labelDias = 'Tons por día (semana)'; }
  else if (vista === 'mes') { dias = agruparPorSemana(rows.filter(b => b.estado !== 'Cancelado')); labelDias = 'Tons por semana (mes)'; }
  else { dias = agruparPorMes(rows.filter(b => b.estado !== 'Cancelado')); labelDias = 'Tons por mes (año)'; }

  const estados = [
    { label:'Planificado', value: sumTons(rows.filter(b => b.estado==='Planificado')) },
    { label:'Confirmado',  value: sumTons(rows.filter(b => b.estado==='Confirmado')) },
    { label:'Cancelado',   value: sumTons(rows.filter(b => b.estado==='Cancelado')) },
  ];

  const semanal = rows.map(b => ({ _id:b._id, fecha:b.fecha, proveedor:b.proveedor, centro:b.centro||'', tons:Number(b.tons)||0, estado:b.estado, prioridad:b.prioridad||'', origen:b.origen||'Manual', notas:b.notas||'' }));
  const rpa = buildRPA(rows, rango, vista, { metaSemana, durDias });
  const rtItems = rows.filter(b => b.estado === 'Confirmado').sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||'')).slice(0,5).map(b => ({ fecha:b.fecha, proveedor:b.proveedor, tons:Number(b.tons)||0 }));
  const { mensualResumen, mensualWeeks } = buildMensual(rows, rango, vista, metaSemana);

  return {
    kpis: { meta, plan, confirmado, cumplimiento, requerida: meta, abastecida: confirmado },
    semanal,
    dias, estados, labelDias,
    rpa,
    rt: { required: meta, supplied: confirmado, items: rtItems },
    mensualResumen, mensualWeeks
  };
}