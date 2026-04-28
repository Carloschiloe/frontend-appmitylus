// storage.js — versión sin endpoints de líneas

// Base del backend (configurable en /js/config.js)
// Convención: `window.API_URL` apunta al prefijo `/api` (o a `https://host/api`)
// Ejemplos:
// - Dev con proxy Vite: "/api"
// - Producción: "https://backend.tu-dominio.cl/api"
const API_BASE_URL =
  (typeof window !== "undefined" && typeof window.API_URL === "string" && window.API_URL.trim()) ||
  "/api";

/* ===== Centros ===== */

// Obtener todos los centros
export async function getCentros() {
  const res = await fetch(`${API_BASE_URL}/centros`);
  if (!res.ok) throw new Error("Error al cargar los centros");
  return await res.json();
}

// Guardar un nuevo centro
export async function saveCentro(centro) {
  const res = await fetch(`${API_BASE_URL}/centros`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(centro),
  });
  if (!res.ok) throw new Error("Error al guardar el centro");
  return await res.json();
}

// Actualizar centro existente
export async function updateCentro(id, centro) {
  const res = await fetch(`${API_BASE_URL}/centros/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(centro),
  });
  if (!res.ok) throw new Error("Error al actualizar el centro");
  return await res.json();
}

// Eliminar centro
export async function deleteCentro(id) {
  const res = await fetch(`${API_BASE_URL}/centros/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Error al eliminar el centro");
  return await res.json();
}
