// js/calendario/calendario.js
import { getCentros } from '../core/almacenamiento.js';

// Permite recargar siempre que se entra a la pestaña (ajusta si quieres evitar duplicados)
window.inicializarCalendarioMantenciones = async function() {
  // Limpia el contenedor
  let calendarioDiv = document.getElementById('calendarioTareas');
  calendarioDiv.innerHTML = '<div id="calendarMant"></div>';
  const calendarEl = document.getElementById('calendarMant');

  // Carga los datos
  const centros = await getCentros();

  // Junta todas las mantenciones/tareas en un array de eventos
  const eventos = [];
  centros.forEach((c) => {
    (c.lines || []).forEach((l) => {
      // Compatibilidad: si tus mantenciones están en l.mantenciones o l.tareas
      const tareas = l.mantenciones || l.tareas || [];
      tareas.forEach((m) => {
        eventos.push({
          title: `${c.name} - Línea ${l.number}: ${m.titulo || m.tipo || 'Mantención'}`,
          start: m.fecha,
          end: m.fecha,
          extendedProps: {
            centro: c.name,
            linea: l.number,
            tipo: m.titulo || m.tipo || 'Mantención',
            estado: m.estado,
            descripcion: m.descripcion,
          },
        });
      });
    });
  });

  // Renderiza FullCalendar
  const calendar = new window.FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    height: 600,
    events: eventos,
    eventClick: function(info) {
      const { centro, linea, tipo, estado, descripcion } = info.event.extendedProps;
      const modal = document.getElementById('modalDetalleTarea');
      if (modal) {
        document.getElementById('detalleTitulo').textContent = tipo + ' – ' + centro;
        document.getElementById('detalleContenido').innerHTML =
          `<b>Línea:</b> ${linea}<br>
           <b>Estado:</b> ${estado}<br>
           <b>Descripción:</b> ${descripcion || ''}`;
        let instancia = M.Modal.getInstance(modal);
        if (!instancia) instancia = M.Modal.init(modal);
        instancia.open();
      }
    }
  });

  calendar.render();
};
