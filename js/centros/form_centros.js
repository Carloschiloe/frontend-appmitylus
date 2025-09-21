// js/centros/form_centros.js — versión limpia (sin líneas)
import { Estado } from '../core/estado.js';
import { clearMapPoints, redrawPolygon, addPointMarker } from '../mapas/control_mapa.js';

// Abre el form para NUEVO centro
export function openNewForm(els, map, currentPoints, setIdxCb) {
  els.formTitle.textContent = 'Nuevo centro';
  els.inputCentroId.value   = '';
  els.inputProveedor.value  = '';
  els.inputComuna.value     = '';
  els.inputCode.value       = '';
  els.inputHectareas.value  = '';
  els.inputLat.value        = '';
  els.inputLng.value        = '';

  // Materialize labels
  window.M?.updateTextFields?.();

  // Reset puntos
  currentPoints.length = 0;
  clearMapPoints();
  renderPointsTable(els.pointsBody, currentPoints);

  // Notifica: no hay centro seleccionado
  setIdxCb(null);
}

// Abre el form para EDITAR un centro existente (usa Estado.centros)
export function openEditForm(els, map, currentPoints, setIdxCb, idx) {
  if (typeof idx !== 'number') {
    console.error('Falta índice centro en openEditForm');
    return;
  }

  const c = Estado.centros?.[idx];
  if (!c) {
    console.error('Centro no encontrado en openEditForm:', idx);
    return;
  }

  els.formTitle.textContent = `Editar centro: ${c.proveedor || c.code || c.comuna || '-'}`;
  els.inputCentroId.value   = idx; // seguimos usando el índice como referencia
  els.inputProveedor.value  = c.proveedor || '';
  els.inputComuna.value     = c.comuna   || '';
  // compat: algunos registros antiguos traían "codigo_centro"
  els.inputCode.value       = c.code || c.codigo_centro || '';
  els.inputHectareas.value  = (c.hectareas ?? '') === null ? '' : c.hectareas;

  // Materialize labels
  window.M?.updateTextFields?.();

  // Cargar puntos actuales
  currentPoints.length = 0;
  if (Array.isArray(c.coords)) {
    c.coords.forEach(p => {
      const lat = Number(p?.lat);
      const lng = Number(p?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) currentPoints.push({ lat, lng });
    });
  }

  // Redibujar en mapa + tabla
  clearMapPoints();
  currentPoints.forEach(p => addPointMarker(p.lat, p.lng));
  redrawPolygon(currentPoints);
  renderPointsTable(els.pointsBody, currentPoints);

  // Focus inicial
  setTimeout(() => els.inputProveedor?.focus?.(), 100);

  // Ajusta mapa si hay puntos
  if (map && currentPoints.length) {
    try {
      if (currentPoints.length > 1) {
        map.fitBounds(currentPoints.map(p => [p.lat, p.lng]), { padding: [20, 20] });
      } else {
        map.setView([currentPoints[0].lat, currentPoints[0].lng], 13);
      }
    } catch (e) {
      console.warn('fitBounds/setView falló:', e);
    }
  }

  // Informa idx seleccionado
  setIdxCb(idx);
}

// Renderiza la tabla de puntos (con eliminar punto)
export function renderPointsTable(pointsBody, currentPoints) {
  if (!pointsBody) return;

  const rowsHtml = currentPoints.map((p, i) => {
    const latStr = Number.isFinite(p.lat) ? p.lat.toFixed(6) : (p.lat ?? '');
    const lngStr = Number.isFinite(p.lng) ? p.lng.toFixed(6) : (p.lng ?? '');
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${latStr}</td>
        <td>${lngStr}</td>
        <td>
          <button
            class="btn-small red btn-del-point"
            data-idx="${i}"
            aria-label="Eliminar punto ${i + 1}"
            type="button"
          >&times;</button>
        </td>
      </tr>
    `;
  }).join('');

  pointsBody.innerHTML = rowsHtml || `
    <tr><td colspan="4" class="grey-text">Sin puntos ingresados</td></tr>
  `;

  // Listeners para eliminar punto
  pointsBody.querySelectorAll('.btn-del-point').forEach(btn => {
    btn.onclick = () => {
      const i = Number(btn.dataset.idx);
      if (!Number.isInteger(i)) return;

      // Elimina del arreglo
      currentPoints.splice(i, 1);

      // Redibuja mapa y tabla
      clearMapPoints();
      currentPoints.forEach(p => addPointMarker(p.lat, p.lng));
      redrawPolygon(currentPoints);
      renderPointsTable(pointsBody, currentPoints);
    };
  });
}
