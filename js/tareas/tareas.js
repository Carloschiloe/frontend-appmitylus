import { getCentros, saveCentro } from '../core/almacenamiento.js';

export function abrirModalTareas(centro, lineIdx, onChange, modalInstance = null) {
  const centros = getCentros();
  let centroIdx = centros.findIndex(c => c.code === centro.code);
  if (centroIdx === -1) centroIdx = centros.length ? 0 : -1;
  if (centroIdx === -1) {
    console.error('No hay centros disponibles');
    return;
  }

  const linea = centros[centroIdx]?.lines?.[lineIdx];
  if (!linea) {
    console.error('Línea no encontrada');
    return;
  }

  const modal = document.getElementById('modalTareasLinea');
  if (!modal) {
    console.error('No existe modalTareasLinea en el DOM');
    return;
  }

  const tareasList = modal.querySelector('#tareasList');
  const formNuevaTarea = modal.querySelector('#formTareaLinea');
  const tareaTitulo = modal.querySelector('#tareaDesc');
  const tareaFecha = modal.querySelector('#tareaFecha');
  const tareaEstado = modal.querySelector('#tareaEstado');
  const tareaDescripcion = modal.querySelector('#tareaDescExtra');
  const modalNumLinea = modal.querySelector('#modalNumLinea');

  modalNumLinea.textContent = linea.number || '—';

  function renderTareas() {
    if (!linea.tareas || linea.tareas.length === 0) {
      tareasList.innerHTML = '<p style="color:#888; font-style: italic;">Sin tareas</p>';
      return;
    }

    let html = '<ul class="collection">';
    linea.tareas.forEach((tarea, i) => {
      html += `
        <li class="collection-item">
          <div>
            <strong>${tarea.titulo || '(Sin título)'}</strong><br>
            Fecha: ${tarea.fecha || '-'}<br>
            Estado: 
            <select data-idx="${i}" class="estado-tarea-select">
              <option value="Pendiente"   ${tarea.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="En curso"    ${tarea.estado === 'En curso' ? 'selected' : ''}>En curso</option>
              <option value="Completada"  ${tarea.estado === 'Completada' ? 'selected' : ''}>Completada</option>
            </select>
            <a href="#!" data-idx="${i}" class="secondary-content btn-borrar-tarea">
              <i class="material-icons red-text">delete</i>
            </a>
            <br>
            <span style="font-size:0.92em; color:#888;">
              ${tarea.descripcion ? 'Descripción: ' + tarea.descripcion : ''}
            </span>
          </div>
        </li>`;
    });
    html += '</ul>';

    tareasList.innerHTML = html;

    tareasList.querySelectorAll('.estado-tarea-select').forEach(sel => {
      sel.onchange = function() {
        const idx = +this.dataset.idx;
        linea.tareas[idx].estado = this.value;
        saveCentros(centros);
        renderTareas();
        if (onChange) onChange();
      };
    });

    tareasList.querySelectorAll('.btn-borrar-tarea').forEach(btn => {
      btn.onclick = function() {
        const idx = +this.dataset.idx;
        if (confirm('¿Eliminar esta tarea?')) {
          linea.tareas.splice(idx, 1);
          saveCentros(centros);
          renderTareas();
          if (onChange) onChange();
        }
      };
    });

    M.FormSelect.init(tareasList.querySelectorAll('select'));
  }

  renderTareas();

  // Limpiar formulario antes de mostrar modal
  tareaTitulo.value = '';
  tareaFecha.value = '';
  tareaEstado.selectedIndex = 0;
  if (tareaDescripcion) tareaDescripcion.value = '';
  M.updateTextFields();
  M.FormSelect.init(modal.querySelectorAll('select'));

  formNuevaTarea.onsubmit = function(e) {
    e.preventDefault();

    const titulo = tareaTitulo.value.trim();
    const fecha = tareaFecha.value;
    const estado = tareaEstado.value;
    const descripcion = tareaDescripcion ? tareaDescripcion.value.trim() : '';

    if (!titulo || !fecha || !estado) {
      M.toast({ html: 'Completa todos los campos', classes: 'red' });
      return;
    }

    if (!linea.tareas) linea.tareas = [];
    const nuevaTarea = { titulo, fecha, estado, descripcion };
    linea.tareas.push(nuevaTarea);
    saveCentros(centros);
    renderTareas();
    if (onChange) onChange();

    // Limpiar formulario tras agregar tarea
    tareaTitulo.value = '';
    tareaFecha.value = '';
    tareaEstado.selectedIndex = 0;
    if (tareaDescripcion) tareaDescripcion.value = '';
    M.updateTextFields();
    M.FormSelect.init(modal.querySelectorAll('select'));
  };

  if (modalInstance) {
    modalInstance.open();
  } else {
    let instancia = M.Modal.getInstance(modal);
    if (!instancia) instancia = M.Modal.init(modal);
    instancia.open();
  }
}
