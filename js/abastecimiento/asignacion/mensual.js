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
   Si tu backend expone:
   - api.getRequerimientoMes(mesKey, tipo) -> { tons: number }
   - api.guardarRequerimientoMes({mesKey, tipo, tons})
   - api.borrarAsignacionesMes({mesKey, tipo})   // opcional
   los usamos. Si no existen, guardamos en localStorage como fallback.
*/
const REQ_LS_PREFIX = 'reqmes:'; // clave localStorage: reqmes:YYYY-MM|TIPO

function keyReq(mesKey, tipo) {
  return `${REQ_LS_PREFIX}${mesKey}|${(tipo || 'ALL').toUpperCase()}`;
}
async function getRequerimiento(mesKey, tipo) {
  try {
    if (typeof api.getRequerimientoMes === 'function') {
      const r = await api.getRequerimientoMes(mesKey, tipo);
      return Number(r?.tons) || 0;
    }
  } catch (e) {
    console.warn('[mensual] getRequerimientoMes backend falló, uso fallback localStorage', e);
  }
  // fallback
  const raw = localStorage.getItem(keyReq(mesKey, tipo));
  return raw ? Number(raw) || 0 : 0;
}
async function guardarRequerimiento(mesKey, tipo, tons) {
  try {
    if (typeof api.guardarRequerimientoMes === 'function') {
      await api.guardarRequerimientoMes({ mesKey, tipo, tons });
      return 'server';
    }
  } catch (e) {
    console.warn('[mensual] guardarRequerimientoMes backend falló, guardo local', e);
  }
  localStorage.setItem(keyReq(mesKey, tipo), String(tons));
  return 'local';
}

async function borrarAsignacionesMes(mesKey, tipo) {
  if (typeof api.borrarAsignacionesMes === 'function') {
    return api.borrarAsignacionesMes({ mesKey, tipo });
  }
  // Si no hay endpoint de borrado, avisamos.
  throw new Error(
    'No existe endpoint api.borrarAsignacionesMes(). Implementa el backend o borra manualmente.'
  );
}

/* ========= Lectura de totales ========= */
async function calcularKPIs(mesKey, tipo) {
  // Requiere que estado.cargarTodo(api) ya haya corrido en principal.js
  const invPorTipo = estado.totalesMesPorTipo();   // Map "YYYY-MM|TIPO" -> tons
  const asigPorTipo = estado.asignadoMesPorTipo(); // Map "YYYY-MM|TIPO" -> tons

  let disponible = 0;
  let asignado = 0;

  if (tipo === 'ALL') {
    // sumar por todos los tipos del mes
    for (const [k, v] of invPorTipo.entries()) {
      if (k.startsWith(`${mesKey}|`)) disponible += v;
    }
    // asignado mensual (map por tipo) + asignado sin tipo (map consolidado del estado)
    const asigMesConsolidado = estado.datos.asignadoPorMes.get(mesKey) || 0;
    let asigPorTipos = 0;
    for (const [k, v] of asigPorTipo.entries()) {
      if (k.startsWith(`${mesKey}|`)) asigPorTipos += v;
    }
    // priorizamos mapa por tipos; si está vacío, usamos consolidado
    asignado = asigPorTipos > 0 ? asigPorTipos : asigMesConsolidado;
  } else {
    disponible = invPorTipo.get(`${mesKey}|${tipo}`) || 0;
    asignado = asigPorTipo.get(`${mesKey}|${tipo}`) || 0;
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

  setText('kpiDisp', `${fmt(disponible)} t`);
  setText('kpiReq', `${fmt(requerimiento)} t`);
  setText('kpiAsig', `${fmt(asignado)} t`);
  setText('kpiSaldo', `${fmt(saldo)} t`);

  // Deja requerimiento y sugerencia de asignar en los inputs
  const reqInput = $('#mes_reqTons');
  const asigInput = $('#mes_asigTons');
  if (reqInput && !reqInput.value) reqInput.value = requerimiento || '';
  if (asigInput && !asigInput.value) asigInput.placeholder = `máx ${fmt(Math.max(0, saldo))} t`;
  M.updateTextFields?.();
}

function hoyMesKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ========= Acciones ========= */
async function onGuardarRequerimiento() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  const tons = Number($('#mes_reqTons')?.value || 0);
  if (!mesKey || tons < 0) {
    return M.toast?.({ html: 'Mes y valor válidos', classes: 'red' });
  }
  const where = await guardarRequerimiento(mesKey, tipo, tons);
  M.toast?.({ html: where === 'server' ? 'Requerimiento guardado' : 'Requerimiento guardado localmente (sin backend)', classes: 'teal' });
  actualizarKPIs();
}

async function onAsignarMacro() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
  let tons = Number($('#mes_asigTons')?.value || 0);
  const proveedor = ($('#mes_asigProv')?.value || '').trim();

  if (!mesKey || tons <= 0) {
    return M.toast?.({ html: 'Ingresa mes y toneladas > 0', classes: 'red' });
  }

  // Valida contra saldo mensual
  const saldo = estado.saldoMes({ mesKey, tipo });
  const asignable = clamp(tons, 0, Math.max(0, saldo));
  if (asignable <= 0) {
    return M.toast?.({ html: 'No hay saldo disponible en el mes/tipo seleccionado', classes: 'orange' });
  }
  if (asignable < tons) {
    M.toast?.({ html: `Se ajustó a ${fmt(asignable)} t por saldo`, classes: 'orange' });
    tons = asignable;
  }

  // Creamos 1 asignación mensual (opcional con proveedor)
  try {
    await api.crearAsignacion({
      mesKey,
      proveedorNombre: proveedor || '(macro mensual)',
      tons,
      tipo: tipo === 'ALL' ? 'NORMAL' : tipo, // si ALL, tratamos como NORMAL
      fuente: 'ui-mensual'
    });

    M.toast?.({ html: 'Asignación registrada', classes: 'teal' });
    await estado.refrescar(api);
    // limpiar monto y refrescar KPIs
    const asigInput = $('#mes_asigTons'); if (asigInput) asigInput.value = '';
    actualizarKPIs();
  } catch (e) {
    console.error(e);
    M.toast?.({ html: 'Error guardando asignación', classes: 'red' });
  }
}

async function onBorrarAsignacionesMes() {
  const mesKey = toMesKey($('#mes_mes')?.value);
  const tipo = ($('#mes_tipo')?.value || 'ALL').toUpperCase();
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
  try {
    await estado.refrescar(api);
  } catch (e) {
    console.error(e);
  }
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
  // Inicializa selects Materialize
  M.FormSelect.init(document.querySelectorAll('select'));

  // Defaults
  const mesInp = $('#mes_mes');
  if (mesInp) mesInp.value = hoyMesKey();
  M.updateTextFields?.();

  // Listeners
  $('#mes_mes')?.addEventListener('change', actualizarKPIs);
  $('#mes_tipo')?.addEventListener('change', actualizarKPIs);
  $('#mes_btnActualizar')?.addEventListener('click', onActualizar);
  $('#mes_btnReset')?.addEventListener('click', onReset);
  $('#mes_btnGuardarReq')?.addEventListener('click', onGuardarRequerimiento);
  $('#mes_btnAsignar')?.addEventListener('click', onAsignarMacro);
  $('#mes_btnBorrarAsig')?.addEventListener('click', onBorrarAsignacionesMes);

  // Primer render
  actualizarKPIs();
}
