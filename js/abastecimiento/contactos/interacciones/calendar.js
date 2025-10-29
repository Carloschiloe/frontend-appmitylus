// Adapter para reutilizar el calendario de MMPP como visor de Interacciones
// NO modifica tu /spa-mmpp/mmpp-calendario.js
// Mejora: colapsar/expandir eventos por día (sin scroll), aislado a #mmppCalendario

function mapInteraccionesToAsignaciones(items){
  // Toma solo interacciones con fecha futura programada
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

        // El calendario agrupa/rotula con "transportista"
        transportistaNombre: i.responsable || '—',

        __source: 'interaccion',
        __tipo: i.proximoPaso || i.tipo || 'Interacción'
      };
    });
}

export function mountCalendar(containerEl, interacciones){
  // 1) contenedor que espera tu calendario (aislado por id)
  containerEl.innerHTML = '<div id="mmppCalendario"></div>';

  // 2) API fake SOLO para este montaje (read-only)
  const asignaciones = mapInteraccionesToAsignaciones(interacciones);
  const prevApi = window.MMppApi;

  window.MMppApi = {
    getDisponibilidades: () => Promise.resolve([]),
    getAsignaciones:    () => Promise.resolve(asignaciones),

    crearAsignacion:  () => Promise.reject({ __status: 405, error: 'Solo lectura' }),
    editarAsignacion: () => Promise.reject({ __status: 405, error: 'Solo lectura' }),
    borrarAsignacion: () => Promise.reject({ __status: 405, error: 'Solo lectura' })
  };

  // 3) monta tu calendario real
  if (window.MMppCalendario && typeof window.MMppCalendario.mount === 'function'){
    window.MMppCalendario.mount({ capacidadCamion: 10 });
  } else {
    // Fallback mínimo si no cargó el JS principal
    containerEl.innerHTML = `
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

  // 4) bloquear dblclick (no abrir modales de asignaciones)
  const stopper = (e) => { e.stopPropagation(); e.preventDefault(); };
  const daysRoot = containerEl.querySelector('#calDays');
  if (daysRoot) daysRoot.addEventListener('dblclick', stopper, true);

  // 5) navegación de mes (si tu calendario la emite por #calPrev/#calNext)
  const hookNav = () => {
    // Nada que recargar: usamos los mismos datos (solo lectura).
    // Reaplicamos el colapsado, por si redibujó el grid.
    requestAnimationFrame(() => applyExpandableDays(containerEl));
  };
  const prevBtn = containerEl.querySelector('#calPrev');
  const nextBtn = containerEl.querySelector('#calNext');
  if (prevBtn) prevBtn.addEventListener('click', hookNav);
  if (nextBtn) nextBtn.addEventListener('click', hookNav);

  // 6) limpia API global cuando se esconda la pestaña (opcional)
  const tab = containerEl.closest('#tab-interacciones');
  if (tab){
    const onHide = () => { window.MMppApi = prevApi; };
    tab.addEventListener('mmpp:tab-hide', onHide, { once: true });
  }

  // 7) inyecta estilos y aplica colapsado por día (sin afectar otras vistas)
  injectExpandStyles();
  // pequeño delay por si el calendario dibuja asíncrono
  setTimeout(() => applyExpandableDays(containerEl), 0);
}

/* ==========================
   Expand/Collapse por día
   ========================== */

/**
 * Inyecta CSS con ámbito #mmppCalendario para no interferir con otras vistas.
 * Regla: .day.collapsed oculta a partir del 4° evento (configurable desde JS).
 */
function injectExpandStyles(){
  if (document.getElementById('mmpp-cal-expand-styles')) return;
  const css = `
  #mmppCalendario .cal-day, 
  #mmppCalendario .day { position: relative; }

  /* Botón “ver más / ocultar” */
  #mmppCalendario .day-toggle {
    display:inline-flex; align-items:center; gap:6px;
    border:1px solid #e2e8f0; background:#fff; border-radius:10px;
    font-size:12px; padding:2px 8px; cursor:pointer;
    color:#334155; /* slate-700 */
    margin-top:6px;
  }
  #mmppCalendario .day-toggle:hover { background:#f8fafc; }

  /* Colapsado: oculta tarjetas a partir de N (se controla vía data-max-visible) */
  #mmppCalendario .day.collapsed ._evt:nth-of-type(n+var(--_maxVisiblePlusOne)) { display:none !important; }

  /* Etiqueta “+N más” (si prefieres usar pseudo en vez de botón, dejamos el botón real) */
  `;

  const s = document.createElement('style');
  s.id = 'mmpp-cal-expand-styles';
  s.textContent = css;
  document.head.appendChild(s);
}

/**
 * Marca y mejora cada día:
 * - Detecta tarjetas de evento con selectores flexibles.
 * - Si hay más de maxVisible, deja el día en .collapsed y agrega botón toggle.
 * - No altera alturas ni hace scroll.
 */
function applyExpandableDays(root, maxVisible = 3){
  const calendar = root.querySelector('#mmppCalendario');
  if (!calendar) return;

  // al no conocer la estructura exacta del calendario, usamos selectores tolerantes
  // day: #calDays > .day | .cal-day
  const dayEls = calendar.querySelectorAll('#calDays > .day, #calDays > .cal-day, #mmppCalendario .day');

  dayEls.forEach(day => {
    // Evitar duplicar botones si el grid se re-dibuja
    const oldBtn = day.querySelector('.day-toggle');
    if (oldBtn) oldBtn.remove();

    // Construimos lista de "tarjetas" (selectores comunes en tu calendario)
    const cards = day.querySelectorAll(
      '.evt, .event, .asig-card, .mmpp-asig, .card, [data-asig-id]'
    );

    // Normalizamos: marcamos cada tarjeta con clase interna _evt para poder colapsar por CSS
    cards.forEach(c => { if (!c.classList.contains('_evt')) c.classList.add('_evt'); });

    const count = cards.length;
    if (count <= maxVisible) {
      day.classList.remove('collapsed');
      day.style.setProperty('--_maxVisiblePlusOne', String(maxVisible+1));
      return;
    }

    // Seteamos variable CSS para :nth-of-type(n+X)
    day.style.setProperty('--_maxVisiblePlusOne', String(maxVisible+1));
    day.classList.add('collapsed');

    // Botón toggle
    const btn = document.createElement('button');
    btn.className = 'day-toggle';
    btn.type = 'button';
    btn.textContent = `+${count - maxVisible} más`;
    btn.addEventListener('click', () => {
      const expanded = !day.classList.contains('collapsed');
      if (expanded){
        // estaba expandido -> colapsar
        day.classList.add('collapsed');
        btn.textContent = `+${count - maxVisible} más`;
      } else {
        day.classList.remove('collapsed');
        btn.textContent = 'Ocultar';
      }
    });

    // Insertamos el botón al final del contenedor de tarjetas, o del día
    const cardsParent =
      (cards[0] && cards[0].parentElement) ? cards[0].parentElement : day;
    cardsParent.appendChild(btn);
  });
}
