// js/abastecimiento/tratos/index.js
// Módulo Tratos / Negociación

import { listTratos, createTrato, updateTrato, changeEstado, upsertCondicion, removeCondicion, getContacto, listCondicionesMaestro, deleteTrato } from './api.js';
import { createModalConfirm, getModalInstance } from '../contactos/ui-common.js';
import { toast } from '../../ui/toast.js';

// ── Estado interno ──────────────────────────────────────────────────────────
let tratosAll = [];
let tratos = []; // visible (filtrado por estado si aplica)
let tratoActivo = null;   // objeto cargado en el modal
let booted = false;
let modalInst = null;
let _condicionSeleccionada = null;
let _tratoModalSuspendido = false;
let _condicionEditando = null; // item dentro de condiciones[] del trato
let _maestrosCondicionesCache = null;
let _maestrosCondicionesAt = 0;
let _condicionModoSel = null; // 'normal' | 'fijo' | null

async function ensureMaestrosCondicionesCache() {
  const now = Date.now();
  if (_maestrosCondicionesCache && (now - _maestrosCondicionesAt) < 60_000) return _maestrosCondicionesCache;
  try {
    const items = await listCondicionesMaestro();
    _maestrosCondicionesCache = items || [];
    _maestrosCondicionesAt = now;
  } catch {
    _maestrosCondicionesCache = _maestrosCondicionesCache || [];
    _maestrosCondicionesAt = now;
  }
  return _maestrosCondicionesCache;
}

const askDeleteTrato = createModalConfirm({
  id: 'modalConfirmDeleteTrato',
  defaultTitle: 'Eliminar trato',
  defaultMessage: '¿Eliminar este trato?',
  acceptText: 'Eliminar'
});

const askDeleteCondicion = createModalConfirm({
  id: 'modalConfirmDeleteTratoCondicion',
  defaultTitle: 'Eliminar condición',
  defaultMessage: '¿Eliminar esta condición?',
  acceptText: 'Eliminar'
});

function shouldShowModoToggle(meta) {
  const modo = meta?.modoCondicion;
  return meta?.tipoValor === 'porcentaje' && (modo === 'normal' || modo === 'fijo');
}

function renderModoToggleHTML(selected = 'normal') {
  const isNormal = selected === 'normal';
  const isFijo = selected === 'fijo';
  return `
    <div class="act-period-modes" id="condicionModoRow" role="group" aria-label="Modo de descuento">
      <button type="button" class="act-period-mode ${isNormal ? 'is-active' : ''}" data-modo="normal">Normal</button>
      <button type="button" class="act-period-mode ${isFijo ? 'is-active' : ''}" data-modo="fijo">Fijo</button>
    </div>
  `.trim();
}

function applyCondicionModo(modo) {
  _condicionModoSel = modo || null;
  const inner = document.getElementById('condicionValorInner');
  const el = document.getElementById('condicionValorEl');
  if (inner) inner.style.display = _condicionModoSel === 'normal' ? 'none' : '';
  if (_condicionModoSel === 'normal' && el) {
    try { el.value = ''; } catch {}
  }
  const row = document.getElementById('condicionModoRow');
  row?.querySelectorAll('.act-period-mode')?.forEach((b) => {
    b.classList.toggle('is-active', b.dataset.modo === _condicionModoSel);
  });
}

// ── Colores y labels de estado (5 estados + aliases legacy) ──────────────────
const ESTADO_MAP = {
  disponible:       { label: 'Disponible',     color: '#3b82f6' },
  semi_acordado:    { label: 'Semi-acordado',  color: '#f59e0b' },
  acordado:         { label: 'Acordado',       color: '#16a34a' },
  perdido:          { label: 'Perdido',        color: '#ef4444' },
  descartado:       { label: 'Descartado',     color: '#6b7280' },
  // Legacy → label equivalente para datos históricos
  activo:           { label: 'Disponible',     color: '#3b82f6' },
  prospecto:        { label: 'Disponible',     color: '#3b82f6' },
  negociando:       { label: 'Semi-acordado',  color: '#f59e0b' },
  semi_cerrado:     { label: 'Semi-acordado',  color: '#f59e0b' },
  cerrado:          { label: 'Acordado',       color: '#16a34a' },
  cosecha_iniciada: { label: 'Acordado',       color: '#16a34a' },
  compra_efectuada: { label: 'Acordado',       color: '#16a34a' },
  completado:       { label: 'Acordado',       color: '#16a34a' },
  caido:            { label: 'Perdido',        color: '#ef4444' },
};

function estadoBadge(estado) {
  const cfg = ESTADO_MAP[estado] || { label: estado, color: '#94a3b8' };
  return `<span class="trato-estado-badge" style="background:${cfg.color}20;color:${cfg.color};border:1px solid ${cfg.color}40;">${cfg.label}</span>`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function fmtDateUTC(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('es-CL', { timeZone: 'UTC' });
  } catch {
    return '';
  }
}

