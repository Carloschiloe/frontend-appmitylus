let criterios = JSON.parse(localStorage.getItem('criteriosClasif') || '[]');
let editIdx = null;
let modalInstancia = null;

// ===== RENDER PRINCIPAL
export function renderCriteriosClasificacion() {
  const cont = document.getElementById('criterios-clasificacion-content');
  if (!cont) return;

  cont.innerHTML = `
    <div class="row" style="margin-bottom:.7rem;">
      <div class="col s12 right-align">
        <a id="btnAddCriterio" class="btn-floating btn-large teal" title="Agregar Criterio"><i class="material-icons">add</i></a>
      </div>
    </div>
    <div style="margin-bottom: 20px;">
      <table id="criteriosTable" class="striped display responsive-table" style="width:100%" aria-describedby="tablaCriteriosDescripcion" role="grid">
        <caption id="tablaCriteriosDescripcion" class="sr-only" style="text-align:center;">Tabla con criterios de clasificación</caption>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Un/Kg min</th>
            <th>Un/Kg max</th>
            <th>% Rechazo min</th>
            <th>% Rechazo max</th>
            <th>% Rdmto min</th>
            <th>% Rdmto max</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <!-- Modal -->
    <div id="modalCriterio" class="modal"></div>
  `;

  renderTable();
  // BOTÓN AGREGAR
  document.getElementById("btnAddCriterio").onclick = () => openModal();

  // Inicializar DataTable al cargar y después de cada render
  function renderTable() {
    const tbody = cont.querySelector("#criteriosTable tbody");
    tbody.innerHTML = criterios.map((c, idx) => `
      <tr>
        <td>${c.cliente}</td>
        <td>${c.unKgMin}</td>
        <td>${c.unKgMax}</td>
        <td>${c.rechazoMin}</td>
        <td>${c.rechazoMax}</td>
        <td>${c.rdmtoMin}</td>
        <td>${c.rdmtoMax}</td>
        <td>
          <a class="btn-flat btn-small blue-text btn-edit" data-idx="${idx}" title="Editar"><i class="material-icons">edit</i></a>
          <a class="btn-flat btn-small red-text btn-del" data-idx="${idx}" title="Eliminar"><i class="material-icons">delete</i></a>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="8" class="center-align">Sin resultados</td></tr>`;

    // Destruye y reinicia el DataTable para que no duplique controles ni paginado
    if ($.fn.dataTable.isDataTable('#criteriosTable')) {
      $('#criteriosTable').DataTable().destroy();
    }
    $('#criteriosTable').DataTable({
      paging: false,
      searching: false,
      info: false,
      responsive: true,
      dom: 'Bfrtip',
      buttons: [
        { extend: 'copyHtml5', text: 'Copiar' },
        { extend: 'csvHtml5', text: 'CSV' },
        { extend: 'excelHtml5', text: 'Excel' },
        { extend: 'pdfHtml5', text: 'PDF' }
      ],
      language: {
        "emptyTable": "No hay criterios de clasificación"
      }
    });

    // Editar
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => {
        editIdx = +btn.dataset.idx;
        openModal(criterios[editIdx]);
      }
    });
    // Eliminar
    tbody.querySelectorAll('.btn-del').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.idx;
        if (confirm("¿Seguro de eliminar este criterio?")) {
          criterios.splice(i, 1);
          guardar();
          renderTable();
        }
      }
    });
  }

  // MODAL MATERIALIZE
  function openModal(data = null) {
    const modal = document.getElementById('modalCriterio');
    modal.innerHTML = `
      <div class="modal-content">
        <h5>${data ? "Editar" : "Agregar"} Criterio</h5>
        <form id="formCriterio" autocomplete="off">
          <div class="row">
            <div class="input-field col s12 m4">
              <input id="m-cliente" type="text" value="${data?.cliente || ""}" required />
              <label for="m-cliente" class="${data ? "active" : ""}">Cliente</label>
            </div>
            <div class="input-field col s6 m2">
              <input id="m-unKgMin" type="number" min="0" value="${data?.unKgMin ?? ""}" required />
              <label for="m-unKgMin" class="${data ? "active" : ""}">Un/Kg mín.</label>
            </div>
            <div class="input-field col s6 m2">
              <input id="m-unKgMax" type="number" min="0" value="${data?.unKgMax ?? ""}" required />
              <label for="m-unKgMax" class="${data ? "active" : ""}">Un/Kg máx.</label>
            </div>
            <div class="input-field col s6 m2">
              <input id="m-rechazoMin" type="number" min="0" max="100" value="${data?.rechazoMin ?? ""}" required />
              <label for="m-rechazoMin" class="${data ? "active" : ""}">% Rechazo mín.</label>
            </div>
            <div class="input-field col s6 m2">
              <input id="m-rechazoMax" type="number" min="0" max="100" value="${data?.rechazoMax ?? ""}" required />
              <label for="m-rechazoMax" class="${data ? "active" : ""}">% Rechazo máx.</label>
            </div>
            <div class="input-field col s6 m2">
              <input id="m-rdmtoMin" type="number" min="0" max="100" value="${data?.rdmtoMin ?? ""}" required />
              <label for="m-rdmtoMin" class="${data ? "active" : ""}">% Rdmto mín.</label>
            </div>
            <div class="input-field col s6 m2">
              <input id="m-rdmtoMax" type="number" min="0" max="100" value="${data?.rdmtoMax ?? ""}" required />
              <label for="m-rdmtoMax" class="${data ? "active" : ""}">% Rdmto máx.</label>
            </div>
          </div>
          <div class="center-align" style="margin-top: 1.1rem;">
            <button type="submit" class="btn teal" style="margin-right:8px;"><i class="material-icons left">save</i>${data ? "Actualizar" : "Agregar"}</button>
            <button type="button" class="btn-flat modal-close" id="btnCancelarCriterio">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    // Inicia y abre el modal (Materialize)
    const instance = M.Modal.init(modal, {
      dismissible: true,
      onCloseEnd: () => {
        modal.innerHTML = ""; // Limpia al cerrar
        editIdx = null;
      }
    });
    instance.open();
    modalInstancia = instance;

    // Evento cancelar
    document.getElementById("btnCancelarCriterio").onclick = () => instance.close();

    // Submit
    document.getElementById("formCriterio").onsubmit = (e) => {
      e.preventDefault();
      const cliente = document.getElementById("m-cliente").value.trim();
      const unKgMin = +document.getElementById("m-unKgMin").value;
      const unKgMax = +document.getElementById("m-unKgMax").value;
      const rechazoMin = +document.getElementById("m-rechazoMin").value;
      const rechazoMax = +document.getElementById("m-rechazoMax").value;
      const rdmtoMin = +document.getElementById("m-rdmtoMin").value;
      const rdmtoMax = +document.getElementById("m-rdmtoMax").value;

      if (!cliente) return M.toast({ html: 'Cliente requerido' });
      if (isNaN(unKgMin) || isNaN(unKgMax) || isNaN(rechazoMin) || isNaN(rechazoMax) || isNaN(rdmtoMin) || isNaN(rdmtoMax))
        return M.toast({ html: 'Campos numéricos inválidos' });
      if (unKgMax < unKgMin || rechazoMax < rechazoMin || rdmtoMax < rdmtoMin)
        return M.toast({ html: 'Máximos no pueden ser menores al mínimo' });

      const obj = { cliente, unKgMin, unKgMax, rechazoMin, rechazoMax, rdmtoMin, rdmtoMax };
      if (data && editIdx !== null) {
        criterios[editIdx] = obj;
      } else {
        criterios.push(obj);
      }
      guardar();
      instance.close();
      setTimeout(renderTable, 200);
    };
  }

  function guardar() {
    localStorage.setItem('criteriosClasif', JSON.stringify(criterios));
  }
}
