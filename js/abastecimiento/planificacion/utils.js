// /js/abastecimiento/planificacion/utils.js

export const $ = (sel)=> document.querySelector(sel);
export const $all = (sel)=> Array.from(document.querySelectorAll(sel));

export const val = (sel)=> ($(sel)?.value) ?? '';
export const setVal = (sel, v)=> { const el=$(sel); if (el) el.value = v ?? ''; };
export const num = (sel, def=0)=> { const n = Number(val(sel)); return Number.isFinite(n) ? n : def; };
export const number = (n)=> { const x = Number(n); return Number.isFinite(x) ? x : 0; };
export const escapeHtml = (s)=> String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m]));
export const clampAnio = (y)=> { let n = Number(String(y).replace(/\D/g,'')) || new Date().getFullYear(); if (n < 2020) n = 2020; if (n > 2027) n = 2027; return String(n); };

// Fechas y rangos
export function isoWeekString(d){ const dt = new Date(d); dt.setHours(0,0,0,0); dt.setDate(dt.getDate() + 4 - (dt.getDay() || 7)); const year = dt.getFullYear(); const start = new Date(year,0,1); const week = Math.ceil((((dt - start) / 86400000) + 1) / 7); return `${year}-W${String(week).padStart(2,'0')}`; }
export const yearFromWeekStr = (ws)=> Number(ws.split('-W')[0] || new Date().getFullYear());
export const weekStrToDate = (ws)=> { const { start } = isoWeekRange(ws); return new Date(start); };
export function isoWeekRange(weekStr){ const [y, w] = weekStr.split('-W'); const year = Number(y), week = Number(w); const simple = new Date(year, 0, 1 + (week - 1) * 7); const dayOfWeek = simple.getDay(); const ISOweekStart = new Date(simple); if (dayOfWeek <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1); else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay()); const ISOweekEnd = new Date(ISOweekStart); ISOweekEnd.setDate(ISOweekStart.getDate() + 6); return { start: fmtDate(ISOweekStart), end: fmtDate(ISOweekEnd) }; }
export function monthRange(yyyy_mm){ const [y,m] = (yyyy_mm||'').split('-').map(Number); const d1 = new Date(y, (m||1)-1, 1); const d2 = new Date(y, (m||1), 0); return { start: fmtDate(d1), end: fmtDate(d2) }; }
export function yearRange(yyyy){ const y = Number(yyyy)||new Date().getFullYear(); return { start: `${y}-01-01`, end: `${y}-12-31` }; }
export function fmtDate(d){ const f = new Date(d); const y=f.getFullYear(); const m=String(f.getMonth()+1).padStart(2,'0'); const dd=String(f.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
export function fmtMonth(d){ const f = new Date(d); return `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}`; }
export const inRange = (yyyy_mm_dd, start, end)=> yyyy_mm_dd >= start && yyyy_mm_dd <= end;
export function diffDaysInclusive(a,b){ const d1 = new Date(a+'T00:00:00'); const d2 = new Date(b+'T00:00:00'); return Math.floor((d2 - d1)/86400000) + 1; }
export function daysInRange(startISO, endISO){ const out=[]; const labels=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']; let d=new Date(startISO+'T00:00:00'); const end=new Date(endISO+'T00:00:00'); while(d<=end){ out.push({ iso: fmtDate(d), label: labels[d.getDay()] }); d.setDate(d.getDate()+1); } return out; }