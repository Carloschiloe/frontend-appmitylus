// js/centros/lineas.js

export function renderAcordeonLineas(idxCentro, centros, editingLine) {
  const centro = centros[idxCentro];
  if (!centro || !Array.isArray(centro.lines)) return '<div>No hay líneas registradas.</div>';

  // Cabecera tabla acordeón
  let html = `
    <div style="margin-bottom:8px;">
      <b>Líneas de cultivo (${centro.lines.length})</b>
    </div>
    <table class="striped">
      <thead>
        <tr>
          <th>N° Línea</th>
          <th>Longitud (m)</th>
          <th>Cable</th>
          <th>Estado</th>
          <th>Toneladas</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;

  centro.lines.forEach((l, i) => {
    // Si está en edición, muestra inputs
    if (editingLine && editingLine.idx === idxCentro && editingLine.lineIdx === i) {
      html += `
        <tr>
          <td><input type="text" class="edit-line-num" value="${l.number || ''}" style="width:65px;"/></td>
          <td><input type="number" class="edit-line-long" value="${l.longitud || ''}" style="width:85px;"/></td>
          <td><input type="text" class="edit-line-cable" value="${l.cable || ''}" style="width:85px;"/></td>
          <td>
            <select class="edit-line-state">
              <option value="activa" ${l.state === 'activa' ? 'selected' : ''}>Activa</option>
              <option value="inactiva" ${l.state === 'inactiva' ? 'selected' : ''}>Inactiva</option>
            </select>
          </td>
          <td><input type="number" class="edit-line-tons" value="${l.tons || ''}" style="width:80px;"/></td>
          <td>
            <i class="material-icons btn-guardar-edit-line" data-line-idx="${i}" style="cursor:pointer;color:green;margin-right:6px;">check</i>
            <i class="material-icons btn-cancel-edit-line" data-line-idx="${i}" style="cursor:pointer;color:#666;">close</i>
          </td>
        </tr>
      `;
    } else {
      html += `
        <tr>
          <td>${l.number || '-'}</td>
          <td>${l.longitud || '-'}</td>
          <td>${l.cable || '-'}</td>
          <td>${l.state || '-'}</td>
          <td>${l.tons !== undefined ? l.tons : '-'}</td>
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
        <div class="input-field col s2"><input type="text"   class="line-cable"  placeholder="Cable" required></div>
        <div class="input-field col s2">
          <select class="line-state" required>
            <option value="" disabled selected>Estado</option>
            <option value="activa">Activa</option>
            <option value="inactiva">Inactiva</option>
          </select>
        </div>
        <div class="input-field col s2"><input type="number" class="line-tons"   placeholder="Toneladas" required></div>
        <div class="input-field col s2" style="margin-top:10px;">
          <button class="btn green" type="submit">Agregar</button>
        </div>
      </div>
    </form>
  `;

  return html;
}
