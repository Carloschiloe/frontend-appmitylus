// /js/abastecimiento/shared/logger.js
const DEBUG = false; // cambia a true cuando quieras ver logs
export const log = (...a) => { if (DEBUG) { } };
export const warn = (...a) => { if (DEBUG) console.warn(...a); };