function toInputDateUTC(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`;
}

function inputDateToUtcNoon(value) {
  const v = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map((n) => Number(n));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function isoWeekStartUTC(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7; // 1..7
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (day - 1) + (week - 1) * 7);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function legacyPeriodoToRange(p) {
  if (!p?.tipo) return null;
  const tipo = String(p.tipo || '').toLowerCase();
  const año = Number(p.año);
  if (!año) return null;

  if (tipo === 'mes') {
    const mes = Number(p.mes);
    if (!mes) return null;
    const start = new Date(Date.UTC(año, mes - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(año, mes, 0, 23, 59, 59, 999));
    return { start, end };
  }

  if (tipo === 'semana') {
    const week = Number(p.semana);
    if (!week) return null;
    const start = isoWeekStartUTC(año, week);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  if (tipo === 'quincena') {
    const mes = Number(p.mes);
    const qn = Number(p.semana);
    if (!mes || !(qn === 1 || qn === 2)) return null;
    const dayStart = qn === 1 ? 1 : 16;
    const start = new Date(Date.UTC(año, mes - 1, dayStart, 0, 0, 0, 0));
    const endDay = qn === 1 ? 15 : new Date(Date.UTC(año, mes, 0)).getUTCDate();
    const end = new Date(Date.UTC(año, mes - 1, endDay, 23, 59, 59, 999));
    return { start, end };
  }

  return null;
}

function getTratoVigenciaRange(trato) {
  const desde = trato?.vigenciaDesde ? new Date(trato.vigenciaDesde) : null;
  const hasta = trato?.vigenciaHasta ? new Date(trato.vigenciaHasta) : null;
  if (desde && !Number.isNaN(desde.getTime())) {
    return { start: desde, end: (hasta && !Number.isNaN(hasta.getTime())) ? hasta : null };
  }
  const legacy = legacyPeriodoToRange(trato?.periodo);
  if (legacy) return legacy;
  return null;
}

function fmtVigencia(trato) {
  const r = getTratoVigenciaRange(trato);
  if (!r?.start) return '-';
  const a = fmtDateUTC(r.start);
  const b = r.end ? fmtDateUTC(r.end) : 'Abierto';
  return `${a} - ${b}`;
}

function condicionesCompletitud(condiciones) {
  if (!Array.isArray(condiciones) || !condiciones.length) return null;
  const acordadas = condiciones.filter(c => c.estado === 'acordado').length;
  const pct = Math.round((acordadas / condiciones.length) * 100);
  return { acordadas, total: condiciones.length, pct };
}

// Auto-sincroniza el estado del trato según el estado de sus condiciones.
// Nunca toca estados terminales (perdido / descartado).
async function syncTratoEstadoFromCondiciones(trato) {
  const conds = trato?.condiciones || [];
  if (!conds.length) return;

  const estadoActual = estadoGrupo(trato.estado);
  if (['perdido', 'descartado'].includes(estadoActual)) return;

  const todasAcordadas  = conds.every(c => c.estado === 'acordado');
  const algunaAcordada  = conds.some(c => c.estado === 'acordado');
  const ningunaAcordada = !algunaAcordada;

  let nuevoEstado = null;
  if      (todasAcordadas  && estadoActual !== 'acordado')    nuevoEstado = 'acordado';
  else if (algunaAcordada  && estadoActual === 'disponible')  nuevoEstado = 'semi_acordado';
  else if (ningunaAcordada && estadoActual === 'semi_acordado') nuevoEstado = 'disponible';
  else if (!todasAcordadas && estadoActual === 'acordado')    nuevoEstado = 'semi_acordado';

  if (!nuevoEstado) return;

  try {
    const updated = await changeEstado(trato._id, nuevoEstado);
    tratoActivo = updated;
    const estEl = document.getElementById('tratoEstado');
    if (estEl) estEl.value = nuevoEstado;
    if (nuevoEstado === 'acordado')
      toast('✓ Todas las condiciones acordadas — trato marcado como Acordado', { variant: 'success' });
    renderTabla();
  } catch { /* transición no permitida — el usuario puede cambiar manualmente */ }
}

function estadoGrupo(estadoRaw = '') {
  const est = String(estadoRaw || '').toLowerCase();
  if (['activo', 'prospecto'].includes(est))                              return 'disponible';
  if (['negociando', 'semi_cerrado'].includes(est))                       return 'semi_acordado';
  if (['cerrado', 'cosecha_iniciada', 'compra_efectuada', 'completado'].includes(est)) return 'acordado';
  if (est === 'caido')                                                    return 'perdido';
  // disponible, semi_acordado, acordado, perdido, descartado pasan tal cual
  return est || '';
}

function applyEstadoFilterAndRender() {
  const selected = document.getElementById('trt-f-estado')?.value || '';
  if (!selected) {
    tratos = Array.isArray(tratosAll) ? tratosAll.slice() : [];
  } else {
    tratos = (Array.isArray(tratosAll) ? tratosAll : []).filter((t) => estadoGrupo(t?.estado) === selected);
  }
  syncTratosKpiActive();
  renderTabla();
}

function syncTratosKpiActive() {
  const selected = document.getElementById('trt-f-estado')?.value || '';
  const wrap = document.getElementById('tratosKpis');
  wrap?.classList.toggle('has-filter', !!selected);
  document.querySelectorAll('#tratosKpis .trato-kpi').forEach((el) => {
    el.classList.toggle('is-active', !!selected && el.dataset.estado === selected);
  });
}

// ── Tabla de tratos ──────────────────────────────────────────────────────────
function renderTabla() {
  const tbody = document.getElementById('tratosBody');
  if (!tbody) return;

  // KPIs — cuenta también estados legacy en sus equivalentes nuevos
  const kpis = { disponible: 0, semi_acordado: 0, acordado: 0, perdido: 0, descartado: 0 };
  for (const t of (Array.isArray(tratosAll) ? tratosAll : [])) {
    const k = estadoGrupo(t?.estado);
    if (k && k in kpis) kpis[k]++;
  }
  document.querySelectorAll('#tratosKpis .trato-kpi').forEach(el => {
    const est = el.dataset.estado;
    const vEl = el.querySelector('.v');
    if (vEl && est in kpis) vEl.textContent = kpis[est];
  });
  syncTratosKpiActive();

  if (!tratos.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="tratos-empty">Sin tratos registrados para el rango seleccionado.</td></tr>`;
    return;
  }

  tbody.innerHTML = tratos.map(t => {
    const est = estadoGrupo(t?.estado);
    const comp = condicionesCompletitud(t.condiciones);
    const compHTML = comp
      ? `<div class="trato-comp-bar"><div class="trato-comp-fill" style="width:${comp.pct}%"></div></div><small>${comp.acordadas}/${comp.total}</small>`
      : '<small class="muted">—</small>';

    const precio = t.precioAcordado
      ? `${Number(t.precioAcordado).toLocaleString('es-CL')} ${esc(t.unidadPrecio || '')}`
      : '—';

    const tons = t.tonsAcordadas != null
      ? `${Number(t.tonsAcordadas).toLocaleString('es-CL', { maximumFractionDigits: 1 })} t`
      : '—';

    return `<tr class="trato-row" data-id="${esc(t._id)}">
      <td class="trato-td-proveedor">${esc(t.proveedorNombre || t.proveedorKey || '—')}</td>
      <td>${estadoBadge(est)}</td>
      <td>${esc(fmtVigencia(t))}</td>
      <td>${esc(tons)}</td>
      <td>${esc(precio)}</td>
      <td>${compHTML}</td>
      <td>${esc(t.responsableNombre || '—')}</td>
      <td><button class="dash-btn trato-btn-editar" data-id="${esc(t._id)}">Editar</button></td>
    </tr>`;
  }).join('');
}

// ── Filtros ──────────────────────────────────────────────────────────────────
let trtPeriodMode = 'week';   // all | week | month
let trtPeriodOffset = 0;      // desplazamiento relativo (semanas o meses)

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfISOWeek(d) {
  const x = new Date(d);
  const day = x.getDay() || 7; // 1..7 (Lun..Dom)
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - (day - 1));
  return x;
}

function isoWeekInfo(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { year, week };
}

function getTrtPeriodAnchor() {
  const now = new Date();
  if (trtPeriodMode === 'week') return addDays(now, trtPeriodOffset * 7);
  if (trtPeriodMode === 'month') return new Date(now.getFullYear(), now.getMonth() + trtPeriodOffset, 1);
  return now;
}

function getTrtPeriodLabel() {
  const a = getTrtPeriodAnchor();
  if (trtPeriodMode === 'week') {
    const { week } = isoWeekInfo(a);
    const start = startOfISOWeek(a);
    const end = addDays(start, 6);
    const range = `${start.getDate()} ${MESES_CORTO[start.getMonth()]}–${end.getDate()} ${MESES_CORTO[end.getMonth()]} ${end.getFullYear()}`;
    return `Sem. ${week} - ${range}`;
  }
  if (trtPeriodMode === 'month') {
    return `${MESES_CORTO[a.getMonth()]} ${a.getFullYear()}`;
  }
  return 'Todo';
}

