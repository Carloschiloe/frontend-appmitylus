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

// 🔹 NUEVO: trae los inicializadores de los módulos agregados
import { initFiltrosYKPIs } from './filtros-kpis.js';
import { initAsociacionContactos } from './asociar-empresa.js';

let booted = false;
let listenersHooked = false;

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

    // 🔹 Inicializa Filtros/KPIs (chips + KPIs superiores)
    initFiltrosYKPIs();

    // Tabla + primer render (init solo 1 vez; render puedes repetir)
    initTablaContactos();   // tiene su propio guard
    renderTablaContactos();

    // 🔹 Inicializa el modal de asociar/cambiar/quitar empresa
    initAsociacionContactos();

    // Listeners globales (solo 1 vez)
    hookGlobalListeners();

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

/** Listeners que coordinan filtros/reloads con otros módulos. */
function hookGlobalListeners() {
  if (listenersHooked) return;

  // Chips de filtro (filtros-kpis.js emite este evento)
  document.addEventListener('filtro-contactos-changed', () => {
    renderTablaContactos();
  });

  // Cuando el modal de asociar empresa guarda/cambia algo
  // (asociar-empresa.js emite 'reload-tabla-contactos')
  document.addEventListener('reload-tabla-contactos', async () => {
    try {
      await cargarContactosGuardados(); // refresca desde el backend
      renderTablaContactos();
    } catch (e) {
      console.error(e);
      M.toast?.({ html: 'No se pudo refrescar contactos', classes: 'red' });
    }
  });

  listenersHooked = true;
}

// Auto-init cuando el documento carga
document.addEventListener('DOMContentLoaded', () => {
  // Con un solo <script type="module" src="/js/abastecimiento/contactos/index.js">
  // este init deja todo listo.
  initContactosTab().catch(console.error);
});

// (Opcional dev) reset manual
export function __resetContactosTabForDev() { 
  booted = false; 
  listenersHooked = false;
}
