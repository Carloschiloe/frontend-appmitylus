import { apiGetCentros, apiGetContactos } from '/js/core/api.js';
import { state } from './state.js';
import { coerceArray, normalizeContacto } from './normalizers.js';
import { slug } from './state.js';

export async function cargarCentros() {
  try {
    console.log('[cargarCentros] → apiGetCentros()');
    state.listaCentros = coerceArray(await apiGetCentros());
    console.log('[cargarCentros] ←', state.listaCentros.length, 'centros');

    const mapa = new Map();
    state.proveedoresIndex = {};
    for (const c of state.listaCentros) {
      const nombreOriginal = (c.proveedor || '').trim();
      if (!nombreOriginal) continue;
      const key = c.proveedorKey?.length ? c.proveedorKey : slug(nombreOriginal);
      if (!mapa.has(key)) {
        mapa.set(key, {
          nombreOriginal,
          nombreNormalizado: nombreOriginal.toLowerCase().replace(/\s+/g, ' '),
          proveedorKey: key
        });
      }
      if (!state.proveedoresIndex[key]) state.proveedoresIndex[key] = { proveedor: nombreOriginal };
    }
    state.listaProveedores = Array.from(mapa.values());
    console.log('[cargarCentros] proveedores indexados:', state.listaProveedores.length);
  } catch (e) {
    console.error('[cargarCentros] error:', e);
    state.listaCentros = []; state.listaProveedores = []; state.proveedoresIndex = {};
    M.toast?.({ html: 'Error al cargar centros', displayLength: 2500 });
  }
}

export async function cargarContactosGuardados() {
  try {
    console.log('[cargarContactosGuardados] → apiGetContactos()');
    const raw = coerceArray(await apiGetContactos());
    state.contactosGuardados = raw.map(normalizeContacto);
    console.log('[cargarContactosGuardados] ←', state.contactosGuardados.length, 'contactos');
  } catch (e) {
    console.error('[cargarContactosGuardados] error:', e);
    state.contactosGuardados = [];
  }
}