function syncTrtPeriodUI() {
  const nav = document.getElementById('trt-period-nav');
  if (!nav) return;

  const ctrl = document.getElementById('trt-period-ctrl');
  const label = document.getElementById('trt-period-label');
  const modes = Array.from(nav.querySelectorAll('.act-period-mode[data-period]'));

  const hasNav = trtPeriodMode !== 'all';
  if (ctrl) ctrl.hidden = !hasNav;
  if (label && hasNav) label.textContent = getTrtPeriodLabel();

  modes.forEach((b) => b.classList.toggle('is-active', b.dataset.period === trtPeriodMode));
}

async function cargarTratos() {
  const estado = document.getElementById('trt-f-estado')?.value || '';
  const filters = {};
  // IMPORTANTE: No filtramos por estado en backend para que los KPIs se mantengan (y el filtro sea UI-only).

  if (trtPeriodMode === 'week') {
    const a = getTrtPeriodAnchor();
    const { year, week } = isoWeekInfo(a);
    const start = isoWeekStartUTC(year, week);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    filters.from = start.toISOString();
    filters.to = end.toISOString();
  } else if (trtPeriodMode === 'month') {
    const a = getTrtPeriodAnchor();
    const start = new Date(Date.UTC(a.getFullYear(), a.getMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(a.getFullYear(), a.getMonth() + 1, 0, 23, 59, 59, 999));
    filters.from = start.toISOString();
    filters.to = end.toISOString();
  }

  try {
    tratosAll = await listTratos(filters);
  } catch (e) {
    console.error('[tratos] listTratos error', e);
    tratosAll = [];
    toast('No se pudieron cargar los tratos', { variant: 'error' });
  }
  syncTrtPeriodUI();
  applyEstadoFilterAndRender();
}

function bindFiltros() {
  const nav = document.getElementById('trt-period-nav');
  if (!nav) return;

  const modes = Array.from(nav.querySelectorAll('.act-period-mode[data-period]'));
  const prev = document.getElementById('trt-period-prev');
  const next = document.getElementById('trt-period-next');
  const estado = document.getElementById('trt-f-estado');
  const clear = document.getElementById('trt-f-clear');

  // Inicial desde el HTML (por defecto "Semana")
  trtPeriodMode = modes.find((b) => b.classList.contains('is-active'))?.dataset.period || 'week';
  trtPeriodOffset = 0;
  syncTrtPeriodUI();

  modes.forEach((b) => {
    b.addEventListener('click', async () => {
      trtPeriodMode = b.dataset.period || 'week';
      trtPeriodOffset = 0;
      syncTrtPeriodUI();
      await cargarTratos();
    });
  });

  prev?.addEventListener('click', async () => {
    trtPeriodOffset--;
    syncTrtPeriodUI();
    await cargarTratos();
  });
  next?.addEventListener('click', async () => {
    trtPeriodOffset++;
    syncTrtPeriodUI();
    await cargarTratos();
  });

  estado?.addEventListener('change', () => applyEstadoFilterAndRender());

  document.getElementById('tratosKpis')?.addEventListener('click', async (e) => {
    const card = e.target.closest('.trato-kpi');
    if (!card) return;
    const est = card.dataset.estado || '';
    if (!est) return;
    if (!estado) return;
    estado.value = (estado.value === est) ? '' : est;
    applyEstadoFilterAndRender();
  });

  clear?.addEventListener('click', async () => {
    if (estado) estado.value = '';
    trtPeriodMode = 'all';
    trtPeriodOffset = 0;
    syncTrtPeriodUI();
    await cargarTratos();
  });
}

// ── Carga opciones responsable desde maestros ────────────────────────────────
async function cargarOpcionesResponsable(selectedVal = '') {
  const sel = document.getElementById('tratoResponsable');
  if (!sel) return;
  try {
    const r = await fetch('/api/maestros?tipo=responsable&soloActivos=true');
    const json = await r.json();
    const items = json.items || [];
    sel.innerHTML = '<option value="">— Seleccionar —</option>' +
      items.map(i => `<option value="${esc(i.nombre)}" ${i.nombre === selectedVal ? 'selected' : ''}>${esc(i.nombre)}</option>`).join('');
  } catch {
    sel.innerHTML = '<option value="">— Seleccionar —</option>';
    if (selectedVal) {
      sel.innerHTML += `<option value="${esc(selectedVal)}" selected>${esc(selectedVal)}</option>`;
    }
  }
}

// ── Modal Trato ──────────────────────────────────────────────────────────────
function getModal() {
  if (!modalInst) {
    const el = document.getElementById('modalTrato');
    if (!el) return null;
    modalInst = getModalInstance(el, { dismissible: true });
  }
  return modalInst;
}

function abrirModal(trato = null) {
  tratoActivo = trato;
  const isNew = !trato;

  const titleEl = document.getElementById('modalTratoTitle');
  if (titleEl) titleEl.textContent = isNew ? 'Nuevo trato' : 'Editar trato';

  const provInput = document.getElementById('tratoProveedorInput');
  if (provInput) provInput.value = trato?.proveedorNombre || trato?.proveedorKey || '';

  const provIdEl = document.getElementById('tratoProveedorId');
  if (provIdEl) provIdEl.value = trato?.proveedorId || '';

  const estadoVal = estadoGrupo(trato?.estado || 'disponible') || 'disponible';
  const estEl = document.getElementById('tratoEstado');
  if (estEl) estEl.value = estadoVal;

  cargarOpcionesResponsable(trato?.responsableNombre || '');
  
  const notasEl = document.getElementById('tratoNotas');
  if (notasEl) notasEl.value = trato?.notasTrato || '';

  // Camiones: no aplica al flujo de estados definitivo
  const camRow = document.getElementById('tratoCamionesRow');
  const camInput = document.getElementById('tratoCamiones');
  if (camRow) camRow.style.display = 'none';
  if (camInput) camInput.value = trato?.camionesXDia ?? '';

  const tipoCamionEl = document.getElementById('tratoTipoCamion');
  const maxisEl = document.getElementById('tratoMaxisPorCamion');
  if (tipoCamionEl) tipoCamionEl.value = trato?.tipoCamionDefault || '';
  if (maxisEl) maxisEl.value = trato?.maxisPorCamion ?? '';

  // Vigencia (inicio/término) — usado para filtros por calendario
  const startDefault = isNew ? new Date() : null;
  const r = getTratoVigenciaRange(trato) || {};
  const vigDesde = r.start || startDefault;
  const vigHasta = r.end || null;
  const desdeEl = document.getElementById('tratoVigenciaDesde');
  const hastaEl = document.getElementById('tratoVigenciaHasta');
  if (desdeEl) desdeEl.value = vigDesde ? toInputDateUTC(vigDesde) : '';
  if (hastaEl) hastaEl.value = vigHasta ? toInputDateUTC(vigHasta) : '';

  // Condiciones
  renderCondiciones(trato?.condiciones || []);

  // Historial responsable: se carga async desde el contacto
  renderHistorialResponsable([]);
  if (!isNew && trato?.proveedorId) {
    getContacto(trato.proveedorId).then(c => {
      renderHistorialResponsable(c?.responsableHistorial || []);
    }).catch(() => {}); // silencioso si falla
  }

  // Botón eliminar
  const btnDel = document.getElementById('btnTratoDelete');
  if (btnDel) btnDel.style.display = isNew ? 'none' : '';

  // Defensive: overlays "pegados" o campos deshabilitados pueden bloquear clicks/tecleo al reabrir.
  // Si no hay otros modales abiertos, limpiamos overlays huérfanos antes de abrir.
  const otherOpen = Array.from(document.querySelectorAll('.modal.open')).some((el) => el.id !== 'modalTrato');
  if (!otherOpen) {
    document.querySelectorAll('.modal-overlay, .sidenav-overlay').forEach((el) => el.remove());
  }
  // Asegurar que los campos del modal estén editables (por si quedaron con disabled/readonly por algún bug previo).
  document.getElementById('modalTrato')?.querySelectorAll('input, textarea, select')?.forEach((el) => {
    el.disabled = false;
    el.readOnly = false;
    el.removeAttribute('disabled');
    el.removeAttribute('readonly');
  });
  // Ocultar autocomplete si quedó visible de una edición anterior
  const drop = document.getElementById('tratoProveedorDrop');
  if (drop) drop.style.display = 'none';

  getModal()?.open();

  // Mejor UX: enfocar un campo editable al abrir (evita sensación de "bloqueado").
  setTimeout(() => {
    const target = document.getElementById('tratoNotas') || document.getElementById('tratoProveedorInput');
    target?.focus?.();
  }, 80);
}

// (Legacy) Inputs de período removidos: ahora la vigencia se define por fechas inicio/término.

function renderCondiciones(condiciones) {
  const list = document.getElementById('tratoCondicionesList');
  if (!list) return;

  if (!condiciones.length) {
    list.innerHTML = '<p class="trato-condiciones-empty">Sin condiciones registradas.</p>';
    return;
  }

  const ESTADO_CONDICION = {
    pendiente: { label: 'Pendiente', color: '#f59e0b' },
    acordado:  { label: 'Acordado',  color: '#22c55e' },
    rechazado: { label: 'Rechazado', color: '#ef4444' },
  };

  list.innerHTML = condiciones.map(c => {
    const cfg = ESTADO_CONDICION[c.estado] || ESTADO_CONDICION.pendiente;
    const unidadSufijo = c.tipoValor === 'porcentaje' ? '%'
      : c.tipoValor === 'dias'   ? ' días'
      : c.tipoValor === 'numero' ? (c.unidadNombre ? ' ' + c.unidadNombre : '')
      : '';
    const valorStr = (c.tipoValor === 'porcentaje' && c.modoCondicion === 'normal')
      ? 'Normal'
      : (c.valor != null ? `${c.valor}${unidadSufijo}` : '—');
    return `<div class="trato-condicion-item" data-cid="${esc(c._id)}">
      <div class="trato-condicion-body">
        <span class="trato-condicion-nombre">${esc(c.nombre)}</span>
        <span class="trato-condicion-valor">${esc(valorStr)}</span>
      </div>
      <div class="trato-condicion-ctrl">
        <select class="browser-default trato-cond-estado modern-select" data-cid="${esc(c._id)}" style="height:28px;font-size:12px;padding:0 4px;color:${cfg.color};">
          <option value="pendiente" ${c.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="acordado"  ${c.estado === 'acordado'  ? 'selected' : ''}>Acordado</option>
          <option value="rechazado" ${c.estado === 'rechazado' ? 'selected' : ''}>Rechazado</option>
        </select>
        <button class="trato-cond-edit dash-btn" data-cid="${esc(c._id)}" title="Editar valor">✎</button>
        <button class="trato-cond-remove dash-btn" data-cid="${esc(c._id)}" title="Eliminar condición">×</button>
      </div>
    </div>`;
  }).join('');
}

function renderHistorialResponsable(historial) {
  const wrap = document.getElementById('tratoHistorialWrap');
  const list = document.getElementById('tratoHistorialList');
  if (!wrap || !list) return;

  if (!historial?.length) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';
  list.innerHTML = historial.map(h => {
    const desde = h.desde ? new Date(h.desde).toLocaleDateString('es-CL') : '—';
    const hasta = h.hasta ? new Date(h.hasta).toLocaleDateString('es-CL') : 'Actual';
    return `<div class="trato-hist-row">
      <span class="trato-hist-nombre">${esc(h.nombre)}</span>
      <span class="trato-hist-rango">${desde} → ${hasta}</span>
      ${h.nota ? `<span class="trato-hist-nota">${esc(h.nota)}</span>` : ''}
    </div>`;
  }).join('');
}

// ── Guardar trato ────────────────────────────────────────────────────────────
async function guardarTrato() {
  const proveedorId  = document.getElementById('tratoProveedorId').value.trim();
  const proveedorNom = document.getElementById('tratoProveedorInput').value.trim();
  const estado       = document.getElementById('tratoEstado').value;
  const responsableNombre = document.getElementById('tratoResponsable').value.trim();
  const notasTrato     = document.getElementById('tratoNotas').value.trim();
  const camionesXDia       = parseInt(document.getElementById('tratoCamiones')?.value) || null;
  const tipoCamionDefault  = document.getElementById('tratoTipoCamion')?.value || null;
  const maxisPorCamion     = parseInt(document.getElementById('tratoMaxisPorCamion')?.value) || null;

  const vigDesde = inputDateToUtcNoon(document.getElementById('tratoVigenciaDesde')?.value);
  const vigHasta = inputDateToUtcNoon(document.getElementById('tratoVigenciaHasta')?.value);
  if (!vigDesde) {
    toast('Selecciona una fecha de inicio (vigencia)', { variant: 'warning' });
    return;
  }
  if (vigHasta && vigHasta.getTime() < vigDesde.getTime()) {
    toast('La fecha de término no puede ser anterior al inicio', { variant: 'warning' });
    return;
  }

  const btn = document.getElementById('btnTratoSave');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    if (!tratoActivo) {
      // CREAR
      if (!proveedorId) {
        toast('Selecciona un proveedor', { variant: 'warning' });
        return;
      }
      // Necesitamos proveedorKey y proveedorNombre del contacto — buscamos en state
      const contactos = window._contactosGuardados || [];
      const c = contactos.find(x => String(x._id || x.id) === proveedorId) || {};

      await createTrato({
        proveedorId,
        proveedorKey: c.proveedorKey || '',
        proveedorNombre: c.proveedorNombre || proveedorNom || '',
        estado,
        responsableNombre,
        notasTrato,
        vigenciaDesde: vigDesde.toISOString(),
        vigenciaHasta: vigHasta ? vigHasta.toISOString() : null,
        camionesXDia,
        tipoCamionDefault,
        maxisPorCamion,
        origen: 'manual',
      });
    } else {
      // ACTUALIZAR — primero el estado si cambió
      if (estado !== estadoGrupo(tratoActivo.estado)) {
        try {
          await changeEstado(tratoActivo._id, estado);
        } catch (e) {
          toast(`No se puede cambiar a "${estado}": transición inválida`, { variant: 'warning' });
          return;
        }
      }
      // Luego campos de trato
      await updateTrato(tratoActivo._id, {
        responsableNombre,
        notasTrato,
        vigenciaDesde: vigDesde.toISOString(),
        vigenciaHasta: vigHasta ? vigHasta.toISOString() : null,
        camionesXDia,
        tipoCamionDefault,
        maxisPorCamion,
      });
    }

    getModal()?.close();
    toast('Trato guardado', { variant: 'success' });
    await cargarTratos();
  } catch (e) {
    console.error('[tratos] guardar error', e);
    toast(e?.message || 'Error al guardar', { variant: 'error' });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

// ── Modal de condición de negociación ────────────────────────────────────────

function getTipoCondicionInfo(m) {
  const map = {
    moneda:     { badge: '$',    color: '#0d9488' },
    porcentaje: { badge: '%',    color: '#7c3aed' },
    dias:       { badge: 'días', color: '#2563eb' },
    numero:     { badge: (m.unidadNombre || 'Nº').substring(0, 5), color: '#f59e0b' },
    opciones:   { badge: '≡',   color: '#d97706' },
    texto:      { badge: 'T',    color: '#64748b' },
  };
  return map[m.tipoValor] || map.texto;
}

function renderValorInputCondicion(m) {
  if (m.tipoValor === 'opciones') {
    if (Array.isArray(m.opciones) && m.opciones.length) {
      return `<select id="condicionValorEl" class="browser-default modern-select" style="width:100%;">
        <option value="">— Seleccionar —</option>
        ${m.opciones.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
      </select>`;
    }
    // Fallback si el maestro no trae opciones (o está inactivo): permitir texto libre.
    return `<input id="condicionValorEl" type="text" class="am-input" placeholder="Escribe la opción…" style="width:100%;">`;
  }
  if (m.tipoValor === 'texto') {
    return `<input id="condicionValorEl" type="text" class="am-input" placeholder="Escribe el valor…" style="width:100%;">`;
  }
  // Tipos numéricos: moneda, porcentaje, dias, numero
  const step = m.tipoValor === 'porcentaje' ? '0.1' : '1';
  const ph   = m.tipoValor === 'moneda'     ? 'Ej: 1500'
             : m.tipoValor === 'porcentaje' ? 'Ej: 85'
             : m.tipoValor === 'dias'       ? 'Ej: 30'
             : 'Ej: 12';
  const unid = m.tipoValor === 'moneda'     ? 'CLP'
             : m.tipoValor === 'porcentaje' ? '%'
             : m.tipoValor === 'dias'       ? 'días'
             : (m.unidadNombre || '');
  return `<div style="display:flex;align-items:center;gap:10px;">
    <input id="condicionValorEl" type="number" class="am-input" min="0" step="${step}" placeholder="${esc(ph)}" style="flex:1;">
    ${unid ? `<span style="font-size:13px;font-weight:700;color:#475569;white-space:nowrap;">${esc(unid)}</span>` : ''}
  </div>`;
}

function abrirModalCondicion(disponibles) {
  _condicionSeleccionada = null;

  // Materialize Modal (Editar trato) aplica un focus-trap que impide tipear en este modal custom.
  // Para permitir escritura, suspendemos el modal principal mientras esta UI esté abierta.
  _tratoModalSuspendido = false;
  try {
    const elTrato = document.getElementById('modalTrato');
    const inst = elTrato ? getModalInstance(elTrato) : null;
    const isOpen = !!(inst?.isOpen || elTrato?.classList?.contains('open'));
    if (isOpen) {
      _tratoModalSuspendido = true;
      inst?.close?.();
      if (elTrato) elTrato.style.display = 'none';
    }
  } catch {}

  const cards       = document.getElementById('condicionCards');
  const sinDisp     = document.getElementById('condicionSinDisp');
  const valorSec    = document.getElementById('condicionValorSection');
  const btnConfirmar= document.getElementById('btnConfirmarCondicion');
  if (!cards) return;

  valorSec.style.display = 'none';
  btnConfirmar.disabled  = true;

  if (!disponibles.length) {
    cards.innerHTML = '';
    sinDisp.style.display = '';
  } else {
    sinDisp.style.display = 'none';
    cards.innerHTML = disponibles.map(m => {
      const info = getTipoCondicionInfo(m);
      const req  = m.requerido
        ? `<div style="font-size:10px;color:#ef4444;font-weight:700;margin-top:2px;letter-spacing:.3px;">REQUERIDA</div>` : '';
      return `<div class="cond-card" data-id="${esc(m._id)}" style="
        display:flex;align-items:center;gap:12px;padding:11px 14px;
        border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;
        transition:border-color .15s,background .15s;background:#fff;user-select:none;">
        <div style="width:36px;height:36px;border-radius:9px;background:${info.color}18;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;">
          <span style="font-size:11px;font-weight:800;color:${info.color};line-height:1;">${esc(info.badge)}</span>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;">${esc(m.nombre)}</div>
          ${req}
        </div>
        <i class="bi bi-circle" style="color:#e2e8f0;font-size:19px;flex-shrink:0;transition:all .15s;"></i>
      </div>`;
    }).join('');

    cards.querySelectorAll('.cond-card').forEach(card => {
      const m = disponibles.find(x => String(x._id) === card.dataset.id);
      if (!m) return;
      card.addEventListener('mouseenter', () => {
        if (!card.dataset.selected) card.style.borderColor = '#a5b4fc';
      });
      card.addEventListener('mouseleave', () => {
        if (!card.dataset.selected) card.style.borderColor = '#e2e8f0';
      });
      card.addEventListener('click', () => seleccionarCondicionCard(card, m, cards));
    });
  }

  document.getElementById('condicionModalWrap').style.display = 'flex';
}

function seleccionarCondicionCard(card, m, cards) {
  _condicionSeleccionada = m;
  _condicionEditando = null;

  // Reset visual de todas las cards
  cards.querySelectorAll('.cond-card').forEach(c => {
    delete c.dataset.selected;
    c.style.borderColor = '#e2e8f0';
    c.style.background  = '#fff';
    const ico = c.querySelector('.bi');
    if (ico) { ico.className = 'bi bi-circle'; ico.style.color = '#e2e8f0'; }
  });

  // Marcar la seleccionada
  card.dataset.selected = '1';
  card.style.borderColor = '#4f46e5';
  card.style.background  = '#f0f4ff';
  const ico = card.querySelector('.bi');
  if (ico) { ico.className = 'bi bi-check-circle-fill'; ico.style.color = '#4f46e5'; }

  // Poblar sección de valor
  const info        = getTipoCondicionInfo(m);
  const valorSec    = document.getElementById('condicionValorSection');
  const nombreSel   = document.getElementById('condicionNombreSel');
  const tipoBadge   = document.getElementById('condicionTipoBadge');
  const inputWrap   = document.getElementById('condicionValorInput');
  const btnConfirmar= document.getElementById('btnConfirmarCondicion');

  if (!valorSec) return;
  nombreSel.textContent = m.nombre;
  tipoBadge.innerHTML   = `<span style="background:${info.color}18;color:${info.color};border:1px solid ${info.color}30;
    border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;">${esc(info.badge)}</span>`;
  inputWrap.innerHTML   = renderValorInputCondicion(m);

  // Selector Normal/Fijo (solo cuando el maestro lo define para condiciones porcentaje)
  if (shouldShowModoToggle(m)) {
    const defaultModo = m.modoCondicion || 'normal';
    inputWrap.innerHTML = `${renderModoToggleHTML(defaultModo)}<div id="condicionValorInner">${renderValorInputCondicion(m)}</div>`;
    applyCondicionModo(defaultModo);
    document.getElementById('condicionModoRow')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.act-period-mode');
      if (!btn) return;
      applyCondicionModo(btn.dataset.modo);
    });
  } else {
    _condicionModoSel = null;
  }
  valorSec.style.display = '';
  btnConfirmar.disabled  = false;
  btnConfirmar.innerHTML = '<i class="bi bi-plus-lg"></i> Agregar al trato';

  // Focus el input
  setTimeout(() => {
    if (_condicionModoSel === 'normal') {
      document.getElementById('btnConfirmarCondicion')?.focus?.();
      return;
    }
    document.getElementById('condicionValorEl')?.focus?.();
  }, 60);

  // Enter para confirmar
  document.getElementById('condicionValorEl')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmarCondicion();
  });
}

