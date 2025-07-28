// js/calendario/calendario.js
import { getCentros } from '../core/almacenamiento.js';

window.asegurarCalendarioVisible = async function() {
  const centros = await getCentros();

  // Junta todas las mantenciones en un array de eventos
  const eventos = [];
  centros.forEach((c, centroIdx) => {
    (c.lines || []).forEach((l, lineaIdx) => {
      (l.mantenciones || []).forEach((m, mantIdx) => {
        eventos.push({
          title: `${c.name} - Línea ${l.number}: ${m.tipo}`,
          start: m.fecha,
          end: m.fecha,
          extendedProps: {
            centro: c.name,
            linea: l.number,
            tipo: m.tipo,
            estado: m.estado,
            descripcion: m.descripcion,
          },
        });
      });
    });
  });

  // Renderizar calendario
  let calendarioDiv = document.getElementById('calendarioTareas');
  calendarioDiv.innerHTML = '<div id="calendarMant"></div>';
  const calendarEl = document.getElementById('calendarMant');

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

