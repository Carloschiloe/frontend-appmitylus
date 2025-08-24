// storage.js

// URL base del backend en Railway (producción)
const API_BASE_URL = "https://backend-appmitylus-production.up.railway.app";

// Obtener todos los centros desde la API
export async function getCentros() {
  const res = await fetch(`${API_BASE_URL}/api/centros`);
  if (!res.ok) throw new Error("Error al cargar los centros");
  return await res.json();
}

// Guardar un nuevo centro
export async function saveCentro(centro) {
  const res = await fetch(`${API_BASE_URL}/api/centros`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(centro),
  });
  if (!res.ok) throw new Error("Error al guardar el centro");
  return await res.json();
}

// Actualizar centro existente
export async function updateCentro(id, centro) {
  const res = await fetch(`${API_BASE_URL}/api/centros/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(centro),
  });
  if (!res.ok) throw new Error("Error al actualizar el centro");
  return await res.json();
}

// Eliminar centro
export async function deleteCentro(id) {
  const res = await fetch(`${API_BASE_URL}/api/centros/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Error al eliminar el centro");
  return await res.json();
}

// Obtener líneas de un centro
export async function getLineas(centroId) {
  const res = await fetch(`${API_BASE_URL}/api/centros/${centroId}/lineas`);
  if (!res.ok) throw new Error("Error al cargar las líneas");
  return await res.json();
}

// Guardar una nueva línea
export async function saveLinea(centroId, linea) {
  const res = await fetch(`${API_BASE_URL}/api/centros/${centroId}/lineas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(linea),
  });
  if (!res.ok) throw new Error("Error al guardar la línea");
  return await res.json();
}

// Actualizar línea existente
export async function updateLinea(centroId, lineaId, linea) {
  const res = await fetch(`${API_BASE_URL}/api/centros/${centroId}/lineas/${lineaId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(linea),
  });
  if (!res.ok) throw new Error("Error al actualizar la línea");
  return await res.json();
}

// Eliminar línea
export async function deleteLinea(centroId, lineaId) {
  const res = await fetch(`${API_BASE_URL}/api/centros/${centroId}/lineas/${lineaId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Error al eliminar la línea");
  return await res.json();
}

