// js/abastecimiento/asignacion/mensual.js
// Gestión mensual (macro) + detalle del mes con edición y borrado

import * as api from './api.js';
import * as estado from './estado.js';
import { fmt } from './utilidades.js';

/* ========= Helpers ========= */
const $ = (sel, root = document) => root.querySelector(sel);
const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
const pad2 = (n) => String(n).padStart(2, '0');

const toMesKey = (val) => {
  if (!val) return '';
  if (/^\d{4}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (Number.isNaN(d)) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ========= Requerimiento (server con fallback local) ========= */
const REQ_LS_PREFIX = 'reqmes:'; // reqmes:YYYY-MM|TIPO
const reqKey = (mesKey, tipo) => `${REQ_LS_PREFIX}${mesKey}|${(tipo || 'ALL').toUpperCase()}`;

async function getRequerimiento(mesKey, tipo) {
  try {
    if (typeof api.getPlanMes === 'function') {
      // getPlanMes(mesKey) -> {mesKey, tons, ...}
      const r = await api.getPlanMes(mesKey);
      return Number(r?.tons) || 0;
    }
    if (typeof api.getRequerimientoMes === 'function') {
      const r = await api.getRequerimientoMes(mesKey, tipo);
      return Number(r?.tons) || 0;
    }
  } catch (e) {
    console.warn('[mensual] get requerimiento (server) falló, uso localStorage', e);
  }
  const raw = localStorage.getItem(reqKey(mesKey, tipo));
  return raw ? Number(raw) || 0 : 0;
}
async function guardarRequerimiento(mesKey, tipo, tons) {
  try {
    if (typeof api.guardarPlanMes === 'function') {
      const r = await api.guardarPlanMes({ mesKey, tons });
      return r?.ok ? 'server' : 'local';
    }
    if (typeof api.guardarRequerimientoMes === 'function') {
      await api.guardarRequerimientoMes({ mesKey, tipo, tons });
      return 'server';
    }
  } catch (e) {
    console.warn('[mensual] guardar requerimiento (server) falló, guardo local', e);
  }
  localStorage.setItem(reqKey(mesKey, tipo), String(tons));
  return 'local';
}

async function borrarAsignacionesMes(mesKey, tipo) {
  if (typeof api.borrarAsignacionesMes === 'function') {
    return api.borrarAsignacionesMes({ mesKey, tipo });
  }
  throw new Error('No existe api.borrarAsignacionesMes() en backend.');
}

/* ========= KPIs ========= */
async function calcularKPIs(mesKey, tipo) {
  const invPorTipo = estado.totalesMesPorTipo();   // Map "YYYY-MM|TIPO" -> tons
  const asigPorTipo = estado.asignadoMesPorTipo(); // Map "YYYY-MM|TIPO" -> tons

  let disponible = 0;
  let asignado = 0;

  if (tipo === 'ALL') {
    for (const [k, v] of invPorTipo.entries()) if (k.startsWith(`${mesKey}|`)) disponible += v;
    const totPorTipos = [...asigPorTipo.entries()]
      .filter(([k]) => k.startsWith(`${mesKey}|`))
      .reduce((s, [, v]) => s + v, 0);
    const consolidado = estado.datos.asignadoPorMes.get(mesKey) || 0;
    asignado = totPorTipos > 0 ? totPorTipos : consolidado;
  } else {
    disponible = invPorTipo.get(`${mesKey}|${tipo}`) || 0;
    asignado   = asigPorTipo.get(`${mesKey}|${tipo}`) || 0;
  }

  const requerimiento = await getRequerimiento(mesKey, tipo);
  const saldo = disponible - asignado;
  return { disponible, requerimiento, asignado, saldo };
}

/* ========= Detalle (lista de asignaciones del mes) ========= */
let tablaDetalle = null;

async function fetchAsignacionesMes(mesKey) {
  // Orígenes posibles (usamos el primero que exista):
  // - api.getAsignacionesMes(mesKey)
  // - estado.datos.asignaciones (array crudo)
  // - estado.getAsignaciones?()
  try {
    if (typeof api.getAsignacionesMes === 'function') {
      const arr = await api.getAsignacionesMes(mesKey);
      return Array.isArray(arr) ? arr : (Array.isArray(arr?.items) ? arr.items : []);
    }
  } catch (e) {
    console.warn('[mensual] getAsignacionesMes() falló', e);
  }
  const arr1 = Array.isArray(estado?.datos?.asignaciones) ? estado.datos.asignaciones : null;
  const arr2 = typeof estado.getAsignaciones === 'function' ? estado.getAsignaciones() : null;
  return (arr1 || arr2 || []).filter(r => r?.mesKey === mesKey);
}

function normalizarAsignacion(r) {
  const tons = Number(r?.tons ?? r?.asignado ?? r?.total ?? 0) || 0;
  const tipo = (r?.tipo || 'NORMAL').toUpperCase();
  return {
    id: r?.id || r?._id || `${r?.mesKey}-${r?.proveedorNombre}-${r?.createdAt || ''}`,
    mesKey: r?.mesKey || '',
    proveedor: r?.proveedorNombre || r?.proveedor || '',
    tipo,
    tons,
    camiones: tons / 10,
    fuente: r?.fuente || '',
    notas: r?.notas || '',
    createdAt: r?.createdAt || r?.fecha || r?._createdAt || null,
  };
}

function saldoAcumulado(datos, disponibleInicial) {
  // Orden por fecha de creación si existe, si no, por inserción
  const ordenados = [...datos].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });
  let restante = Number(disponibleInicial) || 0;
  const mapa = new Map();
  for (const row of ordenados) {
    restante -= Number(row.tons) || 0;
    mapa.set(row.id, restante);
  }
  return mapa; // id -> saldo post
}

