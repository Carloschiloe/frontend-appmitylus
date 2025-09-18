// /js/utils.js  (script clásico, sin "export")
(function (w) {
  'use strict';

  // ===== Helpers básicos =====
  const htmlMap = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => htmlMap[c]); }
  function pad2(n){ n = Number(n)||0; return (n<10?'0':'') + n; }
  function numeroCL(n){ return (Number(n)||0).toLocaleString('es-CL'); }

  // ===== Etiquetas / nombres cortos =====
  function cleanName(s){
    return String(s||'')
      .replace(/\b(Soc(?:iedad)?\.?|Comercial(?:izacion|ización)?|Transporte|Importaciones?|Exportaciones?|y|de|del|la|los)\b/gi,'')
      .replace(/\b(Ltda\.?|S\.A\.?|SpA|EIRL)\b/gi,'')
      .replace(/\s+/g,' ')
      .trim();
  }
  function initials2(s){
    s = cleanName(s);
    const p = s.split(/\s+/).filter(Boolean);
    const a = (p[0]||'').charAt(0);
    const b = (p[p.length-1]||'').charAt(0);
    return (a+b).toUpperCase();
  }
  function shortLabel(name){
    const s = cleanName(name);
    if (!s) return '—';
    const parts = s.split(/\s+/);
    const last = parts[parts.length-1] || s;
    if (last.length >= 5) return last;
    const ac = parts.slice(0,3).map(w=>w[0]||'').join('').toUpperCase();
    return (ac.length>=2 ? ac : last.toUpperCase());
  }

  // ===== Paleta consistente =====
  function _hash(str){
    let h = 2166136261>>>0; str = String(str||'');
    for (let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0; }
    return h>>>0;
  }
  const HUES = [210, 12, 140, 48, 280, 110, 330, 190, 24, 160, 300, 80];
  function paletteFor(key){
    const idx = _hash(key)%HUES.length;
    const h = HUES[idx];
    return {
      main:   `hsl(${h},75%,45%)`,
      border: `hsl(${h},70%,78%)`,
      bg:     `hsl(${h},90%,96%)`,
      faint:  `hsl(${h},85%,92%)`
    };
  }

  // ===== Fecha corta tipo 07.sept.25 =====
  const MESES_ABBR = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
  function fechaCorta(y, m1, d){
    const yy = String(y).slice(-2);
    const mon = MESES_ABBR[(m1-1)|0] || '';
    return pad2(d) + '.' + mon + '.' + yy;
  }

  // ===== parseOneDMS flexible (N/S/E/W al inicio o final) =====
  // Acepta: "S 41° 28' 30.5\"", "41°28'30.5\"S", "-41 28 30.5", "W 72°35'12\""
  function parseOneDMS(str){
    if (!str) return NaN;
    let s = String(str).trim().replace(/,/g,'.');

    const m = s.match(/^\s*([NnSsOoWwEe])?\s*([+-]?\d+(?:\.\d+)?)\s*[°º]?\s*(\d+(?:\.\d+)?)?\s*(?:['’´m]\s*)?(\d+(?:\.\d+)?)?\s*(?:["”s]\s*)?([NnSsOoWwEe])?\s*$/);
    if (!m) return NaN;

    const hemi = (m[1] || m[5] || '').toUpperCase();
    const deg  = parseFloat(m[2] || '0');
    const min  = parseFloat(m[3] || '0');
    const sec  = parseFloat(m[4] || '0');

    let dec = Math.abs(deg) + (min||0)/60 + (sec||0)/3600;

    // signo desde grados o hemisferio
    if (deg < 0) dec = -dec;
    if (hemi === 'S' || hemi === 'W' || hemi === 'O') dec = -Math.abs(dec);
    if (hemi === 'N' || hemi === 'E') dec =  Math.abs(dec);

    return dec;
  }

  // ===== Exponer API =====
  const utils = {
    escapeHtml, pad2, numeroCL,
    cleanName, initials2, shortLabel,
    paletteFor, fechaCorta,
    parseOneDMS
  };

  // Combina con utils previos si existen
  w.u = Object.assign({}, w.u || {}, utils);

  // Compatibilidad con código antiguo:
  w.parseOneDMS = parseOneDMS;

})(window);