function cerrarModalCondicion() {
  _condicionSeleccionada = null;
  _condicionEditando = null;
  _condicionModoSel = null;
  document.getElementById('condicionModalWrap').style.display = 'none';

  // Restaurar modal principal si fue suspendido (y con esto se restaura el focus-trap en el lugar correcto).
  if (_tratoModalSuspendido) {
    _tratoModalSuspendido = false;
    try {
      const elTrato = document.getElementById('modalTrato');
      if (elTrato) elTrato.style.display = '';
      const inst = elTrato ? getModalInstance(elTrato, { dismissible: true }) : null;
      inst?.open?.();
    } catch {}
  }

  // Restaurar UI del modal custom (por si venía en modo edición)
  try {
    const cards = document.getElementById('condicionCards');
    const cardsWrap = cards?.parentElement;
    if (cardsWrap) cardsWrap.style.display = '';
    const btn = document.getElementById('btnConfirmarCondicion');
    if (btn) btn.innerHTML = '<i class="bi bi-plus-lg"></i> Agregar al trato';
  } catch {}
}

async function confirmarCondicion() {
  if (!tratoActivo) return;

  // Modo edición: actualiza el item existente sin borrarlo
  if (_condicionEditando) {
    const cur = _condicionEditando;
    const el  = document.getElementById('condicionValorEl');
    let valor = el?.value ?? '';

    if (cur.tipoValor === 'porcentaje' && _condicionModoSel === 'normal') {
      valor = null;
    } else if (['moneda', 'porcentaje', 'dias', 'numero'].includes(cur.tipoValor)) {
      valor = valor !== '' ? parseFloat(valor) : null;
    } else {
      valor = String(valor).trim() || null;
    }

    if (cur.tipoValor === 'porcentaje' && _condicionModoSel === 'fijo' && valor == null) {
      toast('Ingresa el porcentaje', { variant: 'warning' });
      return;
    }

    const btn = document.getElementById('btnConfirmarCondicion');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…';

    try {
      const updated = await upsertCondicion(tratoActivo._id, {
        _id:          cur._id,
        condicionId:  cur.condicionId || null,
        nombre:       cur.nombre,
        tipoValor:    cur.tipoValor,
        unidadNombre: cur.unidadNombre || '',
        valor,
        modoCondicion: cur.tipoValor === 'porcentaje' ? (_condicionModoSel || null) : null,
        estado:       cur.estado || 'pendiente',
      });
      tratoActivo = updated;
      renderCondiciones(updated.condiciones || []);
      cerrarModalCondicion();
      toast('Condición actualizada', { variant: 'success' });
    } catch {
      toast('Error al actualizar condición', { variant: 'error' });
    } finally {
      btn.disabled = false;
      btn.innerHTML = _condicionEditando
        ? '<i class="bi bi-check-lg"></i> Guardar cambio'
        : '<i class="bi bi-plus-lg"></i> Agregar al trato';
    }
    return;
  }

  if (!_condicionSeleccionada) return;

  const m   = _condicionSeleccionada;
  const el  = document.getElementById('condicionValorEl');
  let valor = el?.value ?? '';

  if (m.tipoValor === 'porcentaje' && _condicionModoSel === 'normal') {
    valor = null;
  } else if (['moneda', 'porcentaje', 'dias', 'numero'].includes(m.tipoValor)) {
    valor = valor !== '' ? parseFloat(valor) : null;
  } else {
    valor = valor.trim() || null;
  }

  if (m.tipoValor === 'porcentaje' && _condicionModoSel === 'fijo' && valor == null) {
    toast('Ingresa el porcentaje', { variant: 'warning' });
    return;
  }

  const btn = document.getElementById('btnConfirmarCondicion');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…';

  try {
    const updated = await upsertCondicion(tratoActivo._id, {
      condicionId:  m._id,
      nombre:       m.nombre,
      tipoValor:    m.tipoValor,
      unidadNombre: m.unidadNombre || '',
      valor,
      modoCondicion: m.tipoValor === 'porcentaje' ? (_condicionModoSel || null) : null,
      estado: 'pendiente',
    });
    tratoActivo = updated;
    renderCondiciones(updated.condiciones || []);
    cerrarModalCondicion();
    toast('Condición agregada', { variant: 'success' });
  } catch {
    toast('Error al agregar condición', { variant: 'error' });
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-plus-lg"></i> Agregar al trato';
  }
}

