// utils.js
export function parseOneDMS(str) {
  const re = /^\s*([NSOWE])\s*(\d+)[°º]\s*(\d+)['’´]\s*(\d+(?:\.\d+)?)\s*$/i;
  const m = str.match(re);
  if (!m) return NaN;
  let hemi = m[1].toUpperCase(), deg=+m[2], min=+m[3], sec=+m[4];
  let dec = deg + min/60 + sec/3600;
  if (hemi==='S' || hemi==='W' || hemi==='O') dec = -dec;
  return dec;
}

/* ----------  NUEVO  ---------- */
if (typeof window !== 'undefined') window.parseOneDMS = parseOneDMS;