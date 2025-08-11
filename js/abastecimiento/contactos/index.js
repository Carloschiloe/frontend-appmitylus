// /js/abastecimiento/contactos/index.js

// Efecto de debug (loggea fetch a /api/contactos)
import './debug-fetch.js';

// Orquestador: sólo importa y llama a los inicializadores
import { cargarCentros, cargarContactosGuardados } from './data.js';
import { setupBuscadorProveedores } from './proveedores.js';
import { setupFormulario } from './form-contacto.js';
import { setupFormularioVisita } from './visitas.js';
import { initTablaContactos, renderTablaContactos } from './tabla.js';

// === GUARD para evitar doble init ===
let booted = false;

/**
 * Inicializa la pestaña de Contactos una sola vez.
 */
export async function initContactosTab() {
  if (booted) return;     // <- evita re-inicialización
  booted = true;

  await cargarCentros();
  await cargarContactosGuardados();

  setupBuscadorProveedores();
  setupFormulario();
  setupFormularioVisita();

  initTablaContactos();
  renderTablaContactos();
}

/**
 * (Opcional, dev) permite “rebootear” la pestaña manualmente si lo necesitas.
 * Llama luego a initContactosTab() otra vez.
 */
export function __resetContactosTabForDev() {
  booted = false;
}
