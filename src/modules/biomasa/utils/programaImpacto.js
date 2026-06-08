// Helpers puros para el flujo de ajuste diario y el modal de impacto post-ajuste.
// No dependen de React. La lógica de negocio (cálculo de vigencia, validación de
// descuentos) vive en el backend; aquí solo se INTERPRETA el resultado para mostrarlo.

// Tipos de transporte que se pueden DESCONTAR de un día (existen con cantidad > 0).
export function tiposDescontables(composicionDia = []) {
  return (Array.isArray(composicionDia) ? composicionDia : []).filter((l) => Number(l?.cantidad) > 0);
}

// ¿La fecha (YYYY-MM-DD) está dentro de la vigencia activa del programa?
// Día dentro de [vigenciaDesde, vigenciaHasta] = día con programa activo (incluye días
// suspendidos dentro de la vigencia). Fuera del rango = "Sin programa". El backend hace
// la validación dura; esto es solo para la UI (mostrar estado / ocultar acciones).
export function esFechaEnVigencia(programa, fechaKey) {
  if (!programa || !fechaKey) return false;
  const desde = toDateKey(programa.vigenciaDesde);
  const hasta = toDateKey(programa.vigenciaHasta);
  if (!desde || !hasta) return false;
  const f = String(fechaKey).slice(0, 10);
  return f >= desde && f <= hasta;
}

// YYYY-MM-DD en UTC desde un Date/ISO. Devuelve '' si no es válido.
export function toDateKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// DD-MM-YYYY para mostrar; '' si no hay fecha.
export function fmtDateKey(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  return d && m && y ? `${d}-${m}-${y}` : key;
}

// Diferencia en días entre dos dateKeys (b - a). null si falta alguna.
export function diffDaysKeys(aKey, bKey) {
  if (!aKey || !bKey) return null;
  const a = new Date(`${aKey}T00:00:00Z`);
  const b = new Date(`${bKey}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

// Camiones totales de un día en un programa: día especial si existe, si no el base.
function totalCamionesDia(programa, fechaKey) {
  if (!programa || !fechaKey) return null;
  const especial = (programa.diasEspeciales || []).find((d) => toDateKey(d.fecha) === fechaKey);
  if (especial) return Number(especial.camiones || 0);
  const dow = new Date(`${fechaKey}T12:00:00Z`).getUTCDay();
  const dias = Array.isArray(programa.diasSemana) && programa.diasSemana.length ? programa.diasSemana.map(Number) : [0, 1, 2, 3, 4];
  return dias.includes(dow) ? Number(programa.camionesDefault || 0) : 0;
}

const ACCION_VERBO = {
  sumar: 'Se agregó',
  suspender: 'Se descontó',       // 'suspender' = descontar un camión de un tipo
  suspender_dia: 'Se suspendió',
};

// Construye el resumen de impacto de un ajuste comparando el programa antes/después.
// before/after: documentos de programa (after viene de la respuesta del endpoint).
// payload: lo enviado al backend (accion, fecha, tipoTransporteNombre, camiones, motivo).
export function buildImpactoAjuste(before, after, payload = {}) {
  const fechaKey = toDateKey(payload.fecha) || payload.fecha || '';
  const accion = payload.accion || '';
  const tipoNombre = payload.tipoTransporteNombre || '';
  const cantidad = Number(payload.camiones || 0);

  const vigAnteriorKey = toDateKey(before?.vigenciaHasta);
  const vigNuevaKey = toDateKey(after?.vigenciaHasta);
  const diferenciaDias = diffDaysKeys(vigAnteriorKey, vigNuevaKey);

  let direccionCambio = 'sin_cambio';
  if (diferenciaDias != null && diferenciaDias > 0) direccionCambio = 'extendio';
  else if (diferenciaDias != null && diferenciaDias < 0) direccionCambio = 'adelanto';

  // Mensaje de acción.
  const verbo = ACCION_VERBO[accion] || 'Se ajustó';
  const fechaTexto = new Date(`${fechaKey}T12:00:00Z`).toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
  let mensaje;
  if (accion === 'suspender_dia') {
    mensaje = `${verbo} el ${fechaTexto}${payload.motivo ? ` por ${payload.motivo}` : ''}.`;
  } else {
    const tipoTxt = tipoNombre || 'camión';
    mensaje = `${verbo} ${cantidad} ${tipoTxt} el ${fechaTexto}.`;
  }

  return {
    accion,
    fechaKey,
    mensaje,
    vigenciaHastaAnterior: vigAnteriorKey,
    vigenciaHastaNueva: vigNuevaKey,
    diferenciaDias,
    direccionCambio,
    totalDiaAntes: totalCamionesDia(before, fechaKey),
    totalDiaDespues: totalCamionesDia(after, fechaKey),
  };
}

// Frase legible del cambio de término.
export function fraseCambioTermino(impacto) {
  if (!impacto) return '';
  const n = impacto.diferenciaDias;
  if (n == null || n === 0) return 'La fecha de término no cambió.';
  const dias = Math.abs(n);
  const plural = dias === 1 ? 'día' : 'días';
  return n > 0 ? `El programa se extendió ${dias} ${plural}.` : `El programa se adelantó ${dias} ${plural}.`;
}
