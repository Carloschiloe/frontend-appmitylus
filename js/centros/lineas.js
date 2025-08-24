// js/centros/lineas.js
import { mostrarValor } from './helpers_centros.js';

export function renderAcordeonLineas(idxCentro, centros, editingLine) {
  const centro = centros[idxCentro];
  if (!centro || !Array.isArray(centro.lines)) return '<div>No hay líneas registradas.</div>';

  let html = `
    <div style="margin-bottom:8px;">
      <b>Líneas de cultivo (${centro.lines.length})</b>
    </div>
    <table class="striped child-table-lineas">
      <thead>
        <tr>
          <th>N° Línea</th>
          <th>Long (m)</th>
          <th>Observaciones</th>
          <th>Estado</th>
          <th>Tons</th>
          <th>Un/kg</th>
          <th>% Rechazo</th>
          <th>Rdmto</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;

  centro.lines.forEach((l, i) => {
    if (editingLine && editingLine.idx === idxCentro && editingLine.lineIdx === i) {
      html += `
        <tr>
          <td><input type="text" class="edit-line-num" value="${l.number || ''}" /></td>
          <td><input type="number" class="edit-line-long" value="${l.longitud || ''}" /></td>
          <td><input type="text" class="edit-line-observaciones" value="${l.observaciones || ''}" /></td>
          <td>
            <select class="edit-line-state">
              <option value="activa" ${l.state === 'activa' ? 'selected' : ''}>Activa</option>
              <option value="inactiva" ${l.state === 'inactiva' ? 'selected' : ''}>Inactiva</option>
            </select>
          </td>
          <td><input type="number" class="edit-line-tons" value="${l.tons ?? ''}" /></td>
          <td><input type="number" step="any" class="edit-line-unKg" value="${l.unKg ?? ''}" /></td>
          <td><input type="number" step="any" class="edit-line-porcRechazo" value="${l.porcRechazo ?? ''}" /></td>
          <td><input type="number" step="any" class="edit-line-rendimiento" value="${l.rendimiento ?? ''}" /></td>
          <td>
            <i class="material-icons btn-guardar-edit-line" data-line-idx="${i}" style="cursor:pointer;color:green;margin-right:6px;">check</i>
            <i class="material-icons btn-cancel-edit-line" data-line-idx="${i}" style="cursor:pointer;color:#666;">close</i>
          </td>
        </tr>
      `;
    } else {
      html += `
        <tr>
          <td>${mostrarValor(l.number) || '-'}</td>
          <td>${mostrarValor(l.longitud) || '-'}</td>
          <td>${mostrarValor(l.observaciones) || '-'}</td>
          <td>${mostrarValor(l.state) || '-'}</td>
          <td>${mostrarValor(l.tons)}</td>
          <td>${mostrarValor(l.unKg)}</td>
          <td>${mostrarValor(l.porcRechazo)}</td>
          <td>${mostrarValor(l.rendimiento)}</td>
          <td>
            <i class="material-icons btn-edit-line" data-line-idx="${i}" style="cursor:pointer;color:#ef6c00;margin-right:10px;">edit</i>
            <i class="material-icons btn-del-line" data-line-idx="${i}" style="cursor:pointer;color:#e53935;">delete</i>
          </td>
        </tr>
      `;
    }
  });

  html += `
      </tbody>
    </table>
    <form class="form-inline-lineas" style="margin-top:14px;">
      <div class="row" style="margin-bottom:0;">
        <div class="input-field col s2"><input type="text"   class="line-num"    placeholder="N° Línea" required></div>
        <div class="input-field col s2"><input type="number" class="line-long"   placeholder="Longitud" required></div>
        <div class="input-field col s2"><input type="text"   class="line-observaciones"  placeholder="Observaciones"></div>
        <div class="input-field col s2">
          <select class="line-state" required>
            <option value="" disabled selected>Estado</option>
            <option value="activa">Activa</option>
            <option value="inactiva">Inactiva</option>
          </select>
        </div>
        <div class="input-field col s1"><input type="number" class="line-tons"   placeholder="Tons"></div>
        <div class="input-field col s1"><input type="number" step="any" class="line-unKg" placeholder="Un/kg"></div>
        <div class="input-field col s1"><input type="number" step="any" class="line-porcRechazo" placeholder="% Rechazo"></div>
        <div class="input-field col s1"><input type="number" step="any" class="line-rendimiento" placeholder="Rdmto"></div>
        <div class="input-field col s1" style="margin-top:10px;">
          <button class="btn green" type="submit">Agregar</button>
        </div>
      </div>
    </form>
  `;

  return html;
}