async function renderDetalle() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  if (!mesKey) return;

  // trae y normaliza
  const crudo = await fetchAsignacionesMes(mesKey);
  let data = crudo.map(normalizarAsignacion)
    .filter(r => (tipo === 'ALL') ? true : r.tipo === tipo);

  // filtro por texto (opcional)
  const q = ($('#mes_buscar')?.value || '').toLowerCase().trim();
  if (q) {
    data = data.filter(r =>
      r.proveedor.toLowerCase().includes(q) ||
      r.notas.toLowerCase().includes(q)
    );
  }

  // toggle "solo macro mensual" (fuente === 'ui-mensual')
  const chkMacro = $('#mes_onlyMacro');
  if (chkMacro && chkMacro.checked) {
    data = data.filter(r => String(r.fuente).toLowerCase().includes('ui-mensual'));
  }

  // KPIs para saldo inicial
  const { disponible } = await calcularKPIs(mesKey, tipo);
  const saldoPorId = saldoAcumulado(data, disponible);
  data = data.map(r => ({ ...r, saldoPost: saldoPorId.get(r.id) }));

  // columnas
  const cols = [
    { title: 'Proveedor', field: 'proveedor', editor: 'input', width: 320 },
    { title: 'Tipo', field: 'tipo', width: 110, hozAlign: 'center' },
    { title: 'Toneladas', field: 'tons', hozAlign: 'right', headerHozAlign: 'right',
      editor: 'number', mutatorEdit: (v) => Number(v) || 0, formatter: c => fmt(c.getValue()) },
    { title: 'Camiones', field: 'camiones', hozAlign: 'right', headerHozAlign: 'right',
      formatter: c => fmt(c.getValue()), bottomCalc: 'sum', bottomCalcFormatter: c => fmt(c) },
    // columna nueva: saldo después de esta asignación
    { title: 'Saldo post', field: 'saldoPost', hozAlign: 'right', headerHozAlign: 'right',
      formatter: c => fmt(c.getValue()) },
    // ocultamos "fuente" (quedó para filtro opcional)
    // { title: 'Fuente', field: 'fuente', width: 110 },
    { title: 'Notas', field: 'notas', editor: 'input', width: 160 },
    {
      title: 'Acciones', field: 'acciones', width: 80, hozAlign: 'center', headerSort: false,
      formatter: () => `<i class="material-icons" style="cursor:pointer">delete</i>`,
      cellClick: async (_e, cell) => {
        const row = cell.getRow().getData();
        if (!confirm(`Eliminar asignación de "${row.proveedor}" por ${fmt(row.tons)} t?`)) return;
        try {
          if (typeof api.eliminarAsignacion === 'function') {
            await api.eliminarAsignacion(row.id);
          } else if (typeof api.deleteAsignacion === 'function') {
            await api.deleteAsignacion(row.id);
          } else {
            M.toast?.({ html: 'Falta endpoint de borrado en api.*', classes: 'orange' });
            return;
          }
          M.toast?.({ html: 'Asignación eliminada', classes: 'teal' });
          await estado.refrescar(api);
          renderDetalle(); // recarga
          actualizarKPIs(); // refresca kpis
        } catch (e) {
          console.error(e);
          M.toast?.({ html: 'Error al eliminar', classes: 'red' });
        }
      }
    },
  ];

  const wrap = document.getElementById('mesDetalleTable') || document.getElementById('asiRevisarTable');
  if (!wrap) return;

  if (tablaDetalle) {
    tablaDetalle.setColumns(cols);
    tablaDetalle.replaceData(data);
  } else {
    tablaDetalle = new Tabulator(wrap, {
      data,
      columns: cols,
      height: '420px',
      layout: 'fitColumns',
      columnMinWidth: 110,
      reactiveData: false,
      movableColumns: true,
      initialSort: [{ column: 'createdAt', dir: 'asc' }, { column: 'proveedor', dir: 'asc' }],
      rowDblClick: (_e, row) => {
        // toggle editor rápido en toneladas
        const c = row.getCell('tons');
        if (c) { try { row.getTable().navigateToCell(row, c.getColumn()); } catch {} }
      },
      cellEdited: async (cell) => {
        const row = cell.getRow().getData();
        const patch = {};
        if (cell.getField() === 'proveedor') patch.proveedorNombre = row.proveedor;
        if (cell.getField() === 'tons') {
          patch.tons = Number(row.tons) || 0;
          patch.camiones = patch.tons / 10;
        }
        if (cell.getField() === 'notas') patch.notas = row.notas;

        if (Object.keys(patch).length === 0) return;

        try {
          if (typeof api.actualizarAsignacion === 'function') {
            await api.actualizarAsignacion(row.id, patch);
          } else if (typeof api.updateAsignacion === 'function') {
            await api.updateAsignacion(row.id, patch);
          } else if (typeof api.patchAsignacion === 'function') {
            await api.patchAsignacion(row.id, patch);
          } else {
            M.toast?.({ html: 'Falta endpoint de actualización en api.*', classes: 'orange' });
            return;
          }
          await estado.refrescar(api);
          renderDetalle();
          actualizarKPIs();
          M.toast?.({ html: 'Asignación actualizada', classes: 'teal' });
        } catch (e) {
          console.error(e);
          M.toast?.({ html: 'Error al actualizar', classes: 'red' });
        }
      },
    });
  }
}

