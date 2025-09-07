// almacenamiento.js — versión alineada a Vercel y tolerante a window.API_URL

// Base API: toma window.API_URL si existe; si no, usa Vercel por defecto
const API_BASE =
  (typeof window !== 'undefined' && window.API_URL)
    ? `${window.API_URL}`
    : 'https://backend-appmitylus.vercel.app/api';

// Endpoint de centros
const BASE_URL = `${API_BASE}/centros`;

// Obtener todos los centros (GET)
export async function getCentros() {
  try {
    const resp = await fetch(BASE_URL);
    if (!resp.ok) return [];
    return await resp.json();
  } catch (e) {
    console.error('Error al obtener centros:', e);
    return [];
  }
}

// Guardar o crear un centro (POST)
export async function saveCentro(centro) {
  try {
    const resp = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(centro)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.error('Error al guardar centro:', e);
    return null;
  }
}

// Actualizar un centro existente (PUT)
export async function updateCentro(id, centro) {
  try {
    const resp = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(centro)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.error('Error al actualizar centro:', e);
    return null;
  }
}

// Eliminar un centro (DELETE)
export async function deleteCentro(id) {
  try {
    const resp = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.error('Error al eliminar centro:', e);
    return null;
  }
}