async function abrirModalEditarCondicion(condItem) {
  if (!condItem || !tratoActivo) return;
  _condicionSeleccionada = null;
  _condicionEditando = condItem;

  // Materialize Modal (Editar trato) aplica un focus-trap que impide tipear en este modal custom.
  // Para permitir edición, suspendemos el modal principal mientras esta UI esté abierta.
  _tratoModalSuspendido = false;
  try {
    const elTrato = document.getElementById('modalTrato');
    const inst = elTrato ? getModalInstance(elTrato) : null;
    const isOpen = !!(inst?.isOpen || elTrato?.classList?.contains('open'));
    if (isOpen) {
      _tratoModalSuspendido = true;
      inst?.close?.();
      if (elTrato) elTrato.style.display = 'none';
    }
  } catch {}

  const cards       = document.getElementById('condicionCards');
  const sinDisp     = document.getElementById('condicionSinDisp');
  const valorSec    = document.getElementById('condicionValorSection');
  const btnConfirmar= document.getElementById('btnConfirmarCondicion');
  const cardsWrap   = cards?.parentElement;
  if (!valorSec || !btnConfirmar) return;

  if (cardsWrap) cardsWrap.style.display = 'none';
  if (sinDisp) sinDisp.style.display = 'none';

  // Para condiciones tipo "opciones", intentamos cargar el maestro para poblar el select.
  let meta = null;
  if (condItem.condicionId) {
    const maestros = await ensureMaestrosCondicionesCache();
    meta = maestros.find(x => String(x._id) === String(condItem.condicionId)) || null;
  }
  if (!meta) {
    meta = {
      _id: condItem.condicionId || null,
      nombre: condItem.nombre,
      tipoValor: condItem.tipoValor,
      unidadNombre: condItem.unidadNombre || '',
      opciones: [],
    };
  }

  const info      = getTipoCondicionInfo(meta);
  const nombreSel = document.getElementById('condicionNombreSel');
  const tipoBadge = document.getElementById('condicionTipoBadge');
  const inputWrap = document.getElementById('condicionValorInput');

  if (nombreSel) nombreSel.textContent = meta.nombre || '';
  if (tipoBadge) tipoBadge.innerHTML = `<span style="background:${info.color}18;color:${info.color};border:1px solid ${info.color}30;
    border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;">${esc(info.badge)}</span>`;
  if (inputWrap) inputWrap.innerHTML = renderValorInputCondicion(meta);

  // Selector Normal/Fijo en edición (si el maestro lo define o ya está guardado en el item)
  const modoFromItem = condItem.modoCondicion;
  if (meta.tipoValor === 'porcentaje' && (shouldShowModoToggle(meta) || modoFromItem === 'normal' || modoFromItem === 'fijo')) {
    const initialModo = modoFromItem || meta.modoCondicion || (condItem.valor == null ? 'normal' : 'fijo');
    if (inputWrap) {
      inputWrap.innerHTML = `${renderModoToggleHTML(initialModo)}<div id="condicionValorInner">${renderValorInputCondicion(meta)}</div>`;
    }
    applyCondicionModo(initialModo);
    document.getElementById('condicionModoRow')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.act-period-mode');
      if (!btn) return;
      applyCondicionModo(btn.dataset.modo);
    });
  } else {
    _condicionModoSel = null;
  }

  valorSec.style.display = '';
  btnConfirmar.disabled = false;
  btnConfirmar.innerHTML = '<i class="bi bi-check-lg"></i> Guardar cambio';

  // Set valor actual + focus
  setTimeout(() => {
    if (_condicionModoSel === 'normal') {
      document.getElementById('btnConfirmarCondicion')?.focus?.();
      return;
    }
    const el = document.getElementById('condicionValorEl');
    if (!el) return;
    try { el.value = condItem.valor != null ? String(condItem.valor) : ''; } catch {}
    el.focus?.();
  }, 60);

  document.getElementById('condicionModalWrap').style.display = 'flex';
}