/* ========= UI: KPIs ========= */
async function actualizarKPIs() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  if (!mesKey) return;

  const { disponible, requerimiento, asignado, saldo } = await calcularKPIs(mesKey, tipo);

  setText('kpiDisp',  `${fmt(disponible)} t`);
  setText('kpiReq',   `${fmt(requerimiento)} t`);
  setText('kpiAsig',  `${fmt(asignado)} t`);
  setText('kpiSaldo', `${fmt(saldo)} t`);

  const reqInput  = $('#mes_reqTons');
  const asigInput = $('#mes_asigTons');
  if (reqInput && !reqInput.value) reqInput.value = requerimiento || '';
  if (asigInput)  asigInput.placeholder = `máx ${fmt(Math.max(0, saldo))} t`;

  // Cuando cambian KPIs, refrescamos el detalle (para recalcular saldo post)
  renderDetalle();
}

function hoyMesKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/* ========= Acciones principales ========= */
async function onGuardarRequerimiento() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  const tons   = Number($('#mes_reqTons')?.value || 0);
  if (!mesKey || tons < 0) {
    return M.toast?.({ html: 'Mes y valor válidos', classes: 'red' });
  }
  const where = await guardarRequerimiento(mesKey, tipo, tons);
  M.toast?.({
    html: where === 'server' ? 'Requerimiento guardado' : 'Requerimiento guardado localmente',
    classes: 'teal'
  });
  actualizarKPIs();
}

