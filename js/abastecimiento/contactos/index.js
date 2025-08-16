// /js/contactos/index.js
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  import('./debug-fetch.js').catch(() => {});
}

import { cargarCentros, cargarContactosGuardados } from './data.js';
import { setupBuscadorProveedores } from './proveedores.js';
import { setupFormulario } from './form-contacto.js';
import { setupFormularioVisita } from './visitas.js';
import { initTablaContactos, renderTablaContactos } from './tabla.js';

import { initAsociacionContactos } from './asociar-empresa.js';

// Personas (separado)
import { initPersonasTab, renderTablaPersonas } from './personas.js';
import { initFiltrosYKPIsPersonas } from './filtros-kpis-personas.js';

let booted = false, listenersHooked = false;

export async function initContactosTab(forceReload = false) {
  if (booted && !forceReload) return;
  try {
    await cargarCentros();
    await cargarContactosGuardados();

    setupBuscadorProveedores();
    setupFormulario();
    setupFormularioVisita();

    // CONTACTOS (sin KPIs/chips de empresa)
    initTablaContactos();
    renderTablaContactos();

    // PERSONAS (con KPIs/chips)
    if (document.getElementById('tab-personas')) {
      initFiltrosYKPIsPersonas();
      initPersonasTab();
    }

    initAsociacionContactos();
    hookGlobalListeners();
    booted = true;
  } catch (err) {
    console.error('[contactos] init error', err);
    M.toast?.({ html: 'No se pudo inicializar', classes: 'red' });
  }
}

function hookGlobalListeners() {
  if (listenersHooked) return;
  document.addEventListener('filtro-personas-changed', () => renderTablaPersonas?.());
  document.addEventListener('reload-tabla-contactos', async () => {
    try {
      await cargarContactosGuardados();
      renderTablaContactos();
      renderTablaPersonas?.();
    } catch (e) {
      console.error(e);
      M.toast?.({ html: 'No se pudo refrescar', classes: 'red' });
    }
  });
  listenersHooked = true;
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.M && M.AutoInit) M.AutoInit();
  initContactosTab().catch(console.error);
});
