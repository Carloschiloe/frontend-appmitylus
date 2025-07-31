import { getCentrosAll } from '../core/centros_repo.js';
import { clearMapPoints, redrawPolygon, addPointMarker } from '../mapas/control_mapa.js';
import { parseOneDMS } from '../core/utilidades.js';

// NUEVO: Solo maneja campo proveedor
export async function openNewForm(els, map, currentPoints, setIdxCb) {
  els.formTitle.textContent = 'Nuevo centro';
  els.inputCentroId.value   = '';
  els.inputName.value       = '';
  els.inputProveedor.value  = '';  // SOLO proveedor
  els.inputCode.value       = '';
  els.inputHectareas.value  = '';
  els.inputLat.value        = '';
  els.inputLng.value        = '';

  currentPoints.length = 0;
  clearMapPoints();
  renderPointsTable(els.pointsBody, currentPoints);
  setIdxCb(null);
}

export async function openEditForm(els, map, currentPoints, setIdxCb) {
  const centros = await getCentrosAll();
  // El idx se obtiene del Estado (o pásalo explícito si prefieres)
  const idx = +els.inputCentroId.value || 0;
  const centro = centros[idx];
  if (!centro) return;

  els.formTitle.textContent = `Editar centro: ${centro.name}`;
  els.inputName.value       = centro.name || '';
  els.inputProveedor.value  = centro.proveedor || '';  // SOLO proveedor
  els.inputCode.value       = centro.code || '';
  els.inputHectareas.value  = centro.hectareas || '';

  currentPoints.length = 0;
  if (Array.isArray(centro.coords)) {
    centro.coords.forEach(p => currentPoints.push({ lat: +p.lat, lng: +p.lng }));
  }
  clearMapPoints();
  currentPoints.forEach(p => addPointMarker(p.lat, p.lng));
  redrawPolygon(currentPoints);
  renderPointsTable(els.pointsBody, currentPoints);

  setTimeout(() => { els.inputName.focus(); }, 100);
  if (currentPoints.length) map.fitBounds(currentPoints.map(p => [p.lat, p.lng]));
}

export function renderPointsTable(pointsBody, currentPoints) {
  pointsBody.innerHTML = currentPoints.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.lat.toFixed(6)}</td>
      <td>${p.lng.toFixed(6)}</td>
      <td><button class="btn-small red btn-del-point" data-idx="${i}">&times;</button></td>
    </tr>
  `).join('');
}