// ── Eventos del modal ────────────────────────────────────────────────────────
function bindModal() {
  // Botón guardar
  document.getElementById('btnTratoSave')?.addEventListener('click', guardarTrato);

  // Cambio de estado → mostrar/ocultar campo camiones
  document.getElementById('tratoEstado')?.addEventListener('change', e => {
    const camRow = document.getElementById('tratoCamionesRow');
    if (camRow) camRow.style.display = e.target.value === 'cosecha_iniciada' ? '' : 'none';
  });

  // Botón eliminar trato
  document.getElementById('btnTratoDelete')?.addEventListener('click', async () => {
    if (!tratoActivo) return;
    const proveedor = tratoActivo.proveedorNombre || 'este proveedor';
    const ok = await askDeleteTrato('Eliminar trato', `¿Eliminar este trato con ${proveedor}? Esta acción no se puede deshacer.`, 'Eliminar');
    if (!ok) return;
    try {
      await deleteTrato(tratoActivo._id);
      getModal()?.close();
      toast('Trato eliminado', { variant: 'success' });
      await cargarTratos();
    } catch (e) {
      toast('Error al eliminar', { variant: 'error' });
    }
  });

  // Delegación en lista de condiciones
  document.getElementById('tratoCondicionesList')?.addEventListener('change', async e => {
    const select = e.target.closest('.trato-cond-estado');
    if (!select || !tratoActivo) return;
    const cid = select.dataset.cid;
    const condicion = (tratoActivo.condiciones || []).find(c => String(c._id) === cid);
    if (!condicion) return;
    try {
      const updated = await upsertCondicion(tratoActivo._id, { ...condicion, estado: select.value });
      tratoActivo = updated;
      renderCondiciones(updated.condiciones || []);
      await syncTratoEstadoFromCondiciones(updated);
    } catch (e) {
      toast('Error al actualizar condición', { variant: 'error' });
    }
  });

  document.getElementById('tratoCondicionesList')?.addEventListener('click', async e => {
    const edit = e.target.closest('.trato-cond-edit');
    if (edit && tratoActivo) {
      const cid = edit.dataset.cid;
      const condicion = (tratoActivo.condiciones || []).find(c => String(c._id) === String(cid));
      if (condicion) abrirModalEditarCondicion(condicion);
      return;
    }
    const btn = e.target.closest('.trato-cond-remove');
    if (!btn || !tratoActivo) return;
    const cid = btn.dataset.cid;
    const condicion = (tratoActivo.condiciones || []).find(c => String(c._id) === String(cid));
    const nombre = condicion?.nombre ? ` "${condicion.nombre}"` : '';
    const ok = await askDeleteCondicion('Eliminar condición', `¿Eliminar esta condición${nombre}?`, 'Eliminar');
    if (!ok) return;
    try {
      const updated = await removeCondicion(tratoActivo._id, cid);
      tratoActivo = updated;
      renderCondiciones(updated.condiciones || []);
    } catch (e) {
      toast('Error al eliminar condición', { variant: 'error' });
    }
  });

  // Agregar condición — modal
  document.getElementById('btnAgregarCondicion')?.addEventListener('click', async () => {
    if (!tratoActivo) {
      toast('Guarda el trato primero antes de agregar condiciones', { variant: 'warning' });
      return;
    }
    let maestros = [];
    try { maestros = await listCondicionesMaestro(); } catch {}
    if (!maestros.length) {
      toast('No hay condiciones configuradas en el maestro', { variant: 'warning' });
      return;
    }
    const yaAgregadas = new Set((tratoActivo.condiciones || []).map(c => String(c.condicionId || '')));
    const disponibles = maestros.filter(m => !yaAgregadas.has(String(m._id)));
    abrirModalCondicion(disponibles);
  });

  // Modal condición: botones y overlay
  document.getElementById('btnConfirmarCondicion')?.addEventListener('click', confirmarCondicion);
  document.getElementById('btnCancelarCondicion')?.addEventListener('click', cerrarModalCondicion);
  document.getElementById('btnCerrarCondicion')?.addEventListener('click', cerrarModalCondicion);
  document.getElementById('condicionModalWrap')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) cerrarModalCondicion();
  });
}

