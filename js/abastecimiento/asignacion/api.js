// js/abastecimiento/asignacion/api.js
export const API_URL = "https://backend-appmitylus.vercel.app/api";

// Puedes sobreescribir este endpoint desde window.INV_ASIG_ENDPOINT si lo defines en el HTML
export const INV_ASIG_ENDPOINT = (window.INV_ASIG_ENDPOINT || "/asignaciones/map");

async function checkResponse(resp){
  if(!resp.ok){
    const text = await resp.text().catch(()=> "");
    throw new Error(`HTTP ${resp.status} - ${text}`);
  }
  if(resp.status === 204) return null;
  try { return await resp.json(); } catch { return null; }
}

export async function apiGet(path){
  const r = await fetch(`${API_URL}${path}`);
  return checkResponse(r);
}
export async function apiPost(path, body){
  const r = await fetch(`${API_URL}${path}`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify(body||{})
  });
  return checkResponse(r);
}
