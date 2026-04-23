// js/maestros/index.js
import { toast } from '../ui/toast.js';
import { createModalConfirm, getModalInstance } from '../abastecimiento/contactos/ui-common.js';

const API = (window.API_URL || '/api').replace(/\/$/, '');

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ── API ──────────────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}
const apiGet    = (path)         => apiFetch(path);
const apiPost   = (path, body)   => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) });
const apiPatch  = (path, body)   => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(body) });
const apiDelete = (path)         => apiFetch(path, { method: 'DELETE' });

// ── Config de secciones ───────────────────────────────────────────────────────
const SECCIONES = [
  {
    tipo: 'categoria-muestreo',
    tabId: 'tab-categorias',
    tableId: 'tbl-categorias',
    emptyMsg: 'Sin categorías registradas.',
    cols: ['nombre', 'tipoCat', 'orden', 'activo'],
    renderRow: (it) => `
      <tr data-id="${it._id}">
        <td><strong>${esc(it.nombre)}</strong></td>
        <td>${tipoCatBadge(it.tipoCat)}</td>
        <td class="num">${it.orden ?? 0}</td>
        <td>${activoBadge(it.activo)}</td>
        <td>
          <div class="mini-actions">
            <a href="#!" class="js-edit" title="Editar"><i class="bi bi-pencil"></i></a>
            <a href="#!" class="js-toggle" title="${it.activo ? 'Desactivar' : 'Activar'}">
              <i class="bi bi-${it.activo ? 'pause-circle' : 'play-circle'}"></i>
            </a>
            <a href="#!" class="mini-del js-delete" title="Eliminar"><i class="bi bi-trash"></i></a>
          </div>
        </td>
      </tr>`,
  },
  {
    tipo: 'proximo-paso',
    tabId: 'tab-pasos',
    tableId: 'tbl-pasos',
    emptyMsg: 'Sin próximos pasos registrados.',
    cols: ['nombre', 'orden', 'activo'],
    renderRow: (it) => `
      <tr data-id="${it._id}">
        <td><strong>${esc(it.nombre)}</strong></td>
        <td class="num">${it.orden ?? 0}</td>
        <td>${activoBadge(it.activo)}</td>
        <td>
          <div class="mini-actions">
            <a href="#!" class="js-edit" title="Editar"><i class="bi bi-pencil"></i></a>
            <a href="#!" class="js-toggle" title="${it.activo ? 'Desactivar' : 'Activar'}">
              <i class="bi bi-${it.activo ? 'pause-circle' : 'play-circle'}"></i>
            </a>
            <a href="#!" class="mini-del js-delete" title="Eliminar"><i class="bi bi-trash"></i></a>
          </div>
        </td>
      </tr>`,
  },
  {
    tipo: 'responsable',
    tabId: 'tab-responsables',
    tableId: 'tbl-responsables',
    emptyMsg: 'Sin responsables registrados.',
    cols: ['nombre', 'activo'],
    renderRow: (it) => `
      <tr data-id="${it._id}">
        <td><strong>${esc(it.nombre)}</strong></td>
        <td>${activoBadge(it.activo)}</td>
        <td>
          <div class="mini-actions">
            <a href="#!" class="js-edit" title="Editar"><i class="bi bi-pencil"></i></a>
            <a href="#!" class="js-toggle" title="${it.activo ? 'Desactivar' : 'Activar'}">
              <i class="bi bi-${it.activo ? 'pause-circle' : 'play-circle'}"></i>
            </a>
            <a href="#!" class="mini-del js-delete" title="Eliminar"><i class="bi bi-trash"></i></a>
          </div>
        </td>
      </tr>`,
  },
  {
    tipo: 'condicion_negociacion',
    tabId: 'tab-condiciones',
    tableId: 'tbl-condiciones',
    emptyMsg: 'Sin condiciones de negociación registradas.',
    cols: ['nombre', 'tipoValor', 'opciones', 'requerido', 'orden', 'activo'],
    renderRow: (it) => {
      const opcionesStr = Array.isArray(it.opciones) && it.opciones.length
        ? it.opciones.join(', ')
        : '—';
      return `
      <tr data-id="${it._id}">
        <td><strong>${esc(it.nombre)}</strong></td>
        <td>${tipoValorBadge(it.tipoValor)}</td>
        <td style="font-size:12px;color:#64748b;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(opcionesStr)}">${esc(opcionesStr)}</td>
        <td>${it.requerido ? '<span style="color:#ef4444;font-weight:700;font-size:12px;">Sí</span>' : '<span style="color:#94a3b8;font-size:12px;">No</span>'}</td>
        <td class="num">${it.orden ?? 0}</td>
        <td>${activoBadge(it.activo)}</td>
        <td>
          <div class="mini-actions">
            <a href="#!" class="js-edit" title="Editar"><i class="bi bi-pencil"></i></a>
            <a href="#!" class="js-toggle" title="${it.activo ? 'Desactivar' : 'Activar'}">
              <i class="bi bi-${it.activo ? 'pause-circle' : 'play-circle'}"></i>
            </a>
            <a href="#!" class="mini-del js-delete" title="Eliminar"><i class="bi bi-trash"></i></a>
          </div>
        </td>
      </tr>`;
    },
  },
];