async function onAsignarMacro() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  let tons     = Number($('#mes_asigTons')?.value || 0);
  const prov   = ($('#mes_asigProv')?.value || '').trim();
  if (!mesKey || tons <= 0) {
    return M.toast?.({ html: 'Ingresa mes y toneladas > 0', classes: 'red' });
  }
  const saldo = estado.saldoMes({ mesKey, tipo });
  const asignable = clamp(tons, 0, Math.max(0, saldo));
  if (asignable <= 0) return M.toast?.({ html: 'No hay saldo disponible', classes: 'orange' });
  if (asignable < tons) {
    M.toast?.({ html: `Se ajustó a ${fmt(asignable)} t por saldo`, classes: 'orange' });
    tons = asignable;
  }
  try {
    await api.crearAsignacion({
      mesKey,
      proveedorNombre: prov || '(macro mensual)',
      tons,
      tipo: tipo === 'ALL' ? 'NORMAL' : tipo,
      fuente: 'ui-mensual',
    });
    M.toast?.({ html: 'Asignación registrada', classes: 'teal' });
    $('#mes_asigTons') && ($('#mes_asigTons').value = '');
    await estado.refrescar(api);
    actualizarKPIs();
  } catch (e) {
    console.error(e);
    M.toast?.({ html: 'Error guardando asignación', classes: 'red' });
  }
}

async function onBorrarAsignacionesMes() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  if (!mesKey) return;
  if (!confirm(`Borrar TODAS las asignaciones de ${mesKey}${tipo !== 'ALL' ? ' (' + tipo + ')' : ''}?`)) return;
  try {
    await borrarAsignacionesMes(mesKey, tipo);
    M.toast?.({ html: 'Asignaciones del mes borradas', classes: 'teal' });
    await estado.refrescar(api);
    actualizarKPIs();
  } catch (e) {
    console.warn(e);
    M.toast?.({ html: 'Falta endpoint de borrado en backend', classes: 'orange' });
  }
}

async function onActualizar() {
  try { await estado.refrescar(api); } catch (e) { console.error(e); }
  actualizarKPIs();
}

/* ========= Montaje ========= */
export function montar() {
  // Selects Materialize
  M.FormSelect.init(document.querySelectorAll('select'));

  // Defaults
  const mesInp = $('#mes_mes');
  if (mesInp) mesInp.value = hoyMesKey();
  M.updateTextFields?.();

  // Listeners
  $('#mes_mes')?.addEventListener('change', actualizarKPIs);
  $('#mes_tipo')?.addEventListener('change', actualizarKPIs);
  $('#mes_buscar')?.addEventListener('input', () => renderDetalle());
  $('#mes_onlyMacro')?.addEventListener('change', () => renderDetalle());

  $('#mes_btnActualizar')?.addEventListener('click', onActualizar);
  $('#mes_btnReset')?.addEventListener('click', () => {
    $('#mes_buscar') && ($('#mes_buscar').value = '');
    $('#mes_asigTons') && ($('#mes_asigTons').value = '');
    M.updateTextFields?.();
    actualizarKPIs();
  });
  $('#mes_btnGuardarReq')?.addEventListener('click', onGuardarRequerimiento);
  $('#mes_btnAsignar')?.addEventListener('click', onAsignarMacro);
  $('#mes_btnBorrarAsig')?.addEventListener('click', onBorrarAsignacionesMes);

  // Primer render
  actualizarKPIs();

  // Altura responsiva del detalle
  window.addEventListener('resize', () => {
    if (!tablaDetalle) return;
    const h = Math.max(360, window.innerHeight * 0.45);
    tablaDetalle.setHeight(h + 'px');
  });
}
