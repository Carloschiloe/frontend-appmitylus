// almacenamiento.js

const BASE_URL = 'https://backend-appmitylus-production.up.railway.app/api/centros';

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
    return await resp.json();
  } catch (e) {
    console.error('Error al eliminar centro:', e);
    return null;
  }
}
