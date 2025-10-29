// Adapter para reutilizar el calendario de MMPP como visor de Interacciones
// ✔ No modifica /spa-mmpp/mmpp-calendario.js
// ✔ Cambios sólo visibles en la pestaña Interacciones (estilos con scope local)

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

// ======== util: CSS con scope al contenedor ========
function injectScopedStyles(root, maxVisible = 3){
  const STYLE_ID = 'int-cal-collapsible-styles';
  if (root.querySelector('#'+STYLE_ID)) return;

  const s = document.createElement('style');
  s.id = STYLE_ID;
  // TODO: afiná selectores si tu /spa-mmpp/ cambia sus clases.
  // Usamos selectores tolerantes para no acoplar fuerte.
  s.textContent = `
    /* Scope local al calendario de Interacciones */
    #mmppCalendario .int-cal-day {
      position: relative;
    }
    #mmppCalendario .int-cal-day .int-cal-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: max-height .18s ease;
      overflow: hidden;
    }
    /* Gradiente sutil cuando está colapsado */
    #mmppCalendario .int-cal-day[data-collapsed="1"] .int-cal-fade {
      content:'';
      position: absolute;
      left: 0; right: 0; bottom: 40px;
      height: 32px;
      pointer-events: none;
      background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,.9));
    }
    #mmppCalendario .int-cal-toggle {
      position: absolute;
      left: 8px; right: 8px; bottom: 6px;
      display: none; /* se muestra solo cuando hay overflow */
      justify-content: center;
      align-items: center;
      height: 28px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #fff;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(2,6,23,.06);
    }
    #mmppCalendario .int-cal-toggle:hover { background:#f8fafc; }
    /* Cabecera de días un poco más compacta y centrada */
    #mmppCalendario .int-cal-weekday {
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; letter-spacing:.2px;
    }
  `;
  root.appendChild(s);

  // Guardamos config para usarla al calcular altura colapsada
  root.__INT_CAL_MAX_VISIBLE = Number(maxVisible);
}

// ======== util: detectar “columnas/días” y “tarjetas/eventos” con tolerancia ========
function guessDayColumns(root){
  // prioridad por ids conocidos
  const daysById = root.querySelector('#calDays');
  if (daysById) {
    // hijos directos de #calDays suelen ser columnas/días
    return Array.from(daysById.children);
  }
  // alternativa: elementos con data-atributos o clases "day"
  const candidates = root.querySelectorAll('[data-day], .cal-day, .mmpp-cal-day, .day');
  if (candidates.length) return Array.from(candidates);
  // fallback: columnas dentro de una grilla
  const grids = root.querySelectorAll('[class*="grid"], [class*="cal"], [class*="semana"]');
  let best = [];
  grids.forEach(g=>{
    const kids = Array.from(g.children || []).filter(el => el.children && el.children.length);
    if (kids.length > best.length) best = kids;
  });
  return best;
}

function findCardsInDay(dayEl){
  // Ajusta esta lista si tus tarjetas cambian de clase
  const selectors = [
    '.cal-card', '.mmpp-card', '.card', '.evt', '.evento', '[data-card]', 'li'
  ];
  let cards = [];
  for (const sel of selectors){
    const found = dayEl.querySelectorAll(sel);
    if (found.length) { cards = Array.from(found); break; }
  }
  // Si nada matchea, tomamos todos los hijos “visibles” que no sean el header del día
  if (!cards.length) {
    cards = Array.from(dayEl.children).filter(el => {
      const style = getComputedStyle(el);
      return style.display !== 'none' && el.textContent.trim().length > 0;
    });
    // quita el primer hijo si parece ser cabecera del día (número)
    if (cards.length && /^\d+$/.test(cards[0].textContent.trim())) cards.shift();
  }
  return cards;
}

