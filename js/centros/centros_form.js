import { clearMapPoints, redrawPolygon, addPointMarker } from '../mapas/control_mapa.js';

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

/**
 * openEditForm ahora recibe explícitamente el índice del centro
 * para evitar depender del valor del campo oculto inputCentroId.
 */
export async function openEditForm(els, map, currentPoints, setIdxCb, idx) {
  if (typeof idx !== 'number') {
    console.error('Falta índice centro en openEditForm');
    return;
  }

  const centros = await import('../core/centros_repo.js').then(m => m.getCentrosAll());
  const centro = centros[idx];
  if (!centro) {
    console.error('Centro no encontrado en openEditForm:', idx);
    return;
  }

  els.formTitle.textContent = `Editar centro: ${centro.name || centro.codigo_centro}`;
  els.inputCentroId.value   = idx; // Actualiza campo oculto
  els.inputName.value       = centro.name || '';
  els.inputProveedor.value  = centro.proveedor || '';  // SOLO proveedor
  els.inputCode.value       = centro.codigo_centro || centro.code || '';
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
