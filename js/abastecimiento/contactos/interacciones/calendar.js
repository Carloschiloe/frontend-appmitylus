// Adapter para reutilizar el calendario de MMPP como visor de Interacciones
// => NO modifica /spa-mmpp/mmpp-calendario.js
// => Todo queda scopeado a #tab-interacciones para no afectar otras vistas

/* ==================== estilos SOLO para esta pestaña ==================== */
(function injectScopedStyles(){
  if (document.getElementById('int-cal-scoped-styles')) return;
  const s = document.createElement('style');
  s.id = 'int-cal-scoped-styles';
  s.textContent = `
  /* Contenedor del calendario de interacciones */
  #tab-interacciones #mmppCalendario{ margin-top:8px; }

  /* Encabezados de días más compactos */
  #tab-interacciones #mmppCalendario .cal-grid .day .day-head{
    padding:6px 10px !important;
    font-size:12px !important;
    line-height:1.1 !important;
  }

  /* Cuerpo del día: aire y scroll desactivado (usamos colapsado/expandido) */
  #tab-interacciones #mmppCalendario .cal-grid .day .day-body{
    padding:8px !important;
    overflow: visible !important;
  }

  /* Tarjetas dentro del día (ajuste visual) */
  #tab-interacciones #mmppCalendario .cal-grid .day .day-body .card,
  #tab-interacciones #mmppCalendario .cal-grid .day .day-body .tarjeta{
    margin:6px 0 !important;
    border-radius:10px !important;
  }

  /* Botón ver más/menos */
  #tab-interacciones #mmppCalendario .day .more-toggle{
    display:flex !important;
    align-items:center;
    justify-content:center;
    margin-top:6px;
    width:100%;
    border:1px dashed #e5e7eb;
    border-radius:10px;
    padding:6px 8px;
    font-size:12px;
    color:#334155;
    background:#f8fafc;
    cursor:pointer;
    user-select:none;
  }

  /* Estado colapsado: ocultamos tarjetas extra con una clase, no con display:none inline */
  #tab-interacciones #mmppCalendario .day .day-body .is-extra{ display:none !important; }
  #tab-interacciones #mmppCalendario .day.expanded .day-body .is-extra{ display:block !important; }
  `;
  document.head.appendChild(s);
})();

/* ==================== mapeo de datos ==================== */
function mapInteraccionesToAsignaciones(items){
  // Solo interacciones con fecha programada (futura o pasada)
  return (items || [])
    .filter(i => i && (i.fechaProx || i.proximoPasoFecha))
    .map(i => {
      const fecha = i.fechaProx || i.proximoPasoFecha;
      const d = new Date(fecha);
      return {
        id: i._id || null,
        destFecha: d.toISOString(),
        destDia: d.getDate(),
        destMes: d.getMonth() + 1,
        destAnio: d.getFullYear(),
        proveedorNombre: i.proveedorNombre || i.contactoNombre || '—',
        proveedorKey: i.proveedorKey || i.proveedorId || '',
        centroCodigo: i.centroCodigo || '',
        comuna: i.comuna || '',
        tons: Number(i.tonsConversadas || 0),
        estado: i.estado || 'agendado',
        transportistaNombre: i.responsable || i.responsablePG || '—',
        __source: 'interaccion',
        __tipo: i.proximoPaso || i.tipo || 'Interacción'
      };
    });
}

