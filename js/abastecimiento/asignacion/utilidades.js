// utilidades.js
export const MES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
export const fmt = (n) => (Number(n)||0).toLocaleString('es-CL',{maximumFractionDigits:2});
export const debounce = (fn,ms=120)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)};};

export function parseDateOrNull(d){
  if(!d && d!==0) return null;
  const s = (typeof d === 'string' && /^\d{4}-\d{2}$/.test(d)) ? (d+'-01') : d;
  const x = new Date(s);
  return (!Number.isNaN(x.getTime()) && x.getTime()!==0) ? x : null;
}
export function claveMes(d){
  const x=parseDateOrNull(d); if(!x) return 's/fecha';
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`;
}
export function etiquetaMes(k){
  if(!k||k==='s/fecha') return 's/FECHA';
  const [y,m]=k.split('-'); return `${MES[+m-1]} ${y}`;
}
export function claveSemana(d){
  const x=parseDateOrNull(d); if(!x) return 's/semana';
  const dt = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((dt - yearStart)/86400000)+1)/7);
  return `${dt.getUTCFullYear()}-${String(weekNo).padStart(2,'0')}`;
}
export function fechasDeSemanaISO(weekKey){
  const [y, w] = String(weekKey).split('-').map(x=>+x);
  const simple = new Date(Date.UTC(y,0,1 + (w-1)*7));
  const dow = simple.getUTCDay() || 7;
  const thu = new Date(simple); thu.setUTCDate(simple.getUTCDate() + 4 - dow);
  const mon = new Date(thu); mon.setUTCDate(thu.getUTCDate()-3);
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setUTCDate(mon.getUTCDate()+i);return d.toISOString().slice(0,10);});
}
export const aCamiones = (tons)=> (Number(tons)||0)/10;
export const aToneladas = (cam)=> (Number(cam)||0)*10;
export const groupBy = (arr, key) => { const m=new Map(); for(const r of arr){ const k=(typeof key==='function')?key(r):(r[key]??'(vacío)'); if(!m.has(k)) m.set(k,[]); m.get(k).push(r);} return m; };
export function altoDisponible(el){ const rect=el.getBoundingClientRect(); const vh=window.innerHeight||document.documentElement.clientHeight; return Math.max(260, Math.floor(vh - rect.top - 24)); }
