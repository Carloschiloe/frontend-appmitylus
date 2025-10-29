// Adapter: Calendario de Interacciones (solo lectura + colapsables por día)
// No modifica /spa-mmpp/mmpp-calendario.js y no afecta tu otra vista.

function mapInteraccionesToAsignaciones(items){
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

/* =========================  Estilos con scope local  ========================= */
function injectScopedStyles(root, maxVisible = 3){
  const id = 'int-cal-scoped-styles';
  if (root.querySelector('#'+id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    /* Todo dentro de #mmppCalendario para no afectar otras vistas */
    #mmppCalendario .int-day {
      position: relative;
      padding-bottom: 34px; /* espacio para el botón */
    }
    #mmppCalendario .int-day .int-day-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
      transition: max-height .18s ease;
    }
    #mmppCalendario .int-day .int-fade {
      position: absolute;
      left: 0; right: 0; bottom: 34px;
      height: 30px;
      pointer-events: none;
      background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,.92));
      display: none;
    }
    #mmppCalendario .int-day[data-collapsed="1"] .int-fade { display:block; }

    #mmppCalendario .int-toggle {
      position: absolute;
      left: 8px; right: 8px; bottom: 6px;
      display: none; /* sólo si hay overflow */
      justify-content: center; align-items: center;
      height: 26px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #fff;
      font-size: 12px; font-weight: 600; color: #334155;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(2,6,23,.06);
    }
    #mmppCalendario .int-toggle:hover { background:#f8fafc; }

    /* Compactar ligeramente las tarjetas del calendario en esta vista */
    #mmppCalendario .card .card-content{ padding:10px 12px; }
    #mmppCalendario .card .card-title{ margin-bottom:4px; font-size:14px; line-height:1.2; }
    #mmppCalendario .card p{ margin:0; line-height:1.25; font-size:12px; }
  `;
  root.appendChild(s);
  root.__INT_MAX_VISIBLE = Number(maxVisible);
}

/* ====== Helpers para encontrar “días” y “tarjetas” sin conocer la estructura ====== */
function getEventCards(calRoot){
  // En tu UI las tarjetas son Materialize .card → usamos eso.
  return Array.from(calRoot.querySelectorAll('.card'));
}

function bucketCardsByDay(calRoot, cards){
  // Regresamos un Map<dayElement, card[]>, usando como “día” el contenedor padre más estable.
  const buckets = new Map();
  const limitUp = 6; // no subimos más de 6 niveles
  cards.forEach(card => {
    let day = card.parentElement;
    let steps = 0;
    // Subimos hasta encontrar un contenedor que agrupe varias cards
    // Heurística: el padre cuyo número de .card hijos sea >= el actual bucket de ese nivel
    // o hasta topar con el contenedor bajo #mmppCalendario.
    while (day && steps < limitUp && day !== calRoot){
      const siblingsCards = day.querySelectorAll(':scope > .card');
      if (siblingsCards.length > 0) break;
      steps++; day = day.parentElement;
    }
    if (!day || day === calRoot) day = card.parentElement || calRoot;

    if (!buckets.has(day)) buckets.set(day, []);
    buckets.get(day).push(card);
  });
  return buckets;
}

function makeDayCollapsible(dayEl, cards, maxVisible){
  if (!dayEl || dayEl.__int_done) return;
  dayEl.__int_done = true;
  dayEl.classList.add('int-day');

  // Crear el contenedor-línea si no existe
  let list = dayEl.querySelector(':scope > .int-day-list');
  if (!list){
    list = document.createElement('div');
    list.className = 'int-day-list';
    // mover SOLO las cards que detectamos como “del día”
    cards.forEach(c => {
      if (c.parentElement !== list) list.appendChild(c);
    });
    dayEl.appendChild(list);
  }

  // Fade
  let fade = dayEl.querySelector(':scope > .int-fade');
  if (!fade){
    fade = document.createElement('div');
    fade.className = 'int-fade';
    dayEl.appendChild(fade);
  }

  // Botón
  let toggle = dayEl.querySelector(':scope > .int-toggle');
  if (!toggle){
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'int-toggle';
    toggle.textContent = 'Ver más';
    dayEl.appendChild(toggle);
  }

  function relayout(){
    const n = Math.max(0, Number(maxVisible || 3));
    const total = list.children.length;
    if (total <= n){
      dayEl.dataset.collapsed = '0';
      list.style.maxHeight = 'none';
      toggle.style.display = 'none';
      return;
    }

    // calcular altura de las primeras n cards
    let h = 0;
    const first = Array.from(list.children).slice(0, n);
    first.forEach(el => { h += el.getBoundingClientRect().height; });
    const GAP = 8;
    h += GAP * Math.max(0, n - 1);
    h = Math.max(64, Math.round(h));

    const collapsed = dayEl.dataset.collapsed !== '0';
    dayEl.dataset.collapsed = collapsed ? '1' : '0';
    list.style.maxHeight = collapsed ? (h + 'px') : '9999px';
    toggle.textContent = collapsed ? 'Ver más' : 'Ver menos';
    toggle.style.display = 'flex';
  }

  toggle.onclick = () => {
    dayEl.dataset.collapsed = (dayEl.dataset.collapsed === '1') ? '0' : '1';
    relayout();
  };

  // Inicial + si cambia de tamaño
  relayout();
  new ResizeObserver(()=>relayout()).observe(list);
}

function enhanceCalendarOnce(container){
  injectScopedStyles(container, 3); // ← muestra 3 por día (ajusta aquí)

  const calRoot = container.querySelector('#mmppCalendario');
  if (!calRoot) return;

  const apply = () => {
    const cards = getEventCards(calRoot);
    if (!cards.length) return;

    // agrupar por “día”
    const buckets = bucketCardsByDay(calRoot, cards);

    // Para cada día, crear colapsable (pero sólo si tiene > 1 tarjeta)
    buckets.forEach((cards, dayEl) => {
      if (cards.length === 0) return;
      makeDayCollapsible(dayEl, cards, container.__INT_MAX_VISIBLE || 3);
    });
  };

  // primera pasada (tras el mount del calendario)
  apply();

  // observar cambios (navegación de mes, re-render interno)
  const mo = new MutationObserver(() => apply());
  mo.observe(calRoot, { childList: true, subtree: true });

  // por si el calendario termina de pintar asíncronamente
  setTimeout(apply, 60);
  setTimeout(apply, 180);
}

/* =========================  Montaje principal  ========================= */
export function mountCalendar(containerEl, interacciones){
  containerEl.innerHTML = '<div id="mmppCalendario"></div>';

  const asignaciones = mapInteraccionesToAsignaciones(interacciones);

  const prevApi = window.MMppApi;
  window.MMppApi = {
    getDisponibilidades: () => Promise.resolve([]),
    getAsignaciones:    () => Promise.resolve(asignaciones),
    crearAsignacion:  () => Promise.reject({ __status: 405, error: 'Solo lectura' }),
    editarAsignacion: () => Promise.reject({ __status: 405, error: 'Solo lectura' }),
    borrarAsignacion: () => Promise.reject({ __status: 405, error: 'Solo lectura' })
  };

  if (window.MMppCalendario && typeof window.MMppCalendario.mount === 'function'){
    window.MMppCalendario.mount({ capacidadCamion: 10 });
  } else {
    // Fallback mínimo si no cargó el script del calendario
    const items = asignaciones.map(a => {
      const f = new Date(a.destFecha).toLocaleString('es-CL');
      const txt = [a.__tipo, a.proveedorNombre, a.centroCodigo].filter(Boolean).join(' · ');
      return `<li>${f} — ${txt} (${a.tons||0} t)</li>`;
    }).join('');
    containerEl.innerHTML = `
      <div id="mmppCalendario">
        <div class="card"><div class="card-content">
          <h6 style="margin:0 0 8px;">Calendario</h6>
          <ul style="margin:0;list-style:none;padding-left:0">${items}</ul>
        </div></div>
      </div>`;
  }

  // bloquea dblclick (no abrir modales de asignaciones)
  const stopper = (e) => { e.stopPropagation(); e.preventDefault(); };
  containerEl.addEventListener('dblclick', stopper, true);

  // Mejora UI: colapsables por día
  enhanceCalendarOnce(containerEl);

  // Limpieza del API global al salir de la pestaña (opcional)
  const tab = containerEl.closest('#tab-interacciones');
  if (tab){
    const onHide = () => { window.MMppApi = prevApi; };
    tab.addEventListener('mmpp:tab-hide', onHide, { once: true });
  }
}