// ── Helpers visuales ──────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function activoBadge(activo) {
  return activo
    ? `<span class="maest-badge maest-badge--on">Activo</span>`
    : `<span class="maest-badge maest-badge--off">Inactivo</span>`;
}

function tipoCatBadge(tipo) {
  const map = {
    procesable: ['am-label-green', 'Procesable'],
    rechazo:    ['am-label-red', 'Rechazo'],
    defecto:    ['am-label-blue', 'Defecto'],
  };
  const [cls, label] = map[tipo] || ['am-label-gray', '—'];
  return `<span class="am-indicator-label ${cls}">
    <span class="am-indicator-dot"></span>${label}
  </span>`;
}

function tipoValorBadge(tipo) {
  const map = {
    moneda:     ['am-tag-teal', '$'],
    porcentaje: ['am-tag-purple', '%'],
    dias:       ['am-tag-blue', 'Días'],
    numero:     ['am-tag-amber', 'Núm.'],
    opciones:   ['am-tag-orange', 'Lista'],
    texto:      ['am-tag-slate', 'Texto'],
  };
  const [cls, label] = map[tipo] || ['am-tag-gray', '—'];
  return `<span class="am-tag ${cls}">${label}</span>`;
}

const askDeleteMaestro = createModalConfirm({
  id: 'modalConfirmDeleteMaestro',
  defaultTitle: 'Eliminar registro',
  defaultMessage: '¿Eliminar este registro? Esta acción no se puede deshacer.',
  cancelText: 'Cancelar',
  acceptText: 'Eliminar'
});

// ── Estado del modal ──────────────────────────────────────────────────────────
let modalState = { tipo: null, id: null };

function abrirModal(tipo, item = null) {
  modalState = { tipo, id: item?._id || null };

  const modal = $('#modalMaestro');
  const titulo = item ? 'Editar' : 'Nuevo';
  const tipoLabel = {
    'categoria-muestreo':  'Categoría de muestreo',
    'proximo-paso':        'Próximo paso',
    'responsable':         'Responsable',
    'condicion_negociacion': 'Condición de negociación',
  }[tipo] || tipo;

  $('#modalMaestroTitle').textContent = `${titulo} — ${tipoLabel}`;

  // Campos base
  $('#m-nombre').value   = item?.nombre  ?? '';
  $('#m-orden').value    = item?.orden   ?? 0;
  $('#m-activo').checked = item ? item.activo : true;

  // tipoCat: solo para categoria-muestreo
  const tipoCatRow = $('#m-tipoCat-row');
  if (tipo === 'categoria-muestreo') {
    tipoCatRow.style.display = '';
    $('#m-tipoCat').value = item?.tipoCat ?? 'procesable';
  } else {
    tipoCatRow.style.display = 'none';
  }

  // Campos de condicion_negociacion
  const esCondicion = tipo === 'condicion_negociacion';
  $('#m-tipoValor-row').style.display = esCondicion ? '' : 'none';
  $('#m-requerido-row').style.display = esCondicion ? '' : 'none';
  if (esCondicion) {
    const tv = item?.tipoValor ?? 'texto';
    $('#m-tipoValor').value    = tv;
    const modo = item?.modoCondicion ?? '';
    $('#m-modoCondicion').value = modo;
    $('#m-requerido').checked  = item?.requerido ?? false;
    const opcionesArr = Array.isArray(item?.opciones) ? item.opciones : [];
    $('#m-opciones').value = opcionesArr.join('\n');
    // Mostrar/ocultar filas según tipo
    $('#m-opciones-row').style.display      = tv === 'opciones' ? '' : 'none';
    $('#m-unidadNombre-row').style.display  = tv === 'numero'   ? '' : 'none';
    $('#m-unidadNombre').value = item?.unidadNombre ?? '';

    // Modo normal/fijo solo aplica (por ahora) a condiciones porcentaje (ej: Descuento/Rechazo Planta)
    $('#m-modoCondicion-row').style.display = tv === 'porcentaje' ? '' : 'none';
    if (tv !== 'porcentaje') $('#m-modoCondicion').value = '';
  } else {
    $('#m-opciones-row').style.display     = 'none';
    $('#m-unidadNombre-row').style.display = 'none';
    $('#m-modoCondicion-row').style.display = 'none';
  }

  // Orden: no aplica para responsable
  $('#m-orden-row').style.display = tipo === 'responsable' ? 'none' : '';

  // Abrir
  getModalInstance(modal, { dismissible: true })?.open();
  $('#m-nombre').focus();
}

