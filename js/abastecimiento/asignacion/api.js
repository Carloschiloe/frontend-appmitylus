// js/abastecimiento/asignacion/api.js
export const API_BASE = "https://backend-appmitylus.vercel.app/api";

async function _check(r){
  if(!r.ok){
    const t = await r.text().catch(()=> "");
    throw new Error(`HTTP ${r.status} - ${t}`);
  }
  return r.status===204 ? null : await r.json().catch(()=> null);
}

export async function apiGet(path){
  return _check(await fetch(API_BASE + path));
}

export async function apiPost(path, body){
  return _check(await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }));
}

export const endpoints = {
  ofertas: "/planificacion/ofertas",
  asignacionesMap: "/asignaciones/map",
  asignaciones: "/asignaciones",
  // futuros: programa semanal / no-op / etc.
};
