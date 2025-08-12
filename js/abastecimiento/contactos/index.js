// /js/abastecimiento/contactos/index.js

// Solo carga debug en desarrollo
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  import('./debug-fetch.js').catch(() => {});
}

// Orquestador de Contactos
import { cargarCentros, cargarContactosGuardados } from './data.js';
import { setupBuscadorProveedores } from './proveedores.js';
import { setupFormulario } from './form-contacto.js';
import { setupFormularioVisita } from './visitas.js';
import { initTablaContactos, renderTablaContactos } from './tabla.js';

let booted = false;

/** Inicializa la pestaña Contactos (idempotente). */
export async function initContactosTab(forceReload = false) {
  if (booted && !forceReload) return;

  try {
    // Datos base
    await cargarCentros();
    await cargarContactosGuardados();

    // Wiring (idempotente si tus módulos lo manejan internamente)
    setupBuscadorProveedores();
    setupFormulario();
    setupFormularioVisita();

    // Tabla + primer render (init solo 1 vez; render puedes repetir)
    initTablaContactos();        // internamente debería tener su propio guard
    renderTablaContactos();      // render es seguro repetir

    booted = true;
  } catch (err) {
    console.error('[contactos] init error', err);
    M.toast?.({ html: 'No se pudo inicializar Contactos', classes: 'red' });
  }
}

/** Re-render liviano cuando cambian datos (sin reinstalar nada). */
export function refreshContactos() {
  try { renderTablaContactos(); } catch (e) { console.error(e); }
}

// (Opcional dev) reset manual
export function __resetContactosTabForDev() { booted = false; }