// ── Delegación de clics en la tabla ─────────────────────────────────────────
function bindTabla() {
  document.getElementById('tratosBody')?.addEventListener('click', e => {
    const btn = e.target.closest('.trato-btn-editar, .trato-row');
    if (!btn) return;
    const id = btn.dataset.id || btn.closest('[data-id]')?.dataset.id;
    if (!id) return;
    const trato = (tratosAll || []).find(t => String(t._id) === id) || (tratos || []).find(t => String(t._id) === id);
    if (trato) abrirModal(trato);
  });

  document.getElementById('btnNuevoTrato')?.addEventListener('click', () => abrirModal(null));
}

// ── Activación del tab ───────────────────────────────────────────────────────
function bindTabActivation() {
  const maybeLoad = async () => {
    const hash = String(window.location.hash || '');
    const panel = document.getElementById('tab-tratos');
    const isActive = !!(panel && (panel.classList.contains('active') || panel.classList.contains('is-active')));
    if (hash !== '#tab-tratos' && !isActive) return;
    syncTrtPeriodUI();
    await cargarTratos();
    booted = true;
  };

  // Click en el tab interno o en el sidebar (href contiene #tab-tratos)
  document.addEventListener('click', (e) => {
    const tabBtn = e.target?.closest?.('[data-c-tab="tab-tratos"]');
    const sideLink = e.target?.closest?.('a[href*=\"#tab-tratos\"]');
    if (!tabBtn && !sideLink) return;
    maybeLoad().catch((err) => console.error('[tratos] load on click error', err));
  }, true);

  // Activación por hash (incluye navegación por sidebar y deep-links)
  window.addEventListener('hashchange', () => {
    maybeLoad().catch((err) => console.error('[tratos] load on hashchange error', err));
  });

  // Activación programática (tabs modernizados)
  window.addEventListener('mmpp:navigate', () => {
    maybeLoad().catch((err) => console.error('[tratos] load on navigate error', err));
  });

  // Primer render (si se abre directo en #tab-tratos)
  setTimeout(() => {
    maybeLoad().catch((err) => console.error('[tratos] load on init error', err));
  }, 0);
}

