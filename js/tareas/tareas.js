// js/tareas/tareas.js
import { getCentros, saveCentros } from '../core/almacenamiento.js';

// Abre el modal para ver/asignar tareas a una línea de un centro
export function abrirModalTareas(centro, lineIdx, onChange, modalInstance = null) {
  const centros = getCentros();
  let centroIdx = centros.findIndex(c => c.code === centro.code);
  if (centroIdx === -1) {
    M.toast({ html: 'Centro no encontrado', classes: 'red' });
    return;
  }
  const linea = centros[centroIdx]?.lines?.[lineIdx];
  if (!linea) {
    M.toast({ html: 'Línea no encontrada', classes: 'red' });
    return;
  }
  const modal = document.getElementById('modalTareasLinea');
  if (!modal) {
    M.toast({ html: 'No existe modalTareasLinea', classes: 'red' });
    return;
  }

  const tareasList = modal.querySelector('#tareasList');
  const formNuevaTarea = modal.querySelector('#formTareaLinea');
  const tareaTitulo = modal.querySelector('#tareaDesc');
  const tareaFecha = modal.querySelector('#tareaFecha');
  const tareaEstado = modal.querySelector('#tareaEstado');
  const tareaDescripcion = modal.querySelector('#tareaDescExtra');
  const modalNumLinea = modal.querySelector('#modalNumLinea');

  if (modalNumLinea) modalNumLinea.textContent = linea.number || '—';

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
            <select data-idx="${i}" class="estado-tarea-select browser-default" style="width:auto;display:inline-block;">
              <option value="Pendiente"   ${tarea.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="En curso"    ${tarea.estado === 'En curso' ? 'selected' : ''}>En curso</option>
              <option value="Completada"  ${tarea.estado === 'Completada' ? 'selected' : ''}>Completada</option>
            </select>
            <a href="#!" data-idx="${i}" class="secondary-content btn-borrar-tarea" title="Eliminar">
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

    // Cambio de estado de tarea (select)
    tareasList.querySelectorAll('.estado-tarea-select').forEach(sel => {
      sel.onchange = function() {
        const idx = +this.dataset.idx;
        linea.tareas[idx].estado = this.value;
        saveCentros(centros);
        renderTareas();
        if (typeof onChange === 'function') onChange();
      };
    });

    // Borrar tarea
    tareasList.querySelectorAll('.btn-borrar-tarea').forEach(btn => {
      btn.onclick = function() {
        const idx = +this.dataset.idx;
        if (confirm('¿Eliminar esta tarea?')) {
          linea.tareas.splice(idx, 1);
          saveCentros(centros);
          renderTareas();
          if (typeof onChange === 'function') onChange();
        }
      };
    });
  }

  renderTareas();

  // Limpiar formulario antes de mostrar el modal (para nueva tarea)
  if (tareaTitulo) tareaTitulo.value = '';
  if (tareaFecha) tareaFecha.value = '';
  if (tareaEstado) tareaEstado.selectedIndex = 0;
  if (tareaDescripcion) tareaDescripcion.value = '';
  M.updateTextFields();
  if (tareaEstado) M.FormSelect.init([tareaEstado]);

  // Maneja submit del formulario para agregar una nueva tarea
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
    if (typeof onChange === 'function') onChange();

    // Limpiar el form después de agregar
    if (tareaTitulo) tareaTitulo.value = '';
    if (tareaFecha) tareaFecha.value = '';
    if (tareaEstado) tareaEstado.selectedIndex = 0;
    if (tareaDescripcion) tareaDescripcion.value = '';
    M.updateTextFields();
    if (tareaEstado) M.FormSelect.init([tareaEstado]);
  };

  // Abrir modal
  if (modalInstance) {
    modalInstance.open();
  } else {
    let instancia = M.Modal.getInstance(modal);
    if (!instancia) instancia = M.Modal.init(modal);
    instancia.open();
  }
}

// Muestra la tabla con todas las líneas y botón para ver/asignar mantenciones/tareas
export function inicializarTareasMantenciones() {
  const centros = getCentros();
  const tablaDiv = document.getElementById('tablaMantenciones');
  if (!tablaDiv) return;

  // Armar tabla de líneas de cultivo
  let html = `
    <table class="striped highlight">
      <thead>
        <tr>
          <th>Centro</th>
          <th>N° Línea</th>
          <th>Boyas</th>
          <th>Longitud</th>
          <th>Estado Línea</th>
          <th>Tareas / Mantenciones</th>
        </tr>
      </thead>
      <tbody>
  `;
  centros.forEach((centro, centroIdx) => {
    (centro.lines || []).forEach((linea, lineIdx) => {
      const totalTareas = linea.tareas ? linea.tareas.length : 0;
      // Estado general de las tareas (si hay al menos una pendiente, mostrar rojo; todas completadas, verde)
      let colorEstado = '';
      if (totalTareas) {
        if (linea.tareas.some(t => t.estado === 'Pendiente')) colorEstado = 'red-text';
        else if (linea.tareas.every(t => t.estado === 'Completada')) colorEstado = 'green-text';
        else colorEstado = 'amber-text';
      }
      html += `
        <tr>
          <td>${centro.name}</td>
          <td>${linea.number}</td>
          <td>${linea.buoys ?? ''}</td>
          <td>${linea.longitud ?? ''}</td>
          <td>${linea.state ?? ''}</td>
          <td>
            <a href="#!" class="btn btn-small teal ver-tareas-linea" 
                data-centro-idx="${centroIdx}" data-line-idx="${lineIdx}">
              <i class="material-icons left">assignment</i> Ver tareas
            </a>
            <span class="${colorEstado}" style="margin-left:8px;">
              ${totalTareas} tareas
            </span>
          </td>
        </tr>
      `;
    });
  });

  html += '</tbody></table>';

  tablaDiv.innerHTML = html;

  // Handler: abrir modal de tareas al hacer click
  tablaDiv.querySelectorAll('.ver-tareas-linea').forEach(btn => {
    btn.onclick = () => {
      const centroIdx = +btn.dataset.centroIdx;
      const lineIdx = +btn.dataset.lineIdx;
      abrirModalTareas(centros[centroIdx], lineIdx, () => inicializarTareasMantenciones());
    };
  });
}

// Deja esto disponible en el global para auto-inicialización en el HTML
window.inicializarTareasMantenciones = inicializarTareasMantenciones;
