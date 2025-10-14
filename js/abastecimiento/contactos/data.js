// /js/abastecimiento/contactos/data.js
import { apiGetCentros, apiGetContactos } from '../../core/api.js';
import { state } from './state.js';
import { coerceArray, normalizeContacto } from './normalizers.js';
import { slug } from './state.js';

/**
 * Carga catálogo de centros y arma índice de proveedores.
 * Además, avisa a otros módulos con 'centros:loaded'.
 */
export async function cargarCentros() {
  try {
    console.log('[cargarCentros] → apiGetCentros()');
    const res = await apiGetCentros();
    const lista = coerceArray(res);
    state.listaCentros = Array.isArray(lista) ? lista : [];
    console.log('[cargarCentros] ←', state.listaCentros.length, 'centros');

    // Índice de proveedores a partir de centros
    const mapa = new Map();
    state.proveedoresIndex = {};

    for (const c of state.listaCentros) {
      const nombre = String(c.proveedor || c.name || '').trim();
      if (!nombre) continue;

      const pKey = (c.proveedorKey && String(c.proveedorKey).trim().length)
        ? String(c.proveedorKey).trim()
        : slug(nombre);

      if (!mapa.has(pKey)) {
        mapa.set(pKey, {
          nombreOriginal: nombre,
          nombreNormalizado: nombre.toLowerCase().replace(/\s+/g, ' '),
          proveedorKey: pKey
        });
      }
      if (!state.proveedoresIndex[pKey]) {
        state.proveedoresIndex[pKey] = { proveedor: nombre, proveedorKey: pKey };
      }
    }

    state.listaProveedores = Array.from(mapa.values());
    console.log('[cargarCentros] proveedores indexados:', state.listaProveedores.length);

    // 🔔 Notificar a otros módulos (asociar-empresa.js, visitas/ui.js, etc.)
    document.dispatchEvent(new Event('centros:loaded'));
  } catch (e) {
    console.error('[cargarCentros] error:', e?.message || e);
    state.listaCentros = [];
    state.listaProveedores = [];
    state.proveedoresIndex = {};
    M.toast?.({ html: 'Error al cargar centros', displayLength: 2500, classes: 'red' });
  }
}

/**
 * Trae contactos guardados y normaliza.
 */
export async function cargarContactosGuardados() {
  try {
    console.log('[cargarContactosGuardados] → apiGetContactos()');
    const raw = coerceArray(await apiGetContactos());
    state.contactosGuardados = raw.map(normalizeContacto);
    console.log('[cargarContactosGuardados] ←', state.contactosGuardados.length, 'contactos');
  } catch (e) {
    console.error('[cargarContactosGuardados] error:', e?.message || e);
    state.contactosGuardados = [];
    M.toast?.({ html: 'Error al cargar contactos', displayLength: 2500, classes: 'red' });
  }
}

/* =========================================================================
   Helpers para Centro -> (los hidden se llenan en otros módulos)
   ========================================================================= */
