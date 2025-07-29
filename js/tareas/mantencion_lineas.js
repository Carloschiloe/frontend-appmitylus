// js/tareas/mantencion_lineas.js
import { getCentros, updateCentro } from '../core/almacenamiento.js';

let centrosData = [];

document.addEventListener('DOMContentLoaded', async () => {
  await cargarCentrosEnSelect();

  // Cuando seleccionas centro, llenas el select de líneas
  document.getElementById('selectCentro').addEventListener('change', function () {
    const idx = this.value;
    cargarLineasEnSelect(idx);
    // Limpia la tabla de tareas cuando cambias de centro
    document.getElementById('tablaTareasLinea').innerHTML = '';
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

    const centro = centrosData[centroIdx];
    const linea = centro?.lines?.[lineaIdx];
    if (!linea) return M.toast({ html: 'Línea no encontrada', classes: 'red' });

    if (!linea.mantenciones) linea.mantenciones = [];
    linea.mantenciones.push({
      tipo: titulo,
      fecha,
      estado,
      descripcion
    });

    // Guarda el centro actualizado en el backend
    const res = await updateCentro(centro._id, centro);
    if (res && res._id) {
      // Vuelve a cargar los centros para que los datos estén frescos
      await cargarCentrosEnSelect(centro._id, linea.number);
      M.toast({ html: 'Mantención asignada', classes: 'green' });
    } else {
      M.toast({ html: 'Error al guardar la mantención', classes: 'red' });
    }

    // Limpiar formulario después de guardar
    this.reset();
    document.getElementById('selectLinea').disabled = true;
    M.updateTextFields();
    M.FormSelect.init(document.getElementById('selectCentro'));
    M.FormSelect.init(document.getElementById('selectLinea'));
    M.FormSelect.init(document.getElementById('mantencionEstado'));
    document.getElementById('tablaTareasLinea').innerHTML = '';
  });
});

// Carga los centros en el select
async function cargarCentrosEnSelect(selectedCentroId = null, selectedLineaNum = null) {
  centrosData = await getCentros();
  const selectCentro = document.getElementById('selectCentro');
  selectCentro.innerHTML = '<option value="" disabled selected>Seleccione centro</option>';
  centrosData.forEach((centro, idx) => {
    selectCentro.innerHTML += `<option value="${idx}" ${selectedCentroId === centro._id ? 'selected' : ''}>${centro.name}</option>`;
  });
  M.FormSelect.init(selectCentro);

  // Si hay un centro seleccionado, carga sus líneas y selecciona la línea si corresponde
  const centroIdx = selectCentro.value;
  if (centroIdx) cargarLineasEnSelect(centroIdx, selectedLineaNum);
  else {
    document.getElementById('selectLinea').innerHTML = '<option value="" disabled selected>Seleccione línea</option>';
    document.getElementById('selectLinea').disabled = true;
  }
}

// Carga las líneas del centro seleccionado
function cargarLineasEnSelect(centroIdx, selectedLineaNum = null) {
  const selectLinea = document.getElementById('selectLinea');
  selectLinea.innerHTML = '<option value="" disabled selected>Seleccione línea</option>';
  if (!centrosData[centroIdx] || !centrosData[centroIdx].lines) {
    selectLinea.disabled = true;
    M.FormSelect.init(selectLinea);
    return;
  }
  centrosData[centroIdx].lines.forEach((linea, idx) => {
    selectLinea.innerHTML += `<option value="${idx}" ${selectedLineaNum == linea.number ? 'selected' : ''}>${linea.number || `Línea ${idx + 1}`}</option>`;
  });
  selectLinea.disabled = false;
  M.FormSelect.init(selectLinea);

  // Evita múltiples listeners: primero removeEventListener si ya existe
  selectLinea.onchange = function () {
    mostrarTareasDeLinea(centroIdx, this.value);
  };
}

// Mostrar tareas/mantenciones de la línea seleccionada
function mostrarTareasDeLinea(centroIdx, lineaIdx) {
  const cont = document.getElementById('tablaTareasLinea');
  cont.innerHTML = '';
  const linea = centrosData[centroIdx]?.lines?.[lineaIdx];
  if (!linea || !linea.mantenciones || !linea.mantenciones.length) {
    cont.innerHTML = '<p style="color:#888;">Sin tareas/mantenciones asignadas a esta línea</p>';
    return;
  }
  let html = '<ul class="collection">';
  linea.mantenciones.forEach(mant => {
    html += `
      <li class="collection-item">
        <strong>${mant.tipo}</strong> (${mant.fecha})<br>
        Estado: ${mant.estado}<br>
        ${mant.descripcion ? `<em>${mant.descripcion}</em>` : ''}
      </li>
    `;
  });
  html += '</ul>';
  cont.innerHTML = html;
}


