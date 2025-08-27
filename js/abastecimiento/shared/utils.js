// /js/abastecimiento/shared/utils.js
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => Array.from(document.querySelectorAll(s));


export const setVal = (sel, v) => { const el = $(sel); if (el) el.value = v ?? ''; };
export const getVal = (sel) => $(sel)?.value ?? '';


export const esc = (s = '') => String(s)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#039;');


export const pad2 = (n) => String(n).padStart(2, '0');
export const mesKeyFrom = (y, m) => `${y}-${pad2(m)}`;


export const trunc = (s = '', max = 42) => (String(s).length > max ? String(s).slice(0, max - 1) + '…' : String(s));


export const fmtISO = (d) => {
const x = new Date(d);
if (isNaN(x)) return '';
const y = x.getFullYear(), m = pad2(x.getMonth() + 1), dd = pad2(x.getDate());
return `${y}-${m}-${dd}`;
};


export const fmtCL = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });