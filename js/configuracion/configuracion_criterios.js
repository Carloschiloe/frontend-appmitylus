let criterios = JSON.parse(localStorage.getItem('criteriosClasif') || '[]');
let editIdx = null;

export function renderCriteriosClasificacion() {
  const cont = document.getElementById('tab-criterios');
  if (!cont) return;

  cont.innerHTML = `
    <div class="right-align" style="margin-bottom: 16px;">
      <a id="btnAddCriterio" class="btn-floating btn-large teal" title="Agregar Criterio" aria-label="Agregar Criterio">
        <i class="material-icons">add</i>
      </a>
    </div>
    <h5>Criterios de Clasificación por Cliente</h5>
    <div class="row">
      <div class="col s12 m4">
        <input id="criteriosFilter" type="text" placeholder="Buscar..." />
      </div>
      <div class="col s12 m8 right-align">
        <button id="btnExportCriteriosExcel" class="btn-flat tooltipped" data-tooltip="Exportar a Excel"><i class="material-icons">grid_on</i></button>
        <button id="btnExportCriteriosPDF" class="btn-flat tooltipped" data-tooltip="Exportar a PDF"><i class="material-icons">picture_as_pdf</i></button>
        <button id="btnExportCriteriosCSV" class="btn-flat tooltipped" data-tooltip="Exportar CSV"><i class="material-icons">table_chart</i></button>
      </div>
    </div>
    <div style="position:relative;">
      <table id="criteriosTable" class="striped display responsive-table" style="width:100%" aria-describedby="tablaCriteriosDescripcion" role="grid" aria-live="polite">
        <caption id="tablaCriteriosDescripcion" class="sr-only">Tabla con criterios de clasificación</caption>
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
      <div id="modalCriterio" class="modal"></div>
    </div>
  `;

  document.getElementById('criteriosFilter').oninput = (e) => renderTable(e.target.value);
  document.getElementById("btnExportCriteriosExcel").onclick = exportExcel;
  document.getElementById("btnExportCriteriosPDF").onclick = exportPDF;
  document.getElementById("btnExportCriteriosCSV").onclick = exportCSV;
  document.getElementById("btnAddCriterio").onclick = () => openModal();

  renderTable();

  function renderTable(filtro = "") {
    const tbody = cont.querySelector("#criteriosTable tbody");
    let filtrados = criterios;
    if (filtro && filtro.length > 0) {
      const f = filtro.toLowerCase();
      filtrados = criterios.filter(c =>
        c.cliente?.toLowerCase().includes(f)
        || `${c.unKgMin}`.includes(f)
        || `${c.unKgMax}`.includes(f)
        || `${c.rechazoMin}`.includes(f)
        || `${c.rechazoMax}`.includes(f)
        || `${c.rdmtoMin}`.includes(f)
        || `${c.rdmtoMax}`.includes(f)
      );
    }
    tbody.innerHTML = filtrados.map((c, idx) => `
      <tr>
        <td>${c.cliente}</td>
        <td>${c.unKgMin}</td>
        <td>${c.unKgMax}</td>
        <td>${c.rechazoMin}</td>
        <td>${c.rechazoMax}</td>
        <td>${c.rdmtoMin}</td>
        <td>${c.rdmtoMax}</td>
        <td>
          <button class="btn-flat btn-small blue-text btn-edit" data-idx="${idx}" title="Editar"><i class="material-icons">edit</i></button>
          <button class="btn-flat btn-small red-text btn-del" data-idx="${idx}" title="Eliminar"><i class="material-icons">delete</i></button>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="8" class="center-align">Sin resultados</td></tr>`;

    tbody.querySelectorAll('.btn-del').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.idx;
        if (confirm("¿Seguro de eliminar este criterio?")) {
          criterios.splice(i, 1);
          guardar();
          renderTable(document.getElementById('criteriosFilter').value);
        }
      }
    });
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => {
        editIdx = +btn.dataset.idx;
        openModal(criterios[editIdx]);
      }
    });
  }

  function openModal(data = null) {
    const modal = document.getElementById('modalCriterio');
    modal.innerHTML = `
      <div class="modal-content" style="padding:1.5rem;">
        <h5 style="margin-bottom: 1rem;">${data ? "Editar" : "Agregar"} Criterio</h5>
        <form id="formCriterio">
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
            <button type="button" class="btn-flat grey lighten-2 modal-close" id="btnCancelarCriterio">Cancelar</button>
          </div>
        </form>
      </div>
      <div class="modal-bg"></div>
    `;
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add("show"), 25);

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
      closeModal();
      renderTable(document.getElementById('criteriosFilter').value);
    };

    document.getElementById("btnCancelarCriterio").onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); }
    document.onkeydown = (ev) => { if (ev.key === "Escape") closeModal(); };
  }

  function closeModal() {
    const modal = document.getElementById('modalCriterio');
    modal.classList.remove("show");
    setTimeout(() => { modal.style.display = "none"; modal.innerHTML = ""; }, 210);
    editIdx = null;
    document.onkeydown = null;
  }

  function guardar() {
    localStorage.setItem('criteriosClasif', JSON.stringify(criterios));
  }

  function exportCSV() {
    if (!criterios.length) return;
    const head = ["Cliente","Un/Kg min","Un/Kg max","% Rechazo min","% Rechazo max","% Rdmto min","% Rdmto max"];
    const rows = criterios.map(c =>
      [c.cliente,c.unKgMin,c.unKgMax,c.rechazoMin,c.rechazoMax,c.rdmtoMin,c.rdmtoMax]
    );
    const csv = [head, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    descargarArchivo(url, "criterios_clasificacion.csv");
  }
  function exportExcel() { exportCSV(); }
  function exportPDF() {
    let win = window.open('', '', 'width=900,height=650');
    win.document.write('<html><head><title>Exportar PDF</title></head><body>');
    win.document.write('<h3>Criterios de Clasificación por Cliente</h3>');
    win.document.write('<table border="1" cellpadding="6" style="border-collapse:collapse;">');
    win.document.write('<tr><th>Cliente</th><th>Un/Kg min</th><th>Un/Kg max</th><th>% Rechazo min</th><th>% Rechazo max</th><th>% Rdmto min</th><th>% Rdmto max</th></tr>');
    criterios.forEach(c => {
      win.document.write(`<tr><td>${c.cliente}</td><td>${c.unKgMin}</td><td>${c.unKgMax}</td><td>${c.rechazoMin}</td><td>${c.rechazoMax}</td><td>${c.rdmtoMin}</td><td>${c.rdmtoMax}</td></tr>`);
    });
    win.document.write('</table>');
    win.document.write('</body></html>');
    win.print();
    win.close();
  }
  function descargarArchivo(url, nombre) {
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 250);
  }
}