/* ==================== mejora de UX: colapsar/expandir por día ==================== */
function enhanceCalendarDays(container){
  // El grid de días lo expone tu calendario con id #calDays
  const grid = container.querySelector('#calDays');
  if (!grid) return;

  // Helper para una celda día
  const getDayParts = (dayEl) => {
    // Soportar variaciones: .day-body o .body
    const body = dayEl.querySelector('.day-body, .body') || dayEl;
    // Tarjetas: tu calendario usa .card; mantenemos fallback a .tarjeta por si acaso
    const cards = Array.from(body.querySelectorAll('.card, .tarjeta'));
    return { body, cards };
  };

  // Aplica colapsado en el grid actual
  Array.from(grid.querySelectorAll('.day')).forEach(dayEl => {
    const { body, cards } = getDayParts(dayEl);
    if (!cards.length) return;

    // Limpieza por si venimos de otro mes
    dayEl.classList.remove('expanded');
    cards.forEach(c => c.classList.remove('is-extra'));
    const oldBtn = dayEl.querySelector('.more-toggle');
    if (oldBtn && oldBtn.parentNode) oldBtn.parentNode.removeChild(oldBtn);

    const VISIBLE = 3; // <-- cuantos mostrar “a la vista”
    if (cards.length <= VISIBLE) return;

    // marcar extras
    cards.slice(VISIBLE).forEach(c => c.classList.add('is-extra'));

    // botón ver más/menos
    const btn = document.createElement('div');
    btn.className = 'more-toggle';
    btn.textContent = `Ver ${cards.length - VISIBLE} más`;
    btn.addEventListener('click', () => {
      const expanded = dayEl.classList.toggle('expanded');
      btn.textContent = expanded ? 'Ver menos' : `Ver ${cards.length - VISIBLE} más`;
    });
    body.appendChild(btn);
  });
}

/* ==================== montaje principal ==================== */
export function mountCalendar(containerEl, interacciones){
  // contenedor que espera tu calendario
  containerEl.innerHTML = '<div id="mmppCalendario"></div>';
  const scopedContainer = containerEl.querySelector('#mmppCalendario');

  // API fake SOLO para este montaje (aislado)
  const prevApi = window.MMppApi;
  const asignaciones = mapInteraccionesToAsignaciones(interacciones);

  window.MMppApi = {
    getDisponibilidades: () => Promise.resolve([]),
    getAsignaciones:    () => Promise.resolve(asignaciones),
    crearAsignacion:  () => Promise.reject({ __status: 405, error: 'Solo lectura' }),
    editarAsignacion: () => Promise.reject({ __status: 405, error: 'Solo lectura' }),
    borrarAsignacion: () => Promise.reject({ __status: 405, error: 'Solo lectura' })
  };

  // monta tu calendario
  if (window.MMppCalendario && typeof window.MMppCalendario.mount === 'function'){
    window.MMppCalendario.mount({ capacidadCamion: 10 });
  } else {
    // Fallback mínimo si no cargó el JS del calendario
    scopedContainer.innerHTML = `
      <div class="card"><div class="card-content">
        <h6 style="margin:0 0 8px;">Calendario</h6>
        <ul style="margin:0;list-style:none;padding-left:0">
          ${asignaciones.map(a => {
            const f = new Date(a.destFecha).toLocaleString('es-CL');
            const txt = [a.__tipo, a.proveedorNombre, a.centroCodigo].filter(Boolean).join(' · ');
            return `<li>${f} — ${txt} (${a.tons||0} t)</li>`;
          }).join('')}
        </ul>
      </div></div>`;
  }

  // aplicar colapsado cuando el calendario haya pintado los días
  // pequeño delay para esperar el render sin tocar la lib
  setTimeout(() => enhanceCalendarDays(scopedContainer), 0);

  // Re-aplicar al navegar de mes
  const hook = () => setTimeout(() => enhanceCalendarDays(scopedContainer), 0);
  const prevBtn = scopedContainer.querySelector('#calPrev');
  const nextBtn = scopedContainer.querySelector('#calNext');
  if (prevBtn) prevBtn.addEventListener('click', hook);
  if (nextBtn) nextBtn.addEventListener('click', hook);

  // bloquear doble click (solo lectura)
  const stopper = (e) => { e.stopPropagation(); e.preventDefault(); };
  const days = scopedContainer.querySelector('#calDays');
  if (days) days.addEventListener('dblclick', stopper, true);

  // limpiar API al salir de la pestaña (opcional)
  const tab = containerEl.closest('#tab-interacciones');
  if (tab){
    const onHide = () => { window.MMppApi = prevApi; };
    tab.addEventListener('mmpp:tab-hide', onHide, { once: true });
  }
}
