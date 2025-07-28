// js/tareas/mantencion_lineas.js
import { getCentros, updateCentro } from '../core/almacenamiento.js';

let centros = [];
let tareasData = []; // [{centroId, lineaIdx, tarea}, ...]

async function cargarCentros() {
  centros = await getCentros();
}

function renderSelectorCentroLinea() {
  const centrosSelect = document.createElement('select');
  centrosSelect.id = 'selectCentroMant';
  centrosSelect.innerHTML = `<option value="">Selecciona un centro</option>` +
    centros.map((c, i) => `<option value="${i}">${c.name}</option>`).join('');
  centrosSelect.className = "browser-default";

  const lineaSelect = document.createElement('select');
  lineaSelect.id = 'selectLineaMant';
  lineaSelect.className = "browser-default";
  lineaSelect.innerHTML = `<option value="">Selecciona línea</option>`;
  lineaSelect.disabled = true;

  centrosSelect.onchange = () => {
    const idx = centrosSelect.value;
    if (idx === "") {
      lineaSelect.disabled = true;
      lineaSelect.innerHTML = `<option value="">Selecciona línea</option>`;
      return;
    }
    lineaSelect.disabled = false;
    const lines = centros[idx].lines || [];
    lineaSelect.innerHTML = `<option value="">Selecciona línea</option>` +
      lines.map((l, li) => `<option value="${li}">Línea ${l.number}</option>`).join('');
  };

  return { centrosSelect, lineaSelect };
}

function renderFormularioMantencion() {
  const div = document.createElement('div');
  div.className = 'card-panel';

  const { centrosSelect, lineaSelect } = renderSelectorCentroLinea();

  div.innerHTML = `
    <h6>Asignar Nueva Mantención</h6>
    <form id="formNuevaMantencion">
      <div class="row">
        <div class="input-field col s6" id="selectCentroCont"></div>
        <div class="input-field col s6" id="selectLineaCont"></div>
      </div>
      <div class="row">
        <div class="input-field col s6">
          <input id="tituloMant" type="text" required>
          <label for="tituloMant">Tarea / Mantención</label>
        </div>
        <div class="input-field col s6">
          <input id="fechaMant" type="date" required>
          <label for="fechaMant" class="active">Fecha Programada</label>
        </div>
      </div>
      <div class="row">
        <div class="input-field col s6">
          <select id="estadoMant" class="browser-default" required>
            <option value="Pendiente" selected>Pendiente</option>
            <option value="En curso">En curso</option>
            <option value="Completada">Completada</option>
          </select>
          <label for="estadoMant">Estado</label>
        </div>
        <div class="input-field col s6">
          <input id="descMant" type="text">
          <label for="descMant">Descripción</label>
        </div>
      </div>
      <div class="center-btn">
        <button type="submit" class="btn green">
          <i class="material-icons left">add</i>Agregar
        </button>
      </div>
    </form>
  `;

  // Insertar selects en el formulario
  div.querySelector('#selectCentroCont').appendChild(centrosSelect);
  div.querySelector('#selectLineaCont').appendChild(lineaSelect);

  // Handler para enviar el formulario
  div.querySelector('#formNuevaMantencion').onsubmit = async (e) => {
    e.preventDefault();
    const centroIdx = centrosSelect.value;
    const lineaIdx = lineaSelect.value;
    const titulo = div.querySelector('#tituloMant').value.trim();
    const fecha = div.querySelector('#fechaMant').value;
    const estado = div.querySelector('#estadoMant').value;
    const descripcion = div.querySelector('#descMant').value.trim();

    if (centroIdx === "" || lineaIdx === "") {
      M.toast({ html: "Debes seleccionar un centro y una línea", classes: 'red' });
      return;
    }
    if (!titulo || !fecha || !estado) {
      M.toast({ html: "Completa todos los campos", classes: 'red' });
      return;
    }
    // Agregar mantención
    let centro = centros[centroIdx];
    let linea = centro.lines[lineaIdx];
    if (!linea.tareas) linea.tareas = [];
    linea.tareas.push({ titulo, fecha, estado, descripcion });

    await updateCentro(centro._id, centro);
    await cargarCentros();
    M.toast({ html: "Mantención agregada", classes: 'green' });
    renderTablaMantenciones();
    e.target.reset();
    lineaSelect.disabled = true;
    lineaSelect.innerHTML = `<option value="">Selecciona línea</option>`;
  };

  return div;
}

function renderTablaMantenciones() {
  const tablaDiv = document.getElementById('tablaMantenciones');
  if (!tablaDiv) return;

  // Listado plano de todas las tareas de todas las líneas
  let html = `
    <table class="striped highlight">
      <thead>
        <tr>
          <th>Centro</th>
          <th>N° Línea</th>
          <th>Tarea</th>
          <th>Fecha</th>
          <th>Estado</th>
          <th>Descripción</th>
        </tr>
      </thead>
      <tbody>
  `;
  centros.forEach((centro) => {
    (centro.lines || []).forEach((linea) => {
      (linea.tareas || []).forEach((tarea) => {
        html += `
          <tr>
            <td>${centro.name}</td>
            <td>${linea.number}</td>
            <td>${tarea.titulo}</td>
            <td>${tarea.fecha}</td>
            <td>${tarea.estado}</td>
            <td>${tarea.descripcion || ''}</td>
          </tr>
        `;
      });
    });
  });
  html += '</tbody></table>';
  tablaDiv.innerHTML = html;
}

// ------- Inicialización principal -------
window.inicializarTareasMantenciones = async function() {
  await cargarCentros();

  // Render form solo una vez (si lo necesitas siempre visible)
  const formCont = document.getElementById('tab-mantenciones');
  if (formCont && !formCont.querySelector('#formNuevaMantencion')) {
    const form = renderFormularioMantencion();
    formCont.prepend(form);
  }
  renderTablaMantenciones();
};