function cerrarModal() {
  getModalInstance('modalMaestro')?.close();
}

// ── Seed de datos por defecto ────────────────────────────────────────────────
async function seedDefaults() {
  try {
    await apiPost('/maestros/seed', {});
    toast('Datos por defecto cargados');
    SECCIONES.forEach(cargarSeccion);
  } catch { toast('Error al cargar defaults', false); }
}

// ── Carga y render de tabla ───────────────────────────────────────────────────
async function cargarSeccion(sec) {
  const tbody = $(`#${sec.tableId} tbody`);
  tbody.innerHTML = `<tr><td colspan="10" style="color:#94a3b8;padding:16px;">Cargando...</td></tr>`;
  try {
    const { items } = await apiGet(`/maestros?tipo=${sec.tipo}`);
    if (!items.length) {
      const cols = sec.cols.length + 1;
      tbody.innerHTML = `
        <tr>
          <td colspan="${cols}" style="padding:28px 16px;text-align:center;">
            <p style="color:#94a3b8;margin:0 0 12px;font-size:13px;">${sec.emptyMsg}</p>
            <button class="am-btn am-btn-flat js-seed-btn" style="font-size:12px;height:34px;padding:0 16px;border:1px solid #e2e8f0;">
              <i class="bi bi-download"></i> Cargar valores por defecto
            </button>
          </td>
        </tr>`;
      tbody.querySelector('.js-seed-btn')?.addEventListener('click', seedDefaults);
      return;
    }
    tbody.innerHTML = items.map(sec.renderRow).join('');
    bindTableActions(tbody, sec);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="10" style="color:#ef4444;padding:16px;">Error cargando datos</td></tr>`;
    console.error(e);
  }
}

function bindTableActions(tbody, sec) {
  tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;

    tr.querySelector('.js-edit')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const { items } = await apiGet(`/maestros?tipo=${sec.tipo}`);
      const item = items.find((i) => i._id === id);
      if (!item) return;
      if (sec.onEdit) sec.onEdit(item);
      else abrirModal(sec.tipo, item);
    });

    tr.querySelector('.js-toggle')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const activoActual = tr.querySelector('.maest-badge--on') !== null;
      try {
        await apiPatch(`/maestros/${id}`, { activo: !activoActual });
        toast(activoActual ? 'Desactivado' : 'Activado');
        cargarSeccion(sec);
      } catch { toast('Error al cambiar estado', false); }
    });

    tr.querySelector('.js-delete')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const ok = await askDeleteMaestro('Eliminar registro', '¿Eliminar este registro? Esta acción no se puede deshacer.', 'Eliminar');
      if (!ok) return;
      try {
        await apiDelete(`/maestros/${id}`);
        toast('Eliminado');
        cargarSeccion(sec);
      } catch { toast('Error al eliminar', false); }
    });
  });
}

// ── Guardar modal ─────────────────────────────────────────────────────────────
async function guardarMaestro() {
  const { tipo, id } = modalState;
  const nombre = $('#m-nombre').value.trim();
  if (!nombre) { $('#m-nombre').focus(); return; }

  const body = {
    tipo,
    nombre,
    activo: $('#m-activo').checked,
    orden:  Number($('#m-orden').value) || 0,
  };

  if (tipo === 'categoria-muestreo') {
    body.tipoCat = $('#m-tipoCat').value;
  }

  if (tipo === 'condicion_negociacion') {
    body.tipoValor    = $('#m-tipoValor').value;
    const tv = body.tipoValor;
    const modo = $('#m-modoCondicion')?.value || '';
    body.modoCondicion = tv === 'porcentaje' ? (modo || null) : null;
    body.requerido    = $('#m-requerido').checked;
    body.unidadNombre = $('#m-unidadNombre').value.trim();
    // Opciones: una por línea → array limpio
    const opcionesRaw = $('#m-opciones').value || '';
    body.opciones = opcionesRaw.split('\n').map(s => s.trim()).filter(Boolean);
  }

  const btn = $('#m-guardar');
  btn.disabled = true;
  try {
    if (id) await apiPatch(`/maestros/${id}`, body);
    else    await apiPost('/maestros', body);
    toast(id ? 'Actualizado' : 'Guardado');
    cerrarModal();
    const sec = SECCIONES.find((s) => s.tipo === tipo);
    if (sec) cargarSeccion(sec);
  } catch (e) {
    toast('Error al guardar', false);
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}

// ── Clasificaciones de producto ───────────────────────────────────────────────

const TIPO_COLORES = {
  'Entero':       ['#0d9488', 'bi-award'],
  'Media Concha': ['#2563eb', 'bi-gem'],
  'Carne':        ['#d97706', 'bi-droplet-half'],
};
const PRIORIDAD_TIPO = { 'Entero': 1, 'Media Concha': 2, 'Carne': 3 };

// Parámetros fijos del muestreo (siempre disponibles)
const PARAMS_FIJOS = [
  { campo: 'uxkg',        campoId: null, nombre: 'Calibre',      unidad: 'un/kg' },
  { campo: 'rendimiento', campoId: null, nombre: 'Rendimiento',  unidad: '%' },
  { campo: 'procesable',  campoId: null, nombre: '% Procesable', unidad: '%' },
  { campo: 'rechazos',    campoId: null, nombre: '% Rechazos',   unidad: '%' },
  { campo: 'defectos',    campoId: null, nombre: '% Defectos',   unidad: '%' },
];

// Catálogo completo de parámetros disponibles (fijos + dinámicos desde maestros)
let _paramsCatalogo = [];

async function cargarParamsCatalogo() {
  const { items } = await apiGet('/maestros?tipo=categoria-muestreo&soloActivos=true');
  const dinamicos = (items || []).map(it => ({
    campo:   'cats',
    campoId: it._id,
    nombre:  it.nombre,
    unidad:  '%',
  }));
  _paramsCatalogo = [...PARAMS_FIJOS, ...dinamicos];
}

function tipoPrincipalBadge(tipo) {
  const [color, icon] = TIPO_COLORES[tipo] || ['#94a3b8', 'bi-question'];
  return `<span style="background:${color}18;color:${color};border:1px solid ${color}30;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
    <i class="bi ${icon}" style="font-size:10px;"></i>${esc(tipo || '—')}
  </span>`;
}

function resumenParametros(parametros) {
  if (!parametros?.length) return '<span style="color:#94a3b8;font-size:12px;">—</span>';
  return parametros.map(p => {
    const min = p.min != null ? p.min : '∞';
    const max = p.max != null ? p.max : '∞';
    return `<span style="font-size:11px;background:#f1f5f9;border-radius:4px;padding:1px 6px;margin:1px;display:inline-block;">${esc(p.nombre)}: ${min}–${max} ${esc(p.unidad)}</span>`;
  }).join('');
}

SECCIONES.push({
  tipo: 'clasificacion_producto',
  tabId: 'tab-clasificaciones',
  tableId: 'tbl-clasificaciones',
  emptyMsg: 'Sin clasificaciones registradas.',
  cols: ['tipoPrincipal', 'clienteNombre', 'parametros', 'activo'],
  onEdit: (item) => abrirModalClasificacion(item),
  renderRow: (it) => `
    <tr data-id="${it._id}">
      <td>${tipoPrincipalBadge(it.tipoPrincipal)}</td>
      <td style="font-size:12px;color:#64748b;">${esc(it.clienteNombre || '—')}</td>
      <td style="max-width:300px;">${resumenParametros(it.parametros)}</td>
      <td>${activoBadge(it.activo)}</td>
      <td>
        <div class="mini-actions">
          <a href="#!" class="js-edit" title="Editar"><i class="bi bi-pencil"></i></a>
          <a href="#!" class="js-toggle" title="${it.activo ? 'Desactivar' : 'Activar'}">
            <i class="bi bi-${it.activo ? 'pause-circle' : 'play-circle'}"></i>
          </a>
          <a href="#!" class="mini-del js-delete" title="Eliminar"><i class="bi bi-trash"></i></a>
        </div>
      </td>
    </tr>`,
});

// ── Modal clasificación ───────────────────────────────────────────────────────

let clasState = { id: null };

// Clave única de un parámetro para identificarlo en la lista
function paramKey(p) {
  return p.campo === 'cats' ? `cats:${p.campoId}` : p.campo;
}

// Reconstruye el select de parámetros disponibles (excluye los ya agregados)
function refreshParamPicker() {
  const picker = $('#cl-param-picker');
  const usados = new Set($$('#cl-params-list [data-param-key]').map(el => el.dataset.paramKey));
  picker.innerHTML = '<option value="">— Seleccionar parámetro —</option>';
  _paramsCatalogo.forEach(p => {
    const key = paramKey(p);
    if (usados.has(key)) return;
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${p.nombre} (${p.unidad})`;
    picker.appendChild(opt);
  });
}

