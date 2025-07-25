const API_URL = 'http://localhost:3001/api/insumos'; // Cambia al URL de tu backend

export async function apiGetMovimientos() {
  const resp = await fetch(API_URL);
  if (!resp.ok) throw new Error('Error al obtener movimientos');
  return resp.json();
}

export async function apiCreateMovimiento(data) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!resp.ok) throw new Error('Error al crear movimiento');
  return resp.json();
}

export async function apiUpdateMovimiento(id, data) {
  const resp = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!resp.ok) throw new Error('Error al actualizar movimiento');
  return resp.json();
}

export async function apiDeleteMovimiento(id) {
  const resp = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error('Error al eliminar movimiento');
  return resp.json();
}
