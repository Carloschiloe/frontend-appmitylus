// js/abastecimiento/asignacion/mensual.js
// Gestión mensual (macro): KPIs, requerimiento planta, asignar/borrar en bloque

import * as api from './api.js';
import * as estado from './estado.js';
import { fmt } from './utilidades.js';

/* ========= Helpers DOM ========= */
const $ = (sel, root = document) => root.querySelector(sel);
const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

const toMesKey = (val /* "YYYY-MM" o Date o "" */) => {
  if (!val) return '';
  if (/^\d{4}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ========= Requerimientos (con fallback) =========
   Intenta backend:
   - api.getPlanMes(mesKey, tipo)     -> { mesKey, tons, ... }
   - api.guardarPlanMes({mesKey, tipo, tons})
   Si no existen, usa localStorage como fallback.
*/
const REQ_LS_PREFIX = 'reqmes:'; // clave localStorage: reqmes:YYYY-MM|TIPO
const reqKey = (mesKey, tipo) => `${REQ_LS_PREFIX}${mesKey}|${(tipo || 'ALL').toUpperCase()}`;

// Reemplaza completamente estas funciones en mensual.js

async function getRequerimiento(mesKey, tipo) {
  try {
    if (typeof api.getPlanMes === 'function') {
      const r = await api.getPlanMes(mesKey, tipo);
      // acepta múltiples formas de respuesta del backend
      const val =
        r?.tons ??
        r?.item?.tons ??
        r?.data?.tons ??
        r?.result?.tons ??
        null;
      if (val != null) return Number(val) || 0;
    }
  } catch (e) {
    console.warn('[mensual] getPlanMes falló, uso fallback localStorage', e);
  }
  const raw = localStorage.getItem(reqKey(mesKey, tipo));
  return raw ? Number(raw) || 0 : 0;
}

async function guardarRequerimiento(mesKey, tipo, tons) {
  try {
    if (typeof api.guardarPlanMes === 'function') {
      const r = await api.guardarPlanMes({ mesKey, tons, tipo });
      // si la API devuelve ok/item, lo aceptamos; no necesitamos el valor
      return 'server';
    }
  } catch (e) {
    console.warn('[mensual] guardarPlanMes falló, guardo local', e);
  }
  localStorage.setItem(reqKey(mesKey, tipo), String(tons));
  return 'local';
}


async function borrarAsignacionesMes(mesKey, tipo) {
  if (typeof api.borrarAsignacionesMes === 'function') {
    return api.borrarAsignacionesMes({ mesKey, tipo });
  }
  throw new Error('No existe endpoint api.borrarAsignacionesMes().');
}

/* ========= Lectura de totales ========= */
async function calcularKPIs(mesKey, tipo) {
  const invPorTipo = estado.totalesMesPorTipo();   // Map "YYYY-MM|TIPO" -> tons
  const asigPorTipo = estado.asignadoMesPorTipo(); // Map "YYYY-MM|TIPO" -> tons

  let disponible = 0;
  let asignado = 0;

  if (tipo === 'ALL') {
    for (const [k, v] of invPorTipo.entries()) if (k.startsWith(`${mesKey}|`)) disponible += v;

    const asigConsolidado = estado.datos.asignadoPorMes.get(mesKey) || 0;
    let asigTipos = 0;
    for (const [k, v] of asigPorTipo.entries()) if (k.startsWith(`${mesKey}|`)) asigTipos += v;
    asignado = asigTipos > 0 ? asigTipos : asigConsolidado;
  } else {
    disponible = invPorTipo.get(`${mesKey}|${tipo}`) || 0;
    asignado   = asigPorTipo.get(`${mesKey}|${tipo}`) || 0;
  }

  const requerimiento = await getRequerimiento(mesKey, tipo);
  const saldo = disponible - asignado;

  return { disponible, requerimiento, asignado, saldo };
}

/* ========= UI wiring ========= */
async function actualizarKPIs() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
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
  M.updateTextFields?.();
}

function hoyMesKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ========= Acciones ========= */
async function onGuardarRequerimiento() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  const tons   = Number($('#mes_reqTons')?.value || 0);
  if (!mesKey || tons < 0) return M.toast?.({ html: 'Mes y valor válidos', classes: 'red' });

  const where = await guardarRequerimiento(mesKey, tipo, tons);
  M.toast?.({ html: where === 'server' ? 'Requerimiento guardado' : 'Requerimiento guardado localmente (sin backend)', classes: 'teal' });
  actualizarKPIs();
}

async function onAsignarMacro() {
  const mesKey    = toMesKey($('#mes_mes')?.value);
  const tipoSel   = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  let   tons      = Number($('#mes_asigTons')?.value || 0);
  const proveedor = ($('#mes_asigProv')?.value || '').trim();

  if (!mesKey || tons <= 0) return M.toast?.({ html: 'Ingresa mes y toneladas > 0', classes: 'red' });

  const saldo = estado.saldoMes({ mesKey, tipo: tipoSel });
  const asignable = clamp(tons, 0, Math.max(0, saldo));
  if (asignable <= 0) return M.toast?.({ html: 'No hay saldo disponible en el mes/tipo seleccionado', classes: 'orange' });
  if (asignable < tons) {
    M.toast?.({ html: `Se ajustó a ${fmt(asignable)} t por saldo`, classes: 'orange' });
    tons = asignable;
  }

  try {
    await api.crearAsignacion({
      mesKey,
      proveedorNombre: proveedor || '(macro mensual)',
      tons,
      tipo: tipoSel === 'ALL' ? 'NORMAL' : tipoSel,
      fuente: 'ui-mensual'
    });

    M.toast?.({ html: 'Asignación registrada', classes: 'teal' });
    await estado.refrescar(api);
    const asigInput = $('#mes_asigTons'); if (asigInput) asigInput.value = '';
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
  if (!confirm(`Borrar asignaciones del mes ${mesKey}${tipo !== 'ALL' ? ' (' + tipo + ')' : ''}?`)) return;

  try {
    await borrarAsignacionesMes(mesKey, tipo);
    M.toast?.({ html: 'Asignaciones del mes borradas', classes: 'teal' });
    await estado.refrescar(api);
    actualizarKPIs();
  } catch (e) {
    console.warn(e);
    M.toast?.({
      html: 'No hay endpoint de borrado. Implementa api.borrarAsignacionesMes() en el backend.',
      classes: 'orange'
    });
  }
}

async function onActualizar() {
  try { await estado.refrescar(api); } catch (e) { console.error(e); }
  actualizarKPIs();
}

function onReset() {
  const buscar = $('#mes_buscar'); if (buscar) buscar.value = '';
  const asig = $('#mes_asigTons'); if (asig) asig.value = '';
  M.updateTextFields?.();
  actualizarKPIs();
}

/* ========= Montaje ========= */
export function montar() {
  M.FormSelect.init(document.querySelectorAll('select'));
  const mesInp = $('#mes_mes');
  if (mesInp) mesInp.value = hoyMesKey();
  M.updateTextFields?.();

  $('#mes_mes')?.addEventListener('change', actualizarKPIs);
  $('#mes_tipo')?.addEventListener('change', actualizarKPIs);
  $('#mes_btnActualizar')?.addEventListener('click', onActualizar);
  $('#mes_btnReset')?.addEventListener('click', onReset);
  $('#mes_btnGuardarReq')?.addEventListener('click', onGuardarRequerimiento);
  $('#mes_btnAsignar')?.addEventListener('click', onAsignarMacro);
  $('#mes_btnBorrarAsig')?.addEventListener('click', onBorrarAsignacionesMes);

  actualizarKPIs();
}