function actualizarEmptyState() {
  const lista = $('#cl-params-list');
  const empty = $('#cl-params-empty');
  if (!lista || !empty) return;
  const hayItems = lista.children.length > 0;
  empty.style.display = hayItems ? 'none' : 'block';
}

function agregarParamRow(p, min = '', max = '') {
  const lista = $('#cl-params-list');
  const key   = paramKey(p);
  const row   = document.createElement('div');
  row.dataset.paramKey  = key;
  row.dataset.campo     = p.campo;
  row.dataset.campoId   = p.campoId || '';
  row.dataset.nombre    = p.nombre;
  row.dataset.unidad    = p.unidad;
  row.style.cssText     = 'display:flex;align-items:center;gap:8px;padding:6px 8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;';
  row.innerHTML = `
    <span style="flex:1;font-size:13px;font-weight:600;color:#334155;">${esc(p.nombre)}</span>
    <input type="number" class="am-input p-min" placeholder="Mín" value="${min}"
      style="width:74px;text-align:center;padding:4px 6px;height:32px;" step="0.1" min="0">
    <span style="font-size:11px;color:#94a3b8;">a</span>
    <input type="number" class="am-input p-max" placeholder="Máx" value="${max}"
      style="width:74px;text-align:center;padding:4px 6px;height:32px;" step="0.1" min="0">
    <span style="font-size:11px;color:#64748b;min-width:36px;">${esc(p.unidad)}</span>
    <button type="button" class="js-rm-param" title="Quitar"
      style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:0 4px;line-height:1;">&times;</button>`;
  row.querySelector('.js-rm-param').addEventListener('click', () => {
    row.remove();
    refreshParamPicker();
    actualizarEmptyState();
  });
  lista.appendChild(row);
  refreshParamPicker();
  actualizarEmptyState();
}

