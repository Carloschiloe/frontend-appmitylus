// js/abastecimiento/asignacion/utilidades.js
export const MES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
export const fmt = (n)=> (Number(n)||0).toLocaleString('es-CL',{maximumFractionDigits:2});

export function parseDateOrNull(d){
  if(!d && d!==0) return null;
  const s = (typeof d === 'string' && /^\d{4}-\d{2}$/.test(d)) ? (d+'-01') : d;
  const x = new Date(s);
  return (!Number.isNaN(x.getTime()) && x.getTime()!==0) ? x : null;
}
export function monthKey(d){
  const x=parseDateOrNull(d); if(!x) return "s/fecha";
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`;
}
export function monthLabel(k){
  if(!k || k==="s/fecha") return "s/FECHA";
  const [y,m]=k.split('-');
  return `${MES[+m-1]} ${y}`;
}
export function isoWeekKey(d){
  const x=parseDateOrNull(d); if(!x) return "s/semana";
  const dt = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((dt - yearStart)/86400000)+1)/7);
  return `${dt.getUTCFullYear()}-${String(weekNo).padStart(2,'0')}`;
}

export function calcularAlturaDisponible(resta=260){
  const h = Math.max(400, window.innerHeight - resta);
  return `${h}px`;
}

export function prettyGroupLabel(field, value){
  if(value==null) return "(vacío)";
  if(field==="Mes")     return monthLabel(value);
  if(field==="Semana")  return `Sem ${value}`;
  return String(value);
}