// ── Exponer lista de contactos para búsqueda ─────────────────────────────────
function bindProveedorAutocomplete() {
  const input = document.getElementById('tratoProveedorInput');
  const drop  = document.getElementById('tratoProveedorDrop');
  const hidId = document.getElementById('tratoProveedorId');
  if (!input || !drop) return;

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    const contactos = window._contactosGuardados || [];
    // Si el usuario escribe manualmente, invalidar selección previa.
    if (hidId) hidId.value = '';
    if (!q) { drop.style.display = 'none'; return; }

    const matches = contactos.filter(c =>
      (c.proveedorNombre || '').toLowerCase().includes(q) ||
      (c.proveedorKey   || '').toLowerCase().includes(q)
    ).slice(0, 8);

    if (!matches.length) { drop.style.display = 'none'; return; }

    drop.innerHTML = matches.map(c =>
      `<div class="trato-autocomplete-item" data-id="${esc(c._id || c.id)}" data-nombre="${esc(c.proveedorNombre)}">${esc(c.proveedorNombre)} <small>${esc(c.proveedorKey || '')}</small></div>`
    ).join('');
    drop.style.display = '';
  });

  drop.addEventListener('click', e => {
    const item = e.target.closest('.trato-autocomplete-item');
    if (!item) return;
    input.value = item.dataset.nombre;
    hidId.value = item.dataset.id;
    drop.style.display = 'none';
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !drop.contains(e.target)) {
      drop.style.display = 'none';
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────
function ensureTratosEstadoUI() {
  const sel = document.getElementById('trt-f-estado');
  if (sel) {
    sel.innerHTML = [
      '<option value=\"\">Todos los estados</option>',
      '<option value=\"disponible\">Disponible</option>',
      '<option value=\"semi_acordado\">Semi-acordado</option>',
      '<option value=\"acordado\">Acordado</option>',
      '<option value=\"descartado\">Descartado</option>',
      '<option value=\"perdido\">Perdido</option>',
    ].join('');
  }

  const kpis = document.getElementById('tratosKpis');
  if (kpis) {
    kpis.innerHTML = [
      '<div class=\"trato-kpi\" data-estado=\"disponible\"><div class=\"k\">Disponibles</div><div class=\"v\">-</div></div>',
      '<div class=\"trato-kpi\" data-estado=\"semi_acordado\"><div class=\"k\">Semi-acordados</div><div class=\"v\">-</div></div>',
      '<div class=\"trato-kpi\" data-estado=\"acordado\"><div class=\"k\">Acordados</div><div class=\"v\">-</div></div>',
      '<div class=\"trato-kpi\" data-estado=\"descartado\"><div class=\"k\">Descartados</div><div class=\"v\">-</div></div>',
      '<div class=\"trato-kpi\" data-estado=\"perdido\"><div class=\"k\">Perdidos</div><div class=\"v\">-</div></div>',
    ].join('');
  }

  const estadoModal = document.getElementById('tratoEstado');
  if (estadoModal) {
    estadoModal.innerHTML = [
      '<option value=\"disponible\">Disponible</option>',
      '<option value=\"semi_acordado\">Semi-acordado</option>',
      '<option value=\"acordado\">Acordado</option>',
      '<option value=\"descartado\">Descartado</option>',
      '<option value=\"perdido\">Perdido</option>',
    ].join('');
  }
}

function init() {
  ensureTratosEstadoUI();
  bindTabActivation();
  bindFiltros();
  bindTabla();
  bindModal();
  bindProveedorAutocomplete();

  // Exponer función para refrescar desde otros módulos
  window.tratosRefresh = cargarTratos;
}

document.addEventListener('DOMContentLoaded', init);
