// js/tareas/mantencion_lineas.js
import { getCentros, updateCentro } from '../core/almacenamiento.js';

let centrosData = [];

document.addEventListener('DOMContentLoaded', async () => {
  await cargarCentrosEnSelect();

  document.getElementById('selectCentro').addEventListener('change', function () {
    const idx = this.value;
    cargarLineasEnSelect(idx);
    document.getElementById('tablaTareasLinea').innerHTML = '';
  });

  document.getElementById('formMantencionLinea').addEventListener('submit', async function (e) {
    e.preventDefault();

    const centroIdx = document.getElementById('selectCentro').value;
    const lineaIdx = document.getElementById('selectLinea').value;
    const titulo = document.getElementById('mantencionTitulo').value.trim();
    const fecha = document.getElementById('mantencionFecha').value;
    const estado = document.getElementById('mantencionEstado').value;
    const descripcion = document.getElementById('mantencionDesc').value.trim();

    // LOG - debug
    console.log('🔹 Form Data:', { centroIdx, lineaIdx, titulo, fecha, estado, descripcion });

    if (!centroIdx || !lineaIdx || !titulo || !fecha || !estado) {
      M.toast({ html: 'Completa todos los campos', classes: 'red' });
      return;
    }

    const centro = centrosData[centroIdx];
    const linea = centro?.lines?.[lineaIdx];
    if (!linea) {
      console.log('❌ Línea no encontrada', { centro, lineaIdx });
      return M.toast({ html: 'Línea no encontrada', classes: 'red' });
    }

    // Usa "mantenciones" para este flujo (¡NO tareas!)
    if (!linea.mantenciones) linea.mantenciones = [];
    linea.mantenciones.push({
      tipo: titulo,
      fecha,
      estado,
      descripcion
    });

    // LOG
    console.log('🟢 Centro a guardar:', centro);

    // Guarda el centro actualizado en el backend
    const res = await updateCentro(centro._id, centro);
    console.log('🟡 Respuesta updateCentro:', res);

    if (res && res._id) {
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

async function cargarCentrosEnSelect(selectedCentroId = null, selectedLineaNum = null) {
  centrosData = await getCentros();
  console.log('📦 Centros obtenidos:', centrosData);
  const selectCentro = document.getElementById('selectCentro');
  selectCentro.innerHTML = '<option value="" disabled selected>Seleccione centro</option>';
  centrosData.forEach((centro, idx) => {
    selectCentro.innerHTML += `<option value="${idx}" ${selectedCentroId === centro._id ? 'selected' : ''}>${centro.name}</option>`;
  });
  M.FormSelect.init(selectCentro);

  const centroIdx = selectCentro.value;
  if (centroIdx) cargarLineasEnSelect(centroIdx, selectedLineaNum);
  else {
    document.getElementById('selectLinea').innerHTML = '<option value="" disabled selected>Seleccione línea</option>';
    document.getElementById('selectLinea').disabled = true;
  }
}

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

  // Solo un listener limpio
  selectLinea.onchange = function () {
    mostrarTareasDeLinea(centroIdx, this.value);
  };
}

function mostrarTareasDeLinea(centroIdx, lineaIdx) {
  const cont = document.getElementById('tablaTareasLinea');
  cont.innerHTML = '';
  const linea = centrosData[centroIdx]?.lines?.[lineaIdx];
  console.log('👁️ Línea a mostrar:', linea);
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
