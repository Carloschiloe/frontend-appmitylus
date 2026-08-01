/**
 * centroHelpers.js
 * Utilidades compartidas para mostrar información de centros de cultivo.
 * Importar desde cualquier módulo del frontend que necesite formatear centros.
 */

/**
 * Devuelve el label visible del código de centro, añadiendo la certificación
 * entre paréntesis si el centro la tiene registrada.
 *
 * Ejemplos:
 *   centroLabel({ code: '104348', certificacion: 'ASC' })  →  "104348 (ASC)"
 *   centroLabel({ code: '104348', certificacion: ''  })    →  "104348"
 *   centroLabel({ code: '104348' })                        →  "104348"
 *
 * @param {object} centro  Objeto centro (o cualquier shape con .code / .certificacion).
 * @param {object} [opts]
 * @param {boolean} [opts.withComuna=false]  Añade la comuna al label: "104348 (ASC) · Castro"
 * @returns {string}
 */
export function centroLabel(centro = {}, { withComuna = false } = {}) {
  const code = centro.code || centro.centroCodigo || centro.codigo || '';
  const cert = (centro.certificacion || '').trim().toUpperCase();
  let label = cert ? `${code} (${cert})` : code;
  if (withComuna && centro.comuna) label = `${label} · ${centro.comuna}`;
  return label || 'Centro sin referencia';
}

/**
 * Misma lógica pero recibiendo los campos por separado (útil cuando el objeto
 * disponible tiene sólo code + certificacion como campos sueltos).
 *
 * @param {string} code
 * @param {string} [certificacion]
 * @returns {string}
 */
export function centroCodeLabel(code = '', certificacion = '') {
  const cert = (certificacion || '').trim().toUpperCase();
  if (!code) return 'Sin centro';
  return cert ? `${code} (${cert})` : code;
}

/**
 * Devuelve true si el centro tiene alguna certificación registrada.
 * @param {object} centro
 * @returns {boolean}
 */
export function hasCertificacion(centro = {}) {
  return Boolean((centro.certificacion || '').trim());
}
