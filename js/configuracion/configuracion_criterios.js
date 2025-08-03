let criterios = JSON.parse(localStorage.getItem('criteriosClasif') || '[]');
let editIdx = null;

export function renderCriteriosClasificacion() {
  const cont = document.getElementById('criterios-clasificacion-content');
  if (!cont) return;

  // Renderiza controles, filtro, exportación y tabla
  cont.innerHTML = `
    <div class="config-table-wrapper">
      <div class="filter-group">
        <input id="criteriosFilter" class="config-filter" placeholder="Buscar...">
        <button class="btn-export" id="btnExportCriteriosExcel" title="Exportar a Excel">
          <i class="material-icons">grid_on</i>
        </button>
        <button class="btn-export pdf" id="btnExportCriteriosPDF" title="Exportar PDF">
          <i class="material-icons">picture_as_pdf</i>
        </button>
        <button class="btn-export csv" id="btnExportCriteriosCSV" title="Exportar CSV">
          <i class="material-icons">table_chart</i>
        </button>
        <button class="btn teal" id="btnAddCriterio" style="margin-left:auto;">
          <i class="material-icons left">add</i> Agregar
        </button>
      </div>
      <div style="width:100%;overflow-x:auto;">
      <table class="config-table" id="criteriosTable">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Un/Kg min</th>
            <th>Un/Kg max</th>
            <th>% Rechazo min</th>
            <th>% Rechazo max</th>
            <th>% Rdmto min</th>
            <th>% Rdmto max</th>
            <th class="actions-cell">Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      </div>
    </div>
    <div id="modalCriterio" class="config-modal-bg"></div>
  `;

  // Evento buscar (filtro global)
  document.getElementById('criteriosFilter').oninput = (e) => {
    renderTable(e.target.value);
  };

  // Exportar (Excel, PDF, CSV)
  document.getElementById("btnExportCriteriosExcel").onclick = exportExcel;
  document.getElementById("btnExportCriteriosPDF").onclick = exportPDF;
  document.getElementById("btnExportCriteriosCSV").onclick = exportCSV;

  // Botón agregar
  document.getElementById("btnAddCriterio").onclick = () => openModal();

  // Primera renderización de tabla
  renderTable();

  // -----------------------------------
  // FUNCIONES
  // -----------------------------------

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
        <td class="actions-cell">
          <i class="material-icons" title="Editar" data-idx="${idx}" style="color:#1976d2;cursor:pointer;">edit</i>
          <i class="material-icons" title="Eliminar" data-idx="${idx}" style="color:#e53935;cursor:pointer;">delete</i>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="8" class="center-align">Sin resultados</td></tr>`;

    // Acciones
    tbody.querySelectorAll('.material-icons[title="Eliminar"]').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.idx;
        if (confirm("¿Seguro de eliminar este criterio?")) {
          criterios.splice(i, 1);
          guardar();
          renderTable(document.getElementById('criteriosFilter').value);
        }
      }
    });
    tbody.querySelectorAll('.material-icons[title="Editar"]').forEach(btn => {
      btn.onclick = () => {
        editIdx = +btn.dataset.idx;
        openModal(criterios[editIdx]);
      }
    });
  }

  // MODAL FLOTANTE
  function openModal(data = null) {
    const modal = document.getElementById('modalCriterio');
    modal.innerHTML = `
      <div class="config-modal">
        <button class="close-modal" title="Cerrar">&times;</button>
        <div class="modal-title">${data ? "Editar" : "Agregar"} Criterio</div>
        <form id="formCriterio">
          <div class="input-group">
            <label for="m-cliente">Cliente</label>
            <input id="m-cliente" type="text" value="${data?.cliente || ""}" required />
          </div>
          <div class="input-group">
            <label for="m-unKgMin">Un/Kg mín.</label>
            <input id="m-unKgMin" type="number" min="0" value="${data?.unKgMin ?? ""}" required />
          </div>
          <div class="input-group">
            <label for="m-unKgMax">Un/Kg máx.</label>
            <input id="m-unKgMax" type="number" min="0" value="${data?.unKgMax ?? ""}" required />
          </div>
          <div class="input-group">
            <label for="m-rechazoMin">% Rechazo mín.</label>
            <input id="m-rechazoMin" type="number" min="0" max="100" value="${data?.rechazoMin ?? ""}" required />
          </div>
          <div class="input-group">
            <label for="m-rechazoMax">% Rechazo máx.</label>
            <input id="m-rechazoMax" type="number" min="0" max="100" value="${data?.rechazoMax ?? ""}" required />
          </div>
          <div class="input-group">
            <label for="m-rdmtoMin">% Rdmto mín.</label>
            <input id="m-rdmtoMin" type="number" min="0" max="100" value="${data?.rdmtoMin ?? ""}" required />
          </div>
          <div class="input-group">
            <label for="m-rdmtoMax">% Rdmto máx.</label>
            <input id="m-rdmtoMax" type="number" min="0" max="100" value="${data?.rdmtoMax ?? ""}" required />
          </div>
          <div class="modal-actions">
            <button type="submit" class="btn teal">${data ? "Actualizar" : "Agregar"}</button>
            <button type="button" class="btn-flat close-modal">Cancelar</button>
          </div>
        </form>
      </div>
    `;
    modal.classList.add('active');

    // Eventos cerrar
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.onclick = closeModal;
    });
    modal.onclick = e => { if (e.target === modal) closeModal(); }
    document.onkeydown = ev => { if (ev.key === "Escape") closeModal(); };

    // Submit
    document.getElementById("formCriterio").onsubmit = e => {
      e.preventDefault();
      // Validación
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
  }

  function closeModal() {
    const modal = document.getElementById('modalCriterio');
    modal.classList.remove('active');
    setTimeout(() => { modal.innerHTML = ""; }, 220);
    editIdx = null;
    document.onkeydown = null;
  }

  function guardar() {
    localStorage.setItem('criteriosClasif', JSON.stringify(criterios));
  }

  // Exportación CSV
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
  // Exportación Excel (XLSX): puede usar la misma función que CSV por simplicidad
  function exportExcel() { exportCSV(); }
  // Exportación PDF (simple)
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
