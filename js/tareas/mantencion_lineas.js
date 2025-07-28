// js/tareas/mantencion_lineas.js
import { getCentros, updateCentro } from '../core/almacenamiento.js';

let centros = [];
let mantenciones = []; // solo para frontend, no persistente aún

async function cargarCentros() {
  centros = await getCentros();
}

function renderSelectorCentroLinea(onCentroChange, onLineaChange) {
  const selectorDiv = document.createElement('div');
  selectorDiv.className = 'row';

  // Centro
  const colCentro = document.createElement('div');
  colCentro.className = 'input-field col s6';
  const selectCentro = document.createElement('select');
  selectCentro.id = 'selectorCentro';
  selectCentro.innerHTML = `<option value="" disabled selected>Selecciona Centro</option>` +
    centros.map((c, i) => `<option value="${i}">${c.name}</option>`).join('');
  colCentro.appendChild(selectCentro);
  const lblCentro = document.createElement('label');
  lblCentro.textContent = 'Centro';
  lblCentro.htmlFor = 'selectorCentro';
  colCentro.appendChild(lblCentro);

  // Línea
  const colLinea = document.createElement('div');
  colLinea.className = 'input-field col s6';
  const selectLinea = document.createElement('select');
  selectLinea.id = 'selectorLinea';
  selectLinea.innerHTML = `<option value="" disabled selected>Selecciona Línea</option>`;
  colLinea.appendChild(selectLinea);
  const lblLinea = document.createElement('label');
  lblLinea.textContent = 'Línea de Cultivo';
  lblLinea.htmlFor = 'selectorLinea';
  colLinea.appendChild(lblLinea);

  selectorDiv.appendChild(colCentro);
  selectorDiv.appendChild(colLinea);

  // Materialize
  setTimeout(() => {
    M.FormSelect.init([selectCentro, selectLinea]);
  }, 20);

  // Eventos
  selectCentro.onchange = function () {
    const centroIdx = +selectCentro.value;
    const lineas = centros[centroIdx]?.lines ?? [];
    selectLinea.innerHTML = `<option value="" disabled selected>Selecciona Línea</option>` +
      lineas.map((l, j) => `<option value="${j}">${l.number}</option>`).join('');
    setTimeout(() => M.FormSelect.init([selectLinea]), 10);
    if (onCentroChange) onCentroChange(centroIdx);
  };
  selectLinea.onchange = function () {
    if (onLineaChange) onLineaChange(selectCentro.value, selectLinea.value);
  };

  return selectorDiv;
}

function renderFormularioMantencion(onNuevaMantencion) {
  const form = document.createElement('form');
  form.id = 'formNuevaMantencion';
  form.className = 'card-panel';
  form.style.marginBottom = '1rem';

  // Selectores centro/linea
  let centroIdx = null, lineaIdx = null;
  const selectorDiv = renderSelectorCentroLinea(
    idx => { centroIdx = idx; lineaIdx = null; },
    (cidx, lidx) => { centroIdx = +cidx; lineaIdx = +lidx; }
  );

  // Tipo mantención
  const rowTipo = document.createElement('div');
  rowTipo.className = 'row';
  rowTipo.innerHTML = `
    <div class="input-field col s6">
      <select id="tipoMantencion" required>
        <option value="" disabled selected>Selecciona tipo</option>
        <option>Reflote</option>
        <option>Tensado de línea</option>
        <option>Extracción de boyas</option>
        <option>Mantención general</option>
        <option>Otra</option>
      </select>
      <label for="tipoMantencion">Tipo de mantención</label>
    </div>
    <div class="input-field col s6">
      <input id="fechaMantencion" type="date" required>
      <label for="fechaMantencion" class="active">Fecha programada</label>
    </div>
  `;

  // Descripción
  const rowDesc = document.createElement('div');
  rowDesc.className = 'row';
  rowDesc.innerHTML = `
    <div class="input-field col s12">
      <input id="descMantencion" type="text">
      <label for="descMantencion">Descripción (opcional)</label>
    </div>
  `;

  // Botón guardar
  const divBtn = document.createElement('div');
  divBtn.className = 'center-btn';
  divBtn.innerHTML = `
    <button type="submit" class="btn green">
      <i class="material-icons left">save</i>Agregar Mantención
    </button>
  `;

  form.appendChild(selectorDiv);
  form.appendChild(rowTipo);
  form.appendChild(rowDesc);
  form.appendChild(divBtn);

  setTimeout(() => {
    M.FormSelect.init(form.querySelectorAll('select'));
    M.updateTextFields();
  }, 40);

  form.onsubmit = async function (e) {
    e.preventDefault();
    // Validaciones
    if (centroIdx === null || lineaIdx === null) {
      M.toast({ html: 'Debes seleccionar centro y línea', classes: 'red' });
      return;
    }
    const tipo = form.querySelector('#tipoMantencion').value;
    const fecha = form.querySelector('#fechaMantencion').value;
    const desc = form.querySelector('#descMantencion').value.trim();
    if (!tipo || !fecha) {
      M.toast({ html: 'Selecciona tipo y fecha', classes: 'red' });
      return;
    }
    // Agregar a la línea correspondiente
    const centro = centros[centroIdx];
    const linea = centro.lines[lineaIdx];
    if (!linea.mantenciones) linea.mantenciones = [];
    linea.mantenciones.push({
      tipo,
      fecha,
      descripcion: desc,
      estado: 'Pendiente',
      creada: new Date().toISOString()
    });
    // Actualizar en backend
    await updateCentro(centro._id, centro);
    M.toast({ html: 'Mantención agregada', classes: 'green' });

    if (typeof onNuevaMantencion === 'function') onNuevaMantencion();

    form.reset();
    setTimeout(() => M.updateTextFields(), 30);
    setTimeout(() => M.FormSelect.init(form.querySelectorAll('select')), 30);
  };

  return form;
}

function renderTablaMantenciones() {
  const tablaDiv = document.getElementById('tablaMantenciones');
  if (!tablaDiv) return;
  let html = `
    <table class="striped highlight mantencion-table">
      <thead>
        <tr>
          <th>Centro</th>
          <th>N° Línea</th>
          <th>Tipo</th>
          <th>Fecha</th>
          <th>Estado</th>
          <th>Descripción</th>
        </tr>
      </thead>
      <tbody>
  `;
  centros.forEach(c => {
    (c.lines || []).forEach(l => {
      (l.mantenciones || []).forEach(m => {
        html += `
        <tr>
          <td>${c.name}</td>
          <td>${l.number}</td>
          <td>${m.tipo}</td>
          <td>${m.fecha}</td>
          <td>${m.estado}</td>
          <td>${m.descripcion || ''}</td>
        </tr>
        `;
      });
    });
  });
  html += '</tbody></table>';
  tablaDiv.innerHTML = html;
}

window.inicializarTareasMantenciones = async function () {
  await cargarCentros();
  // Quita form duplicado si refrescas
  const oldForm = document.getElementById('formNuevaMantencion');
  if (oldForm) oldForm.remove();
  const formCont = document.getElementById('tab-mantenciones');
  if (formCont) {
    const form = renderFormularioMantencion(() => renderTablaMantenciones());
    formCont.prepend(form);
  }
  renderTablaMantenciones();
};

