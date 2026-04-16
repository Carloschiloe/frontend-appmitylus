// /js/abastecimiento/contactos/calendario-tab.js
// Calendario unificado: Interacciones + Visitas + Muestreos

import { escapeHtml, debounce } from './ui-common.js';
import { state } from './state.js';
import { list as listInteracciones } from './interacciones/api.js';
import { list as listVisitas } from '../visitas/api.js';
import { listMuestreos } from './muestreo-api.js';

const esc = escapeHtml;

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_SH = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function norm(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function pad2(n) { return String(n).padStart(2, '0'); }

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function ymKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function parseDateSafe(v) {
  if (!v) return null;
  const d = (v instanceof Date) ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addMonths(d, delta) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + delta, 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function mondayStartGrid(monthStart) {
  const x = startOfMonth(monthStart);
  // Monday=0 ... Sunday=6
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

function monthLabel(d) {
  return `${MONTHS_SH[d.getMonth()]} ${d.getFullYear()}`;
}

function toRange(d) {
  const from = startOfMonth(d);
  const to = addMonths(from, 1);
  return { from, to };
}

function isSameDay(a, b) {
  return a && b && ymd(a) === ymd(b);
}

const TYPE_META = {
  interaccion: { icon: 'bi-chat-left-dots-fill', color: '#a78bfa' },
  llamada:     { icon: 'bi-telephone-fill',      color: '#a78bfa' },
  reunion:     { icon: 'bi-people-fill',         color: '#fbbf24' },
  tarea:       { icon: 'bi-check-square-fill',   color: '#34d399' },
  muestra:     { icon: 'bi-eyedropper',          color: '#c4b5fd' }, // interaccion tipo "muestra"
  visita:      { icon: 'bi-geo-alt-fill',        color: '#7dd3fc' },
  muestreo:    { icon: 'bi-eyedropper-fill',     color: '#fca5a5' },
  muestras:    { icon: 'bi-eyedropper',          color: '#fca5a5' }, // "Tomar muestras" (agenda)
  otro:        { icon: 'bi-three-dots',          color: '#94a3b8' },
};

function metaFor(key) {
  return TYPE_META[key] || TYPE_META.otro;
}

function labelTipoInteraccion(tipo = '') {
  const t = norm(tipo);
  if (t === 'llamada') return 'Llamada';
  if (t === 'reunion') return 'Reunión';
  if (t === 'tarea') return 'Compromiso';
  if (t === 'muestra') return 'Muestra';
  if (t === 'visita') return 'Visita';
  return 'Interacción';
}

function isTomarMuestras(paso = '') {
  const p = norm(paso);
  return p.includes('muestra');
}

function buildSubtitle({ proveedorNombre = '', contactoNombre = '', centroCodigo = '' } = {}) {
  const prov = String(proveedorNombre || '').trim();
  const cont = String(contactoNombre || '').trim();
  const centro = String(centroCodigo || '').trim();
  const left = prov || cont || '-';
  const right = centro ? `Centro ${centro}` : '';
  return right ? `${left} · ${right}` : left;
}

function chipHtml(ev) {
  const meta = metaFor(ev.kind);
  const style = `border-left:4px solid ${meta.color};`;
  const subtitle = ev.subtitle ? `<span class="s">${esc(ev.subtitle)}</span>` : '';
  return `
    <button type="button" class="cal-chip" style="${style}"
      data-cal-open="1"
      data-day="${esc(ev.day)}"
      data-kind="${esc(ev.kind)}"
      data-id="${esc(ev.id)}"
      data-parent-kind="${esc(ev.parentKind || '')}"
      data-parent-id="${esc(ev.parentId || '')}">
      <i class="bi ${meta.icon}"></i>
      <span class="txt">
        <span class="t" title="${esc(ev.title)}">${esc(ev.title)}</span>
        ${subtitle}
      </span>
    </button>
  `.trim();
}

function nonEmpty(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : '';
}

function fmtDT(v) {
  const d = parseDateSafe(v);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function fmtDateOnly(v) {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = parseDateSafe(v);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pct1(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `${n.toFixed(1)} %`;
}

function kvHtml(pairs) {
  const rows = (pairs || []).filter((p) => p && nonEmpty(p.v));
  if (!rows.length) return '';
  return `
    <div class="cal-kv">
      ${rows.map((p) => `
        <div class="r">
          <div class="k">${esc(p.k)}</div>
          <div class="v">${esc(String(p.v))}</div>
        </div>
      `.trim()).join('')}
    </div>
  `.trim();
}

function drawerEventHtml(ev, idx = 0, focusKey = '', currentMode = 'agenda') {
  const meta = metaFor(ev.kind);
  const raw = ev.raw || {};
  const displayKind = (ev.kind === 'muestras' && ev.parentKind) ? ev.parentKind : ev.kind;
  const evKey = `${ev.kind}::${ev.id}`;

  const proveedor = nonEmpty(raw.proveedorNombre || raw.proveedor || raw.empresa || raw.proveedorName);
  const contacto = nonEmpty(raw.contactoNombre || raw.contacto || raw.nombre || raw.contactoName || raw.contacto?.contactoNombre || raw.contacto?.nombre);
  const centro = nonEmpty(raw.centroCodigo || raw.centro || raw.code);

  const common = [
    { k: 'Proveedor', v: proveedor },
    { k: 'Contacto', v: contacto },
    { k: 'Centro', v: centro },
  ];

  let extra = [];
  let note = '';
  let when = '';

  if (displayKind === 'interaccion' || displayKind === 'llamada' || displayKind === 'reunion' || displayKind === 'tarea' || displayKind === 'muestra') {
    when = fmtDT(currentMode === 'agenda' ? (raw.fechaProx || raw.proximoPasoFecha) : raw.fecha);
    extra = [
      { k: 'Tipo', v: nonEmpty(raw.tipo) },
      { k: 'Fecha', v: fmtDT(raw.fecha) },
      { k: 'Responsable', v: nonEmpty(raw.responsable) },
      { k: 'Estado', v: nonEmpty(raw.estado) },
      { k: 'Próximo paso', v: nonEmpty(raw.proximoPaso) },
      { k: 'Fecha próximo paso', v: fmtDT(raw.fechaProx || raw.proximoPasoFecha) },
      { k: 'Área', v: nonEmpty(raw.areaCodigo || raw.area) },
      { k: 'Tons conversadas', v: raw.tonsConversadas != null && raw.tonsConversadas !== '' ? String(raw.tonsConversadas) : '' },
    ];
    note = nonEmpty(raw.resumen || raw.observaciones || raw.notas || raw.comentarios || raw.descripcion);
  } else if (displayKind === 'visita') {
    when = fmtDateOnly(currentMode === 'agenda' ? raw.proximoPasoFecha : raw.fecha);
    extra = [
      { k: 'Fecha', v: fmtDateOnly(raw.fecha) },
      { k: 'Estado', v: nonEmpty(raw.estado) },
      { k: 'Responsable', v: nonEmpty(raw.responsablePG || raw.responsable) },
      { k: 'Tons comprometidas', v: raw.tonsComprometidas != null && raw.tonsComprometidas !== '' ? String(raw.tonsComprometidas) : '' },
      { k: 'Próxima fecha', v: fmtDateOnly(raw.proximoPasoFecha) },
    ];
    note = nonEmpty(raw.observaciones || raw.resumen || raw.notas);
  } else if (displayKind === 'muestreo') {
    when = fmtDateOnly(raw.fecha);
    extra = [
      { k: 'Fecha', v: fmtDateOnly(raw.fecha) },
      { k: 'Línea', v: nonEmpty(raw.linea) },
      { k: 'Responsable', v: nonEmpty(raw.responsablePG || raw.responsable) },
      { k: 'Rendimiento', v: pct1(raw.rendimiento) },
      { k: 'U*Kg', v: raw.uxkg != null && raw.uxkg !== '' ? String(raw.uxkg) : '' },
      { k: 'Procesable', v: pct1(raw.procesable) },
      { k: 'Rechazos', v: pct1(raw.rechazos) },
    ];
  }

  const pairs = [...common, ...extra];
  const openAttr = (focusKey && focusKey === evKey) ? ' open' : '';

  const openAttrs = [
    'data-cal-open="1"',
    `data-kind="${esc(ev.kind)}"`,
    `data-id="${esc(ev.id)}"`,
    `data-parent-kind="${esc(ev.parentKind || '')}"`,
    `data-parent-id="${esc(ev.parentId || '')}"`,
  ].join(' ');

  return `
    <details class="cal-ev" data-ev-key="${esc(evKey)}" style="--ev-accent:${esc(meta.color)};"${openAttr}>
      <summary class="cal-ev-sum">
        <span class="cal-ev-left">
          <i class="bi ${esc(meta.icon)} cal-ev-ico" aria-hidden="true"></i>
          <span class="cal-ev-txt">
            <span class="cal-ev-title">${esc(ev.title || 'Actividad')}</span>
            <span class="cal-ev-sub">${esc([proveedor || contacto || '—', when].filter(Boolean).join(' · '))}</span>
          </span>
        </span>
        <span class="cal-ev-right">
          <button type="button" class="cal-ev-edit" ${openAttrs}>
            <i class="bi bi-pencil-square" aria-hidden="true"></i>
            <span>Editar</span>
          </button>
          <i class="bi bi-chevron-down cal-ev-chevron" aria-hidden="true"></i>
        </span>
      </summary>
      <div class="cal-ev-body">
        ${kvHtml(pairs)}
        ${note ? `<div class="cal-note">${esc(note)}</div>` : ''}
      </div>
    </details>
  `.trim();
}

function renderGridHtml(cursorMonth, eventsByDay) {
  const monthStart = startOfMonth(cursorMonth);
  const start = mondayStartGrid(monthStart);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const MAX_VISIBLE = 3;
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = ymd(d);
    const inMonth = d.getMonth() === monthStart.getMonth() && d.getFullYear() === monthStart.getFullYear();
    const items = eventsByDay.get(key) || [];
    const visible = items.slice(0, MAX_VISIBLE);
    const moreCount = Math.max(items.length - visible.length, 0);

    const cls = [
      'cal-cell',
      inMonth ? '' : 'is-outside',
      isSameDay(d, today) ? 'is-today' : '',
    ].filter(Boolean).join(' ');

    const chips = visible.map(chipHtml).join('');
    const moreBtn = moreCount
      ? `<button type="button" class="cal-more" data-cal-more="${esc(key)}">+${moreCount} más</button>`
      : '';
    const cnt = items.length ? `<span class="cnt">${items.length}</span>` : '';

    cells.push(`
      <div class="${cls}" data-cal-date="${esc(key)}">
        <div class="cal-daynum">
          <span class="n">${d.getDate()}</span>
          ${cnt}
        </div>
        <div class="cal-items">${chips}${moreBtn}</div>
      </div>
    `.trim());
  }

  return `
    <div class="cal-grid">
      <div class="cal-dow">${DOW.map((x) => `<div>${x}</div>`).join('')}</div>
      <div class="cal-cells">${cells.join('')}</div>
    </div>
  `.trim();
}

export function createCalendarioTabModule({
  openInteraccionModal,
  openMuestreoFromSeed,
} = {}) {
  let uiBound = false;
  let mounted = false;

  let cursor = startOfMonth(new Date());
  let mode = 'agenda'; // 'agenda' | 'historial'
  let view = (() => {
    try {
      const v = localStorage.getItem('calendario:view');
      return (v === 'list' || v === 'calendar') ? v : 'calendar';
    } catch {
      return 'calendar';
    }
  })(); // 'calendar' | 'list'
  let typeFilter = ''; // '' | 'interaccion' | 'visita' | 'muestreo' | 'muestras'
  let qFilter = '';

  const cache = new Map(); // key: `${mode}-${YYYY-MM}`
  let lastData = null;
  let drawer = null;
  let drawerOverlay = null;
  let drawerOpenDay = '';
  let selectedDayKey = '';
  let drawerFocus = null; // { kind, id } | null
  let globalCloseBound = false;

  const rerender = debounce(() => render(false).catch(() => {}), 80);

  function rootEl() { return document.getElementById('calendario-root'); }

  function setBusy(isBusy) {
    const root = rootEl();
    root?.querySelector('[data-cal-role="busy"]')?.toggleAttribute('hidden', !isBusy);
  }

  function fmtDayLabel(dayKey) {
    const d = parseDateSafe(dayKey);
    if (!d) return dayKey;
    return `${d.getDate()} ${MONTHS_SH[d.getMonth()]} ${d.getFullYear()}`;
  }

  function isDrawerOpen() {
    return !!(drawer && drawer.classList.contains('is-open'));
  }

  function applySelectedToGrid() {
    const root = rootEl();
    if (!root) return;
    root.querySelectorAll('.cal-cell.is-selected')?.forEach((el) => el.classList.remove('is-selected'));
    if (!selectedDayKey) return;
    const sel = root.querySelector(`.cal-cell[data-cal-date="${CSS.escape(selectedDayKey)}"]`);
    if (sel) sel.classList.add('is-selected');
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (drawerOverlay) {
      drawerOverlay.classList.remove('is-open');
      drawerOverlay.setAttribute('aria-hidden', 'true');
      drawerOverlay.toggleAttribute('hidden', true);
    }
    drawerOpenDay = '';
  }

  function ensureDrawer() {
    if (drawer && drawerOverlay) return { drawer, drawerOverlay };

    const overlay = document.createElement('div');
    overlay.className = 'cal-drawer-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.toggleAttribute('hidden', true);

    const el = document.createElement('aside');
    el.className = 'cal-drawer';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="cal-drawer-head">
        <div class="t">
          <div class="h" data-role="cal-dw-title">Día</div>
          <div class="s" data-role="cal-dw-sub">—</div>
        </div>
        <button type="button" class="cal-drawer-close" data-role="cal-dw-close" aria-label="Cerrar">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="cal-drawer-body" data-role="cal-dw-body"></div>
    `.trim();

    overlay.addEventListener('click', () => closeDrawer());

    el.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-role="cal-dw-close"]');
      if (closeBtn) { closeDrawer(); return; }
      const editBtn = e.target.closest('[data-cal-open="1"]');
      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        handleOpenFromChip(editBtn);
      }
    });

    document.body.appendChild(overlay);
    document.body.appendChild(el);

    drawer = el;
    drawerOverlay = overlay;
    return { drawer, drawerOverlay };
  }

  function renderDrawerForDay(dayKey) {
    ensureDrawer();
    if (!drawer) return;
    const events = (lastData?.events || []).filter((x) => x.day === dayKey);
    const title = fmtDayLabel(dayKey);
    const subtitle = `${events.length} actividad${events.length === 1 ? '' : 'es'} · ${mode === 'agenda' ? 'Agenda' : 'Historial'}`;

    const titleEl = drawer.querySelector('[data-role="cal-dw-title"]');
    if (titleEl) titleEl.textContent = title;
    const subEl = drawer.querySelector('[data-role="cal-dw-sub"]');
    if (subEl) subEl.textContent = subtitle;
    const body = drawer.querySelector('[data-role="cal-dw-body"]');
    if (body) {
      const focusKey = drawerFocus ? `${drawerFocus.kind}::${drawerFocus.id}` : '';
      body.innerHTML = events.map((ev, i) => drawerEventHtml(ev, i, focusKey, mode)).join('') || '<div class="cal-empty">Sin actividades.</div>';
      body.scrollTop = 0;

      // Si el usuario venía desde un chip, abrir y enfocar esa actividad
      if (focusKey && events.length) {
        const elFocus = body.querySelector(`details.cal-ev[data-ev-key="${CSS.escape(focusKey)}"]`);
        if (elFocus) {
          elFocus.setAttribute('open', '');
          try { elFocus.scrollIntoView({ block: 'nearest' }); } catch {}
        }
        drawerFocus = null;
      }
    }
  }

  function openDrawerForDay(dayKey) {
    ensureDrawer();
    selectedDayKey = dayKey;
    applySelectedToGrid();

    renderDrawerForDay(dayKey);

    if (drawerOverlay) {
      drawerOverlay.toggleAttribute('hidden', false);
      drawerOverlay.classList.add('is-open');
      drawerOverlay.setAttribute('aria-hidden', 'false');
    }
    if (drawer) {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
    }
    drawerOpenDay = dayKey;
  }

  function ensureGlobalClose() {
    if (globalCloseBound) return;
    globalCloseBound = true;

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (isDrawerOpen()) closeDrawer();
    });
  }

  function handleOpenFromChip(chip) {
    closeDrawer();
    const kind = String(chip.dataset.kind || '');
    const id = String(chip.dataset.id || '');
    const parentKind = String(chip.dataset.parentKind || '');
    const parentId = String(chip.dataset.parentId || '');

    // Buscar raw en lastData para abrir el editor con preset/seed completo.
    const ev = lastData?.events?.find((x) => x.id === id && x.kind === kind) || null;
    const raw = ev?.raw || null;

    if (kind === 'muestreo' && raw && typeof openMuestreoFromSeed === 'function') {
      openMuestreoFromSeed({
        muestreoId: raw.id || raw._id || '',
        editMode: true,
        visitaId: raw.visitaId || '',
        proveedorKey: raw.proveedorKey || '',
        proveedorNombre: raw.proveedorNombre || raw.proveedor || '',
        proveedor: raw.proveedorNombre || raw.proveedor || '',
        centroId: raw.centroId || '',
        centroCodigo: raw.centroCodigo || '',
        centro: raw.centro || raw.centroCodigo || '',
        linea: raw.linea || '',
        fecha: String(raw.fecha || '').slice(0, 10),
        responsable: raw.responsablePG || raw.responsable || '',
        responsablePG: raw.responsablePG || raw.responsable || '',
        route: raw.origen || 'terreno',
        origen: raw.origen || 'terreno',
        uxkg: raw.uxkg,
        pesoVivo: raw.pesoVivo,
        pesoCocida: raw.pesoCocida,
        rendimiento: raw.rendimiento,
        total: raw.total,
        procesable: raw.procesable,
        rechazos: raw.rechazos,
        defectos: raw.defectos,
        cats: raw.cats && typeof raw.cats === 'object' ? { ...raw.cats } : {}
      }, { route: raw.origen || 'terreno', view: 'form', mode: 'edit' });
      return;
    }

    // "Tomar muestras" abre el registro origen (visita o interaccion) en modo editar.
    const openKind = (kind === 'muestras') ? parentKind : kind;
    const openId = (kind === 'muestras') ? parentId : id;

    if (openKind === 'visita') {
      document.dispatchEvent(new CustomEvent('visita:open-edit', { detail: { id: openId } }));
      return;
    }

    if (openKind === 'interaccion' || openKind === 'llamada' || openKind === 'reunion' || openKind === 'tarea' || openKind === 'muestra' || openKind === 'otro') {
      if (!raw || typeof openInteraccionModal !== 'function') return;
      openInteraccionModal({
        preset: raw,
        onSaved: () => render(true).catch(() => {})
      });
    }
  }

  async function fetchMonthData(force = false) {
    const ym = ymKey(cursor);
    const key = `${mode}-${ym}`;
    if (!force && cache.has(key)) return cache.get(key);

    const { from, to } = toRange(cursor);
    const fromISO = ymd(from);
    const toISO = ymd(to);

    const out = { interacciones: [], visitas: [], muestreos: [] };
    try {
      if (mode === 'agenda') {
        const [intResp, visRows] = await Promise.all([
          listInteracciones({ monthProx: ym, limit: 2000 }).catch(() => ({ items: [] })),
          listVisitas({ monthProx: ym, limit: 2000 }).catch(() => ([])),
        ]);
        out.interacciones = intResp?.items || [];
        out.visitas = Array.isArray(visRows) ? visRows : [];
      } else {
        const [intResp, visRows, mus] = await Promise.all([
          listInteracciones({ from: fromISO, to: toISO, limit: 2000 }).catch(() => ({ items: [] })),
          listVisitas({ from: fromISO, to: toISO, limit: 3000 }).catch(() => ([])),
          listMuestreos({ from: fromISO, to: toISO, limit: 2000 }).catch(() => ([])),
        ]);
        out.interacciones = intResp?.items || [];
        out.visitas = Array.isArray(visRows) ? visRows : [];
        out.muestreos = Array.isArray(mus) ? mus : [];
      }
    } catch (e) {
      console.error('[calendario] fetchMonthData error', e);
    }

    // Permite abrir Visitas desde el calendario (visita:open-edit)
    // ya que el editor de visitas resuelve el registro desde state.visitasGuardadas.
    try { state.visitasGuardadas = out.visitas || []; } catch {}

    cache.set(key, out);
    return out;
  }

  function buildEvents(data) {
    const { from, to } = toRange(cursor);
    const fromT = from.getTime();
    const toT = to.getTime();

    const events = [];

    // Interacciones
    (data?.interacciones || []).forEach((it) => {
      const d = parseDateSafe(mode === 'agenda' ? (it.proximoPasoFecha || it.fechaProx || it.fechaProximo) : it.fecha);
      if (!d) return;
      const t = d.getTime();
      if (t < fromT || t >= toT) return;

      const paso = String(it.proximoPaso || '').trim();
      const isM = mode === 'agenda' && isTomarMuestras(paso);
      const kind = isM ? 'muestras' : (norm(it.tipo) || 'interaccion');

      const title = isM
        ? 'Tomar muestras'
        : (mode === 'agenda' ? (paso || labelTipoInteraccion(it.tipo)) : labelTipoInteraccion(it.tipo));

      events.push({
        day: ymd(d),
        kind,
        id: String(it._id || it.id || ''),
        title,
        subtitle: buildSubtitle(it),
        parentKind: 'interaccion',
        parentId: String(it._id || it.id || ''),
        raw: it,
      });
    });

    // Visitas
    (data?.visitas || []).forEach((v) => {
      const d = parseDateSafe(mode === 'agenda' ? v.proximoPasoFecha : v.fecha);
      if (!d) return;
      const t = d.getTime();
      if (t < fromT || t >= toT) return;

      const paso = String(v.estado || '').trim();
      const isM = mode === 'agenda' && isTomarMuestras(paso);
      const kind = isM ? 'muestras' : 'visita';

      const title = isM ? 'Tomar muestras' : (mode === 'agenda' ? (paso || 'Visita') : 'Visita terreno');

      events.push({
        day: ymd(d),
        kind,
        id: String(v._id || v.id || ''),
        title,
        subtitle: buildSubtitle(v),
        parentKind: 'visita',
        parentId: String(v._id || v.id || ''),
        raw: v,
      });
    });

    // Muestreos (solo historial)
    if (mode === 'historial') {
      (data?.muestreos || []).forEach((m) => {
        const d = parseDateSafe(m.fecha);
        if (!d) return;
        const t = d.getTime();
        if (t < fromT || t >= toT) return;

        events.push({
          day: ymd(d),
          kind: 'muestreo',
          id: String(m.id || m._id || ''),
          title: 'Muestreo',
          subtitle: buildSubtitle({ proveedorNombre: m.proveedorNombre || m.proveedor, centroCodigo: m.centroCodigo }),
          parentKind: 'muestreo',
          parentId: String(m.id || m._id || ''),
          raw: m,
        });
      });
    }

    // Filters
    const q = norm(qFilter);
    const type = norm(typeFilter);
    return events.filter((ev) => {
      if (type && norm(ev.kind) !== type) return false;
      if (q) {
        const h = norm([ev.title, ev.subtitle, ev.raw?.proveedorNombre, ev.raw?.contactoNombre, ev.raw?.centroCodigo, ev.raw?.proximoPaso, ev.raw?.estado].join(' '));
        if (!h.includes(q)) return false;
      }
      return true;
    });
  }

  function groupByDay(events) {
    const map = new Map();
    events.forEach((ev) => {
      if (!map.has(ev.day)) map.set(ev.day, []);
      map.get(ev.day).push(ev);
    });
    // Orden simple dentro del día: por tipo y título
    map.forEach((arr) => {
      arr.sort((a, b) => {
        const ak = `${a.kind}-${a.title}`;
        const bk = `${b.kind}-${b.title}`;
        return ak.localeCompare(bk, 'es', { sensitivity: 'base' });
      });
    });
    return map;
  }

  function renderShell() {
    const root = rootEl();
    if (!root) return;
    root.innerHTML = `
      <div class="cal-wrap">
        <div class="cal-head">
          <div class="cal-title">
            <div>
              <h5>Calendario</h5>
              <div class="cal-subtitle">Interacciones, visitas y muestreos (todos los proveedores)</div>
            </div>
          </div>

          <div class="act-period-nav" style="margin:0; padding: 0; border: none;">
            <div class="act-period-left">
              <div class="act-period-modes" role="group" aria-label="Modo del calendario">
                <button class="act-period-mode is-active" data-cal-mode="agenda" type="button">Agenda</button>
                <button class="act-period-mode" data-cal-mode="historial" type="button">Historial</button>
              </div>
              <div class="act-period-modes" role="group" aria-label="Vista">
                <button class="act-period-mode is-active" data-cal-view="calendar" type="button"><i class="bi bi-calendar3"></i> Calendario</button>
                <button class="act-period-mode" data-cal-view="list" type="button"><i class="bi bi-list-ul"></i> Lista</button>
              </div>
              <div class="act-period-ctrl" id="cal-period-ctrl">
                <button class="act-period-arrow" id="cal-period-prev" title="Mes anterior" aria-label="Mes anterior" type="button">
                  <i class="bi bi-chevron-left"></i>
                </button>
                <span class="act-period-label" id="cal-period-label"></span>
                <button class="act-period-arrow" id="cal-period-next" title="Mes siguiente" aria-label="Mes siguiente" type="button">
                  <i class="bi bi-chevron-right"></i>
                </button>
                <button class="act-period-today" id="cal-period-today" type="button">Hoy</button>
              </div>
            </div>
          </div>
        </div>

        <div class="act-filters-bar" style="margin:0;">
          <div class="act-filters-left">
            <select id="cal-f-type" class="browser-default act-select" aria-label="Tipo">
              <option value="">Todos</option>
              <option value="muestras">Tomar muestras</option>
              <option value="visita">Visitas</option>
              <option value="llamada">Llamadas</option>
              <option value="reunion">Reuniones</option>
              <option value="muestra">Muestras (interacción)</option>
              <option value="tarea">Compromisos</option>
              <option value="interaccion">Otros</option>
              <option value="muestreo">Muestreos (historial)</option>
            </select>
            <input id="cal-f-q" type="text" class="mmpp-input act-input-q" placeholder="Buscar proveedor, centro o paso…" aria-label="Buscar">
            <button id="cal-f-clear" class="dash-btn act-btn-clear" type="button">Limpiar</button>
          </div>
          <div class="act-filters-right">
            <span data-cal-role="busy" hidden style="font-size:12px;color:#64748b;font-weight:700;">Cargando…</span>
          </div>
        </div>

        <div id="cal-grid"></div>
        <div id="cal-list" hidden></div>
      </div>
    `.trim();
  }

  function syncModeUI() {
    const root = rootEl();
    if (!root) return;
    root.querySelectorAll('[data-cal-mode]')?.forEach((b) => {
      b.classList.toggle('is-active', String(b.dataset.calMode) === mode);
    });

    root.querySelectorAll('[data-cal-view]')?.forEach((b) => {
      b.classList.toggle('is-active', String(b.dataset.calView) === view);
    });

    const typeSel = root.querySelector('#cal-f-type');
    if (typeSel) {
      // En agenda, muestreo (historial) no aplica, pero lo dejamos visible igual.
      typeSel.value = typeFilter || '';
    }

    const label = root.querySelector('#cal-period-label');
    if (label) label.textContent = monthLabel(cursor);

    const grid = root.querySelector('#cal-grid');
    const list = root.querySelector('#cal-list');
    if (grid) grid.toggleAttribute('hidden', view !== 'calendar');
    if (list) list.toggleAttribute('hidden', view !== 'list');
  }

  function countsByKind(dayEvents = []) {
    const out = new Map();
    dayEvents.forEach((ev) => {
      const k = String(ev.kind || '');
      out.set(k, (out.get(k) || 0) + 1);
    });
    return out;
  }

  function labelKind(kind) {
    const k = norm(kind);
    if (k === 'muestras') return 'Tomar muestras';
    if (k === 'visita') return 'Visitas';
    if (k === 'muestreo') return 'Muestreos';
    if (k === 'llamada') return 'Llamadas';
    if (k === 'reunion') return 'Reuniones';
    if (k === 'tarea') return 'Compromisos';
    if (k === 'muestra') return 'Muestras';
    return 'Interacciones';
  }

  function renderCountsBadges(dayEvents = []) {
    const map = countsByKind(dayEvents);
    if (!map.size) return '';
    const priority = ['muestras', 'visita', 'llamada', 'reunion', 'tarea', 'muestra', 'interaccion', 'muestreo', 'otro'];
    const keys = Array.from(map.keys()).sort((a, b) => priority.indexOf(norm(a)) - priority.indexOf(norm(b)));
    return `
      <div class="cal-day-badges">
        ${keys.map((k) => `<span class="cal-badge">${esc(labelKind(k))}: ${map.get(k)}</span>`).join('')}
      </div>
    `.trim();
  }

  function renderListHtml(eventsByDay) {
    const monthStart = startOfMonth(cursor);
    const y = monthStart.getFullYear();
    const m = monthStart.getMonth();

    const days = Array.from(eventsByDay.keys())
      .filter((k) => {
        const d = parseDateSafe(k);
        return d && d.getFullYear() === y && d.getMonth() === m;
      })
      .sort((a, b) => a.localeCompare(b));

    if (!days.length) return '<div class="cal-empty">Sin actividades en este mes.</div>';

    return `
      <div class="cal-list">
        ${days.map((dayKey) => {
          const dayEvents = eventsByDay.get(dayKey) || [];
          const title = fmtDayLabel(dayKey);
          const badges = renderCountsBadges(dayEvents);
          return `
            <section class="cal-day-group">
              <div class="cal-day-head">
                <div class="cal-day-title">
                  <span class="cal-day-title-txt">${esc(title)}</span>
                  <span class="cal-day-title-sub">${esc(`${dayEvents.length} actividad${dayEvents.length === 1 ? '' : 'es'}`)}</span>
                </div>
                ${badges}
              </div>
              <div class="cal-day-items">
                ${dayEvents.map((ev, i) => drawerEventHtml(ev, i, '', mode)).join('')}
              </div>
            </section>
          `.trim();
        }).join('')}
      </div>
    `.trim();
  }

  function bindUiOnce() {
    if (uiBound) return;
    uiBound = true;

    const root = rootEl();
    if (!root) return;
    ensureGlobalClose();

    root.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.cal-ev-edit[data-cal-open="1"]');
      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        handleOpenFromChip(editBtn);
        return;
      }

      const more = e.target.closest('.cal-more[data-cal-more]');
      if (more) {
        e.preventDefault();
        e.stopPropagation();
        const dayKey = String(more.dataset.calMore || '');
        if (!dayKey) return;
        openDrawerForDay(dayKey);
        return;
      }

      const modeBtn = e.target.closest('[data-cal-mode]');
      if (modeBtn) {
        mode = String(modeBtn.dataset.calMode || 'agenda');
        cache.clear();
        typeFilter = '';
        qFilter = '';
        closeDrawer();
        syncModeUI();
        render(true).catch(() => {});
        return;
      }

      const viewBtn = e.target.closest('[data-cal-view]');
      if (viewBtn) {
        view = String(viewBtn.dataset.calView || 'calendar') === 'list' ? 'list' : 'calendar';
        try { localStorage.setItem('calendario:view', view); } catch {}
        closeDrawer();
        syncModeUI();
        render(false).catch(() => {});
        return;
      }

      if (e.target.closest('#cal-period-prev')) {
        cursor = addMonths(cursor, -1);
        closeDrawer();
        syncModeUI();
        render(false).catch(() => {});
        return;
      }
      if (e.target.closest('#cal-period-next')) {
        cursor = addMonths(cursor, 1);
        closeDrawer();
        syncModeUI();
        render(false).catch(() => {});
        return;
      }
      if (e.target.closest('#cal-period-today')) {
        cursor = startOfMonth(new Date());
        closeDrawer();
        syncModeUI();
        render(false).catch(() => {});
        return;
      }
      if (e.target.closest('#cal-f-clear')) {
        typeFilter = '';
        qFilter = '';
        const sel = root.querySelector('#cal-f-type'); if (sel) sel.value = '';
        const q = root.querySelector('#cal-f-q'); if (q) q.value = '';
        closeDrawer();
        rerender();
        return;
      }

      const chip = e.target.closest('.cal-chip[data-cal-open="1"]');
      if (chip) {
        const dayKey = String(chip.dataset.day || chip.closest('.cal-cell[data-cal-date]')?.dataset?.calDate || '');
        if (!dayKey) return;
        drawerFocus = { kind: String(chip.dataset.kind || ''), id: String(chip.dataset.id || '') };
        openDrawerForDay(dayKey);
        return;
      }

      const cell = e.target.closest('.cal-cell[data-cal-date]');
      if (cell) {
        const dayKey = String(cell.dataset.calDate || '');
        if (!dayKey) return;
        openDrawerForDay(dayKey);
      }
    });

    root.querySelector('#cal-f-type')?.addEventListener('change', (e) => {
      typeFilter = String(e.target.value || '');
      closeDrawer();
      rerender();
    });
    root.querySelector('#cal-f-q')?.addEventListener('input', (e) => {
      qFilter = String(e.target.value || '');
      closeDrawer();
      rerender();
    });

    // Refrescar ante cambios globales
    window.addEventListener('visita:created', () => render(true).catch(() => {}));
    window.addEventListener('visita:updated', () => render(true).catch(() => {}));
    window.addEventListener('visita:deleted', () => render(true).catch(() => {}));
    window.addEventListener('muestreo:created', () => render(true).catch(() => {}));
    window.addEventListener('muestreo:updated', () => render(true).catch(() => {}));
    window.addEventListener('muestreo:deleted', () => render(true).catch(() => {}));
    window.addEventListener('interaccion:created', () => render(true).catch(() => {}));
  }

  async function render(force = false) {
    if (!mounted) {
      renderShell();
      bindUiOnce();
      mounted = true;
    }
    syncModeUI();
    setBusy(true);

    const data = await fetchMonthData(!!force);
    lastData = { data, events: [] };
    const events = buildEvents(data);
    lastData.events = events;
    const byDay = groupByDay(events);

    const root = rootEl();
    const grid = root?.querySelector('#cal-grid');
    if (grid) grid.innerHTML = renderGridHtml(cursor, byDay);
    const list = root?.querySelector('#cal-list');
    if (list) list.innerHTML = renderListHtml(byDay);

    setBusy(false);

    applySelectedToGrid();
    if (drawerOpenDay && isDrawerOpen()) renderDrawerForDay(drawerOpenDay);
  }

  async function initTab(forceReload = false) {
    // Solo montar si el panel esta visible (evita trabajo en background)
    const panel = document.getElementById('tab-calendario');
    if (panel && !panel.classList.contains('active')) return;
    await render(!!forceReload);
  }

  return { initTab, render };
}
