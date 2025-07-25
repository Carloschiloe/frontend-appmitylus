import { getCentrosAll } from '../core/centros_repo.js';

let calendarioInstance = null;
let yaInicializado = false;

async function obtenerEventosTareas(filtroCentro = 'todos', filtroEstado = 'todos') {
  const centros = await getCentrosAll();
  const eventos = [];

  centros.forEach((centro) => {
    if (filtroCentro !== 'todos' && centro.name !== filtroCentro) return;
    (centro.lines || []).forEach((linea, lineaIdx) => {
      (linea.tareas || []).forEach((tarea, tareaIdx) => {
        if (!tarea.fecha) return;
        if (filtroEstado !== 'todos' && tarea.estado !== filtroEstado) return;

        const titulo = tarea.titulo || tarea.descripcion || 'Sin título';
        eventos.push({
          title: titulo,
          start: tarea.fecha,
          allDay: true,
          color:
            tarea.estado === 'Pendiente'  ? '#d32f2f' :
            tarea.estado === 'En curso'   ? '#ffa000' :
            tarea.estado === 'Completada' ? '#388e3c' : '#1976d2',
          extendedProps: {
            centro: centro.name,
            codigo: centro.code,
            linea: linea.number,
            estado: tarea.estado,
            fecha: tarea.fecha,
            tarea,
            lineaObj: linea,
            tareaIdx,
            lineaIdx
          }
        });
      });
    });
  });

  return eventos;
}

async function actualizarSelectsFiltro(defaults = true) {
  const selectCentro = document.getElementById('filtroCentro');
  if (selectCentro) {
    selectCentro.innerHTML = '<option value="todos" selected>Todos los centros</option>';
    const centros = await getCentrosAll();
    centros.forEach(c => {
      selectCentro.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
    if (window.M) M.FormSelect.init(selectCentro);
  }

  const selectEstado = document.getElementById('filtroEstado');
  if (selectEstado && window.M) M.FormSelect.init(selectEstado);

  if (defaults && selectCentro && selectEstado) {
    selectCentro.selectedIndex = 0;
    selectEstado.selectedIndex = 0;
    if (window.M) {
      M.FormSelect.init(selectCentro);
      M.FormSelect.init(selectEstado);
    }
  }
}

function mostrarModalTarea(evento) {
  const modal = document.getElementById('modalDetalleTarea');
  if (!modal) return;

  const p = evento.extendedProps;
  document.getElementById('detalleTitulo').textContent = p.descripcion || '(Sin título)';
  document.getElementById('detalleContenido').innerHTML = `
    <b>Centro:</b> ${p.centro}<br>
    <b>Código centro:</b> ${p.codigo || '-'}<br>
    <b>Línea:</b> ${p.linea}<br>
    <b>Estado:</b> ${p.estado}<br>
    <b>Fecha:</b> ${p.fecha}<br>
    <b>Descripción:</b> ${p.tarea?.descripcion || p.tarea?.titulo || '—'}
  `;

  let inst = window.M.Modal.getInstance(modal);
  if (!inst) inst = window.M.Modal.init(modal);
  inst.open();
}

async function inicializarCalendario() {
  const calendarEl = document.getElementById('calendarioTareas');
  if (!calendarEl) return;

  // destruir anterior
  if (calendarioInstance?.destroy) calendarioInstance.destroy();

  const filtroCentro = document.getElementById('filtroCentro')?.value || 'todos';
  const filtroEstado = document.getElementById('filtroEstado')?.value || 'todos';
  const eventos = await obtenerEventosTareas(filtroCentro, filtroEstado);

  calendarioInstance = new window.FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    height: 620,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listMonth'
    },
    events: eventos,
    eventDisplay: 'block',
    eventClick(info) {
      info.jsEvent.preventDefault();
      mostrarModalTarea(info.event);
    },
    noEventsContent: 'No hay tareas para mostrar.'
  });

  calendarioInstance.render();
  setTimeout(() => calendarioInstance.updateSize && calendarioInstance.updateSize(), 250);
}

async function refrescarEventos() {
  if (!calendarioInstance) return;
  const filtroCentro = document.getElementById('filtroCentro')?.value || 'todos';
  const filtroEstado = document.getElementById('filtroEstado')?.value || 'todos';
  const eventos = await obtenerEventosTareas(filtroCentro, filtroEstado);
  calendarioInstance.removeAllEvents();
  calendarioInstance.addEventSource(eventos);
  calendarioInstance.updateSize && calendarioInstance.updateSize();
}

function activarListenersFiltros() {
  const selectCentro = document.getElementById('filtroCentro');
  const selectEstado = document.getElementById('filtroEstado');
  const btnActualizar = document.getElementById('btnRefrescarCalendario');
  if (selectCentro) selectCentro.onchange = refrescarEventos;
  if (selectEstado) selectEstado.onchange = refrescarEventos;
  if (btnActualizar) btnActualizar.onclick = refrescarEventos;
}

// Llamar UNA sola vez cuando se muestre la pestaña
async function asegurarCalendarioVisible() {
  if (yaInicializado) {
    // solo asegurar tamaño
    calendarioInstance?.updateSize && calendarioInstance.updateSize();
    return;
  }
  yaInicializado = true;
  await actualizarSelectsFiltro(true);
  await inicializarCalendario();
  activarListenersFiltros();
}

export {
  asegurarCalendarioVisible,
  actualizarSelectsFiltro,
  refrescarEventos
};
