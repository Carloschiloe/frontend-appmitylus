export function renderAcordeonLineas(idx, centros, editingLine) {
  const centro = centros[idx];
  if (!centro) return '';

  return `
    <tr class="acordeon-lineas-row">
      <td colspan="100" style="background:#fafafa; padding:0;">
        <div style="margin:0 auto; padding:16px 24px 24px 24px; width:100%; max-width:100%; min-width:0; box-sizing:border-box;">
          <h6 style="margin-bottom:18px;">Líneas de <b>${centro.name}</b></h6>
          
          <div style="margin-bottom: 16px;">
            <input id="inputBuscarLineas" type="text" placeholder="Buscar líneas por número" style="width:60%; padding:4px 8px; font-size:1rem;">
          </div>

          <table class="striped" style="width:100%;" id="tabla-lineas-centro-${idx}">
            <thead>
              <tr>
                <th>N° Línea</th>
                <th>Boyas</th>
                <th>Long. Línea</th>
                <th>Cabo Madre (mm)</th>
                <th>Estado</th>
                <th style="text-align:center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${(centro.lines || []).map((ln, i) => {
                // Si está editando esta línea
                if (editingLine.idx === idx && editingLine.lineIdx === i) {
                  return `
                    <tr>
                      <td><input type="text" value="${ln.number}" class="edit-line-num" style="width:80px"></td>
                      <td><input type="number" min="0" value="${ln.buoys}" class="edit-line-buoys" style="width:60px"></td>
                      <td><input type="number" min="0" value="${ln.longitud || ''}" class="edit-line-long" style="width:70px"></td>
                      <td><input type="text" value="${ln.cable}" class="edit-line-cable" style="width:90px"></td>
                      <td>
                        <select class="edit-line-state" style="width:90px">
                          <option value="Bueno" ${ln.state === 'Bueno' ? 'selected' : ''}>Bueno</option>
                          <option value="Regular" ${ln.state === 'Regular' ? 'selected' : ''}>Regular</option>
                          <option value="Malo" ${ln.state === 'Malo' ? 'selected' : ''}>Malo</option>
                        </select>
                      </td>
                      <td style="text-align:center;">
                        <i class="material-icons btn-guardar-edit-line" data-centro-idx="${idx}" data-line-idx="${i}" title="Guardar" style="cursor:pointer;color:green;">check</i>
                        <i class="material-icons btn-cancel-edit-line" title="Cancelar" style="cursor:pointer;color:gray;">close</i>
                      </td>
                    </tr>
                  `;
                } else {
                  // Fila normal
                  return `
                    <tr>
                      <td>${ln.number}</td>
                      <td>${ln.buoys}</td>
                      <td>${ln.longitud || ''}</td>
                      <td>${ln.cable}</td>
                      <td>${ln.state}</td>
                      <td style="text-align:center;">
                        <i class="material-icons btn-edit-line" data-centro-idx="${idx}" data-line-idx="${i}" title="Editar" style="cursor:pointer;color:#1976d2;">edit</i>
                        <i class="material-icons btn-del-line" data-centro-idx="${idx}" data-line-idx="${i}" title="Eliminar" style="cursor:pointer;color:#e53935;">delete</i>
                      </td>
                    </tr>
                  `;
                }
              }).join('')}
            </tbody>
          </table>

          <form class="form-inline-lineas" data-centro-idx="${idx}" style="margin-top:20px;">
            <div class="row" style="margin-bottom:0;">
              <div class="input-field col s2" style="margin-bottom:0;">
                <input type="text" placeholder="N° Línea" class="line-num">
              </div>
              <div class="input-field col s2" style="margin-bottom:0;">
                <input type="number" min="0" placeholder="Boyas" class="line-buoys">
              </div>
              <div class="input-field col s2" style="margin-bottom:0;">
                <input type="number" min="0" placeholder="Long. Línea" class="line-long">
              </div>
              <div class="input-field col s2" style="margin-bottom:0;">
                <input type="text" placeholder="Cabo Madre (mm)" class="line-cable">
              </div>
              <div class="input-field col s2" style="margin-bottom:0;">
                <select class="line-state">
                  <option value="" disabled selected>Estado</option>
                  <option value="Bueno">Bueno</option>
                  <option value="Regular">Regular</option>
                  <option value="Malo">Malo</option>
                </select>
              </div>
              <div class="input-field col s2 center" style="margin-bottom:0;">
                <button class="btn waves-effect green btn-add-line" type="submit"><i class="material-icons left">add</i>Agregar</button>
              </div>
            </div>
          </form>
        </div>
      </td>
    </tr>
  `;
}

