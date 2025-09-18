// js/centros/lineas.js
import { mostrarValor } from './helpers_centros.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const toNum = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const fmt = {
  int: (v) => {
    const n = toNum(v);
    return n === null ? '—' : n.toLocaleString('es-CL', { maximumFractionDigits: 0 });
  },
  dec2: (v) => {
    const n = toNum(v);
    return n === null ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  pct1: (v) => {
    const n = toNum(v);
    return n === null ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }
};

function rowView(l, i) {
  return `
    <tr>
      <td>${esc(mostrarValor(l.number) || '—')}</td>
      <td>${fmt.dec2(l.longitud)}</td>
      <td>${esc(mostrarValor(l.observaciones) || '—')}</td>
      <td>${esc(mostrarValor(l.state) || '—')}</td>
      <td>${fmt.int(l.tons)}</td>
      <td>${fmt.dec2(l.unKg)}</td>
      <td>${fmt.pct1(l.porcRechazo)}</td>
      <td>${fmt.pct1(l.rendimiento)}</td>
      <td>
        <i class="material-icons btn-edit-line" data-line-idx="${i}" title="Editar" style="cursor:pointer;color:#ef6c00;margin-right:10px;">edit</i>
        <i class="material-icons btn-del-line"  data-line-idx="${i}" title="Eliminar" style="cursor:pointer;color:#e53935;">delete</i>
      </td>
    </tr>
  `;
}

function rowEdit(l, i) {
  return `
    <tr>
      <td><input type="text" class="edit-line-num" value="${esc(l.number ?? '')}" placeholder="N° línea" required /></td>
      <td><input type="number" class="edit-line-long" value="${l.longitud ?? ''}" step="0.01" min="0" placeholder="0.00" required /></td>
      <td><input type="text" class="edit-line-observaciones" value="${esc(l.observaciones ?? '')}" placeholder="Observaciones" /></td>
      <td>
        <select class="edit-line-state" required>
          <option value="activa"   ${l.state === 'activa'   ? 'selected' : ''}>Activa</option>
          <option value="inactiva" ${l.state === 'inactiva' ? 'selected' : ''}>Inactiva</option>
        </select>
      </td>
      <td><input type="number" class="edit-line-tons" value="${l.tons ?? ''}" step="1" min="0" placeholder="0" /></td>
      <td><input type="number" class="edit-line-unKg" value="${l.unKg ?? ''}" step="0.01" min="0" placeholder="0.00" /></td>
      <td><input type="number" class="edit-line-porcRechazo" value="${l.porcRechazo ?? ''}" step="0.1" min="0" max="100" placeholder="0.0" /></td>
      <td><input type="number" class="edit-line-rendimiento" value="${l.rendimiento ?? ''}" step="0.1" min="0" max="100" placeholder="0.0" /></td>
      <td>
        <i class="material-icons btn-guardar-edit-line" data-line-idx="${i}" title="Guardar" style="cursor:pointer;color:green;margin-right:6px;">check</i>
        <i class="material-icons btn-cancel-edit-line" data-line-idx="${i}" title="Cancelar" style="cursor:pointer;color:#666;">close</i>
      </td>
    </tr>
  `;
}

export function renderAcordeonLineas(idxCentro, centros, editingLine) {
  const centro = centros[idxCentro];
  if (!centro || !Array.isArray(centro.lines) || !centro.lines.length) {
    return '<div class="grey-text">No hay líneas registradas.</div>';
  }

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
    const isEditing = editingLine && editingLine.idx === idxCentro && editingLine.lineIdx === i;
    html += isEditing ? rowEdit(l, i) : rowView(l, i);
  });

  html += `
      </tbody>
    </table>

    <form class="form-inline-lineas" style="margin-top:14px;">
      <div class="row" style="margin-bottom:0;">
        <div class="input-field col s2">
          <input type="text" class="line-num" placeholder="N° Línea" required />
        </div>
        <div class="input-field col s2">
          <input type="number" class="line-long" placeholder="Longitud (m)" step="0.01" min="0" required />
        </div>
        <div class="input-field col s2">
          <input type="text" class="line-observaciones" placeholder="Observaciones" />
        </div>
        <div class="input-field col s2">
          <select class="line-state" required>
            <option value="" disabled selected>Estado</option>
            <option value="activa">Activa</option>
            <option value="inactiva">Inactiva</option>
          </select>
        </div>
        <div class="input-field col s1">
          <input type="number" class="line-tons" placeholder="Tons" step="1" min="0" />
        </div>
        <div class="input-field col s1">
          <input type="number" class="line-unKg" placeholder="Un/kg" step="0.01" min="0" />
        </div>
        <div class="input-field col s1">
          <input type="number" class="line-porcRechazo" placeholder="% Rechazo" step="0.1" min="0" max="100" />
        </div>
        <div class="input-field col s1">
          <input type="number" class="line-rendimiento" placeholder="Rdmto" step="0.1" min="0" max="100" />
        </div>
        <div class="input-field col s1" style="margin-top:10px;">
          <button class="btn green" type="submit">Agregar</button>
        </div>
      </div>
    </form>
  `;

  return html.trim();
}
