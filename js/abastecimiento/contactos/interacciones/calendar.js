import { toCalendarEvent } from './normalizers.js';
import { openInteraccionModal } from './modal.js';

export function mountCalendar(el, interacciones){
  // 1) Convertir tus docs -> eventos del calendario
  //    (formato canónico: { id, title, start, end, color, data })
  const events = interacciones.map(toCalendarEvent).map(e => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end || e.start,
    color: e.color,
    data: e.meta   // guardo toda la interacción por si el calendario la reenvía en onClick
  }));

  // 2) Intentar usar tu calendario sin tocarlo (varios contratos típicos)
  //    A) API estilo objeto con mount()
  if (window.MmppCalendar && typeof window.MmppCalendar.mount === 'function'){
    window.MmppCalendar.mount(el, {
      view: 'month',
      events,
      selectable: false,
      onEventClick: (ev) => handleEventClick(ev?.data || ev),
    });
    return;
  }

  //    B) API global initMmppCalendar(container, options)
  if (typeof window.initMmppCalendar === 'function'){
    window.initMmppCalendar(el, {
      defaultView: 'month',
      events,
      onClickEvent: (ev) => handleEventClick(ev?.data || ev),
    });
    return;
  }

  //    C) API de clase: new MmppCalendar(container, opts)
  if (window.MmppCalendar && typeof window.MmppCalendar === 'function'){
    try{
      const cal = new window.MmppCalendar(el, {
        view: 'month',
        events,
        onEventClick: (ev) => handleEventClick(ev?.data || ev),
      });
      if (cal && typeof cal.render === 'function') cal.render();
      return;
    }catch(e){}
  }

  // 3) Fallback ultra simple (por si no detectamos el API público)
  el.innerHTML = `
    <div class="card"><div class="card-content">
      <h6 style="margin:0 0 8px;">Calendario (vista simple)</h6>
      <ul style="margin:0;list-style:none;padding-left:0">
        ${events.map(e => `<li>${fmt(e.start)} — ${esc(e.title)}</li>`).join('')}
      </ul>
    </div></div>
  `;

  function handleEventClick(meta){
    if (!meta) return;
    // Abre el modal en modo edición con la data de la interacción
    openInteraccionModal({ preset: meta, onSaved: ()=>{} });
  }
}

function fmt(iso){ if(!iso) return ''; const d=new Date(iso); return d.toLocaleString('es-CL'); }
function esc(s){ return String(s||'').replace(/[<>&]/g,c=>({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c])); }
