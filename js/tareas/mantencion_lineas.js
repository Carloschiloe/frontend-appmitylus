// js/tareas/mantencion_lineas.js
import { getCentros, updateCentro } from '../core/almacenamiento.js';

let centrosData = [];

document.addEventListener('DOMContentLoaded', async () => {
  await cargarCentrosEnSelect();

  // Cuando seleccionas centro, llenas el select de líneas
  document.getElementById('selectCentro').addEventListener('change', function () {
    const idx = this.value;
    cargarLineasEnSelect(idx);
  });

  // Al enviar el formulario
  document.getElementById('formMantencionLinea').addEventListener('submit', async function (e) {
    e.preventDefault();

    const centroIdx = document.getElementById('selectCentro').value;
    const lineaIdx = document.getElementById('selectLinea').value;
    const titulo = document.getElementById('mantencionTitulo').value.trim();
    const fecha = document.getElementById('mantencionFecha').value;
    const estado = document.getElementById('mantencionEstado').value;
    const descripcion = document.getElementById('mantencionDesc').value.trim();

    if (!centroIdx || !lineaIdx || !titulo || !fecha || !estado) {
      M.toast({ html: 'Completa todos los campos', classes: 'red' });
      return;
    }

    // Lógica de asignar mantención a la línea seleccionada (solo frontend por ahora)
    const centro = centrosData[centroIdx];
    const linea = centro?.lines?.[lineaIdx];
    if (!linea) return M.toast({ html: 'Línea no encontrada', classes: 'red' });

    if (!linea.tareas) linea.tareas = [];
    linea.tareas.push({ titulo, fecha, estado, descripcion });

    // Actualiza en backend (si quieres guardar)
    // await updateCentro(centro._id, centro);

    M.toast({ html: 'Mantención asignada', classes: 'green' });
    mostrarTareasDeLinea(centroIdx, lineaIdx);

    // Limpiar formulario después de guardar
    this.reset();
    M.updateTextFields();
    document.getElementById('selectLinea').disabled = true;
    M.FormSelect.init(document.getElementById('selectCentro'));
    M.FormSelect.init(document.getElementById('selectLinea'));
    M.FormSelect.init(document.getElementById('mantencionEstado'));
  });
});

// Carga los centros en el select
async function cargarCentrosEnSelect() {
  centrosData = await getCentros();
  console.log('Centros obtenidos:', centrosData); // DEBUG
  const selectCentro = document.getElementById('selectCentro');
  selectCentro.innerHTML = '<option value="" disabled selected>Seleccione centro</option>';
  centrosData.forEach((centro, idx) => {
    selectCentro.innerHTML += `<option value="${idx}">${centro.name}</option>`;
  });
  M.FormSelect.init(selectCentro);
  document.getElementById('selectLinea').innerHTML = '<option value="" disabled selected>Seleccione línea</option>';
  document.getElementById('selectLinea').disabled = true;
}

// Carga las líneas del centro seleccionado
function cargarLineasEnSelect(centroIdx) {
  const selectLinea = document.getElementById('selectLinea');
  selectLinea.innerHTML = '<option value="" disabled selected>Seleccione línea</option>';
  if (!centrosData[centroIdx] || !centrosData[centroIdx].lines) {
    selectLinea.disabled = true;
    M.FormSelect.init(selectLinea);
    return;
  }
  centrosData[centroIdx].lines.forEach((linea, idx) => {
    selectLinea.innerHTML += `<option value="${idx}">${linea.number || `Línea ${idx + 1}`}</option>`;
  });
  selectLinea.disabled = false;
  M.FormSelect.init(selectLinea);

  // Mostrar tareas/mantenciones asignadas cuando selecciones línea
  selectLinea.addEventListener('change', function () {
    mostrarTareasDeLinea(centroIdx, this.value);
  });
}

// Mostrar tareas/mantenciones de la línea seleccionada
function mostrarTareasDeLinea(centroIdx, lineaIdx) {
  const cont = document.getElementById('tablaTareasLinea');
  cont.innerHTML = '';
  const linea = centrosData[centroIdx]?.lines?.[lineaIdx];
  if (!linea || !linea.tareas || !linea.tareas.length) {
    cont.innerHTML = '<p style="color:#888;">Sin tareas/mantenciones asignadas a esta línea</p>';
    return;
  }
  let html = '<ul class="collection">';
  linea.tareas.forEach(tarea => {
    html += `
      <li class="collection-item">
        <strong>${tarea.titulo}</strong> (${tarea.fecha})<br>
        Estado: ${tarea.estado}<br>
        ${tarea.descripcion ? `<em>${tarea.descripcion}</em>` : ''}
      </li>
    `;
  });
  html += '</ul>';
  cont.innerHTML = html;
}

