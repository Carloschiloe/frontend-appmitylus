// js/centros/helpers_centros.js
/**
 * KPIs desde una lista (ya filtrada).
 * - kpiCentros: cantidad de centros
 * - kpiHect: suma de hectáreas
 * - kpiComunas: comunas únicas
 */
export function refreshKpisFrom(lista){
  const centros = Array.isArray(lista) ? lista : [];
  let sumH = 0;
  const comunas = new Set();
  for (const c of centros){
    const h = Number.parseFloat(c?.hectareas);
    if (Number.isFinite(h)) sumH += h;
    if (c?.comuna) comunas.add((c.comuna||'').toLowerCase());
  }
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('kpiCentros', String(centros.length));
  setText('kpiHect',    sumH.toFixed(2));
  setText('kpiComunas', String(comunas.size));

  // footer de la tabla (si existe)
  const fH = document.getElementById('totalHect');
  const fC = document.getElementById('totalCentros');
  if (fH) fH.textContent = sumH.toFixed(2);
  if (fC) fC.textContent = String(centros.length);
}
