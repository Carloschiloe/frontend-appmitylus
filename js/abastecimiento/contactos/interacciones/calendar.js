import { toCalendarEvent } from './normalizers.js';

export function mountCalendar(el, items){
  const events = items.map(toCalendarEvent);
  // Si ya usas tu propio calendario (spa-mmpp/mmpp-calendario.js), inicialízalo acá.
  // Dejo un render simple para no bloquearte:
  el.innerHTML = `
    <div class="card"><div class="card-content">
      <div class="row" style="margin-bottom:6px;">
        <div class="col s12"><h6 style="margin:0">Calendario agregado</h6></div>
      </div>
      <ul style="margin:0;">
        ${events.map(e => `<li>${new Date(e.start).toLocaleString('es-CL')} — ${e.title}</li>`).join('')}
      </ul>
    </div></div>
  `;
}
