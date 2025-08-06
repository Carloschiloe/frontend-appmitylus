// js/centros/form_centros.js
import { clearMapPoints, redrawPolygon, addPointMarker } from '../mapas/control_mapa.js';

// Maneja la apertura del form para NUEVO centro
export async function openNewForm(els, map, currentPoints, setIdxCb) {
  els.formTitle.textContent = 'Nuevo centro';
  els.inputCentroId.value   = '';
  els.inputProveedor.value  = '';
  els.inputComuna.value     = '';
  els.inputCode.value       = '';
  els.inputHectareas.value  = '';
  els.inputLat.value        = '';
  els.inputLng.value        = '';

  currentPoints.length = 0;
  clearMapPoints();
  renderPointsTable(els.pointsBody, currentPoints);
  setIdxCb(null);
}

// Abre el form para editar un centro existente
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

  els.formTitle.textContent = `Editar centro: ${centro.proveedor || centro.codigo_centro || centro.comuna}`;
  els.inputCentroId.value   = idx;
  els.inputProveedor.value  = centro.proveedor || '';
  els.inputComuna.value     = centro.comuna || '';
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

  setTimeout(() => { els.inputProveedor.focus(); }, 100);
  if (currentPoints.length) map.fitBounds(currentPoints.map(p => [p.lat, p.lng]));
}

// Renderiza la tabla de puntos de coordenadas
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
