// js/abastecimiento/asignacion/api.js
export const API_URL = "https://backend-appmitylus.vercel.app/api";
export const INV_ASIG_ENDPOINT = "/asignaciones/map";

async function _checkResponse(resp) {
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status} - ${t}`);
  }
  if (resp.status === 204) return null;
  return await resp.json().catch(() => null);
}

export async function apiGet(path) {
  const r = await fetch(`${API_URL}${path}`);
  return _checkResponse(r);
}
export async function apiPost(path, body) {
  const r = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  return _checkResponse(r);
}