// ======== convierte un día en colapsable ========
function makeDayCollapsible(dayEl, maxVisible){
  if (!dayEl || dayEl.__int_cal_done) return;
  dayEl.__int_cal_done = true;

  // contenedor lógico del día
  dayEl.classList.add('int-cal-day');

  // agrupa tarjetas en una lista lógica
  let list = dayEl.querySelector(':scope > .int-cal-list');
  if (!list){
    list = document.createElement('div');
    list.className = 'int-cal-list';
    // movemos todas las “tarjetas” detectadas a la lista
    const cards = findCardsInDay(dayEl);
    cards.forEach(c => list.appendChild(c));
    dayEl.appendChild(list);
  }

  // botón toggle
  let toggle = dayEl.querySelector(':scope > .int-cal-toggle');
  if (!toggle){
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'int-cal-toggle';
    toggle.textContent = 'Ver más';
    dayEl.appendChild(toggle);
  }

  // fade
  let fade = dayEl.querySelector(':scope > .int-cal-fade');
  if (!fade){
    fade = document.createElement('div');
    fade.className = 'int-cal-fade';
    dayEl.appendChild(fade);
  }

  function relayout(){
    const cards = list.children.length;
    const n = Math.max(0, Number(maxVisible || 3));
    if (cards <= n){
      // sin overflow
      dayEl.dataset.collapsed = '0';
      list.style.maxHeight = 'none';
      toggle.style.display = 'none';
      return;
    }

    // estimamos alto colapsado = altura de primeras N tarjetas + gaps
    // medimos temporalmente
    let h = 0;
    const orig = Array.from(list.children).slice(0, n);
    orig.forEach(el => { h += el.getBoundingClientRect().height; });
    const gap = 8; // mismo gap que en CSS
    h += gap * Math.max(0, n - 1);
    h = Math.max(64, Math.round(h));

    // aplica modo colapsado por defecto
    dayEl.dataset.collapsed = dayEl.dataset.collapsed ?? '1';
    const collapsed = dayEl.dataset.collapsed === '1';
    list.style.maxHeight = collapsed ? (h + 'px') : '9999px';
    toggle.textContent = collapsed ? 'Ver más' : 'Ver menos';
    toggle.style.display = 'flex';
  }

  toggle.onclick = () => {
    dayEl.dataset.collapsed = (dayEl.dataset.collapsed === '1') ? '0' : '1';
    relayout();
  };

  // relayout inicial y cuando cambie el tamaño
  relayout();
  new ResizeObserver(()=>relayout()).observe(list);
}

// ======== aplica colapsables a todos los días (y re-aplica en cambios) ========
function enhanceCalendar(root){
  injectScopedStyles(root, 3); // ← muestra 3 tarjetas por día; cambia a gusto

  const applyAll = () => {
    const cont = root.querySelector('#mmppCalendario');
    if (!cont) return;
    const days = guessDayColumns(cont);
    days.forEach(d => makeDayCollapsible(d, root.__INT_CAL_MAX_VISIBLE || 3));
  };

  // primera pasada
  applyAll();

  // observa re-render del calendario (cambio de mes, etc.)
  const obs = new MutationObserver(()=>applyAll());
  const calRoot = root.querySelector('#mmppCalendario') || root;
  obs.observe(calRoot, { childList:true, subtree:true });
}

// ======== monta el calendario en modo solo lectura y mejora de UI ========
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
    // Fallback mínimo si el JS del calendario no cargó
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

  // Evita que el dblclick abra modales del calendario original
  const stopper = (e) => { e.stopPropagation(); e.preventDefault(); };
  const days = containerEl.querySelector('#calDays');
  if (days) days.addEventListener('dblclick', stopper, true);

  // Mejora de UI: colapsables por día
  enhanceCalendar(containerEl);

  // Limpieza del API global al salir de la pestaña
  const tab = containerEl.closest('#tab-interacciones');
  if (tab){
    const onHide = () => { window.MMppApi = prevApi; };
    tab.addEventListener('mmpp:tab-hide', onHide, { once: true });
  }
}