async function abrirModalClasificacion(item = null) {
  clasState.id = item?._id || null;
  $('#modalClasificacionTitle').textContent = item ? 'Editar clasificación' : 'Nueva clasificación';
  $('#cl-tipo').value     = item?.tipoPrincipal ?? 'Entero';
  $('#cl-cliente').value  = item?.clienteNombre ?? '';
  $('#cl-activo').checked = item ? item.activo  : true;

  // Limpiar lista de parámetros
  $('#cl-params-list').innerHTML = '';

  // Cargar catálogo si no está cargado
  if (!_paramsCatalogo.length) await cargarParamsCatalogo();

  // Si es edición, repoblar parámetros existentes
  if (item?.parametros?.length) {
    item.parametros.forEach(p => {
      const def = _paramsCatalogo.find(c => paramKey(c) === paramKey(p)) || p;
      agregarParamRow({ ...def, nombre: p.nombre, unidad: p.unidad },
        p.min != null ? p.min : '',
        p.max != null ? p.max : '');
    });
  }

  actualizarEmptyState();
  refreshParamPicker();
  getModalInstance('modalClasificacion', { dismissible: true })?.open();
}

function cerrarModalClasificacion() {
  getModalInstance('modalClasificacion')?.close();
}

async function guardarClasificacion() {
  const tipoPrincipal = $('#cl-tipo').value;

  const parametros = [];
  $$('#cl-params-list [data-param-key]').forEach(row => {
    const minRaw = row.querySelector('.p-min').value.trim();
    const maxRaw = row.querySelector('.p-max').value.trim();
    parametros.push({
      campo:   row.dataset.campo,
      campoId: row.dataset.campoId || null,
      nombre:  row.dataset.nombre,
      unidad:  row.dataset.unidad,
      min:     minRaw !== '' ? Number(minRaw) : null,
      max:     maxRaw !== '' ? Number(maxRaw) : null,
    });
  });

  const cliente = $('#cl-cliente').value.trim();
  const body = {
    tipo:          'clasificacion_producto',
    nombre:        tipoPrincipal + (cliente ? ` — ${cliente}` : ''),
    tipoPrincipal,
    prioridad:     PRIORIDAD_TIPO[tipoPrincipal] ?? 99,
    clienteNombre: cliente,
    activo:        $('#cl-activo').checked,
    parametros,
  };

  const btn = $('#cl-guardar');
  btn.disabled = true;
  try {
    if (clasState.id) await apiPatch(`/maestros/${clasState.id}`, body);
    else              await apiPost('/maestros', body);
    toast(clasState.id ? 'Clasificación actualizada' : 'Clasificación guardada');
    cerrarModalClasificacion();
    const sec = SECCIONES.find(s => s.tipo === 'clasificacion_producto');
    if (sec) cargarSeccion(sec);
  } catch (e) {
    toast('Error al guardar', false);
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function initTabs() {
  const tabs = $$('.maest-tab-btn');
  const panels = $$('.maest-panel');

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = $(`#${btn.dataset.tab}`);
      panel?.classList.add('active');

      // Carga lazy
      const sec = SECCIONES.find((s) => s.tabId === btn.dataset.tab);
      if (sec && !panel?.dataset.loaded) {
        cargarSeccion(sec);
        panel.dataset.loaded = '1';
      }
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();

  // Cargar primera tab por defecto
  const firstSec = SECCIONES[0];
  cargarSeccion(firstSec);
  $(`#${firstSec.tabId}`)?.setAttribute('data-loaded', '1');

  // Botones "Nuevo"
  $$('[data-nuevo]').forEach((btn) => {
    btn.addEventListener('click', () => abrirModal(btn.dataset.nuevo));
  });

  // Botón "Nueva clasificación"
  $('#btnNuevaClasificacion')?.addEventListener('click', () => abrirModalClasificacion());

  // Modal clasificación: guardar / cancelar / agregar parámetro
  $('#cl-guardar')?.addEventListener('click', guardarClasificacion);
  $$('.js-clas-close').forEach(b => b.addEventListener('click', cerrarModalClasificacion));

  $('#cl-add-param')?.addEventListener('click', () => {
    const picker = $('#cl-param-picker');
    const key = picker.value;
    if (!key) return;
    const p = _paramsCatalogo.find(c => paramKey(c) === key);
    if (p) agregarParamRow(p);
    picker.value = '';
  });

  // Modal guardar / cancelar
  $('#m-guardar')?.addEventListener('click', guardarMaestro);
  $$('.js-modal-close').forEach((b) => b.addEventListener('click', cerrarModal));

  // Enter en nombre guarda
  $('#m-nombre')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') guardarMaestro();
  });

  // Mostrar/ocultar campos según tipoValor
  $('#m-tipoValor')?.addEventListener('change', (e) => {
    const tv = e.target.value;
    $('#m-opciones-row').style.display     = tv === 'opciones' ? '' : 'none';
    $('#m-unidadNombre-row').style.display = tv === 'numero'   ? '' : 'none';

    $('#m-modoCondicion-row').style.display = tv === 'porcentaje' ? '' : 'none';
    if (tv !== 'porcentaje') $('#m-modoCondicion').value = '';
  });
});
