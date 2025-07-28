// js/calendario/calendario.js
import { getCentros } from '../core/almacenamiento.js';

let calendar;

async function cargarEventosTareas(filtroCentro = '', filtroEstado = '') {
  const centros = await getCentros();
  let eventos = [];

  centros.forEach((centro) => {
    (centro.lines || []).forEach((linea) => {
      (linea.tareas || []).forEach((tarea) => {
        // Filtros
        if (filtroCentro && filtroCentro !== centro._id) return;
        if (filtroEstado && filtroEstado !== 'todos' && tarea.estado !== filtroEstado) return;

        eventos.push({
          title: `${centro.name} - Línea ${linea.number}: ${tarea.titulo}`,
          start: tarea.fecha,
          extendedProps: {
            estado: tarea.estado,
            descripcion: tarea.descripcion,
            centro: centro.name,
            linea: linea.number
          },
          color:
            tarea.estado === 'Pendiente'
              ? '#e53935'
              : tarea.estado === 'En curso'
              ? '#fbc02d'
              : '#43a047'
        });
      });
    });
  });

  return eventos;
}

window.asegurarCalendarioVisible = async function () {
  const filtroCentro = document.getElementById('filtroCentro');
  const filtroEstado = document.getElementById('filtroEstado');
  const calendarioDiv = document.getElementById('calendarioTareas');

  // Llenar select de centros
  const centros = await getCentros();
  if (filtroCentro && filtroCentro.children.length <= 1) {
    filtroCentro.innerHTML = `<option value="">Todos los centros</option>` +
      centros.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
    M.FormSelect.init(filtroCentro);
  }

  // Inicializa calendario
  if (!calendar) {
    calendar = new FullCalendar.Calendar(calendarioDiv, {
      initialView: 'dayGridMonth',
      locale: 'es',
      height: 600,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,listWeek'
      },
      eventClick: function (info) {
        const tarea = info.event.extendedProps;
        const modal = document.getElementById('modalDetalleTarea');
        document.getElementById('detalleTitulo').textContent = info.event.title;
        document.getElementById('detalleContenido').innerHTML = `
          <b>Centro:</b> ${tarea.centro}<br>
          <b>Línea:</b> ${tarea.linea}<br>
          <b>Estado:</b> ${tarea.estado}<br>
          <b>Fecha:</b> ${info.event.startStr}<br>
          <b>Descripción:</b> ${tarea.descripcion || '—'}
        `;
        let instancia = M.Modal.getInstance(modal);
        if (!instancia) instancia = M.Modal.init(modal);
        instancia.open();
      }
    });
    calendar.render();
  }

  async function refrescar() {
    const eventos = await cargarEventosTareas(filtroCentro.value, filtroEstado.value);
    calendar.removeAllEvents();
    calendar.addEventSource(eventos);
  }

  // Filtros
  filtroCentro.onchange = refrescar;
  filtroEstado.onchange = refrescar;
  document.getElementById('btnRefrescarCalendario').onclick = refrescar;

  // Primer render
  refrescar();
};

