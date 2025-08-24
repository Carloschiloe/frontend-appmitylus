// /js/abastecimiento/contactos/data.js
import { apiGetCentros, apiGetContactos } from '../../core/api.js';
import { state } from './state.js';
import { coerceArray, normalizeContacto } from './normalizers.js';
import { slug } from './state.js';

/**
 * Carga catálogo de centros y arma índice de proveedores.
 * Además, popula el <select id="selectCentro"> con data-* (codigo, comuna, hectareas).
 */
export async function cargarCentros() {
  try {
    console.log('[cargarCentros] → apiGetCentros()');
    state.listaCentros = coerceArray(await apiGetCentros());
    console.log('[cargarCentros] ←', state.listaCentros.length, 'centros');

    // Índice de proveedores a partir de centros
    const mapa = new Map();
    state.proveedoresIndex = {};
    for (const c of state.listaCentros) {
      const nombre = (c.proveedor || c.name || '').trim();
      if (!nombre) continue;
      const key = c.proveedorKey?.length ? c.proveedorKey : slug(nombre);
      if (!mapa.has(key)) {
        mapa.set(key, {
          nombreOriginal: nombre,
          nombreNormalizado: nombre.toLowerCase().replace(/\s+/g, ' '),
          proveedorKey: key
        });
      }
      if (!state.proveedoresIndex[key]) state.proveedoresIndex[key] = { proveedor: nombre };
    }
    state.listaProveedores = Array.from(mapa.values());
    console.log('[cargarCentros] proveedores indexados:', state.listaProveedores.length);

    // Popular select de centros y wirear change
    poblarSelectCentros(state.listaCentros);

    // 🔔 Notificar a otros módulos (asociar-empresa.js escuchará esto)
    document.dispatchEvent(new Event('centros:loaded'));
  } catch (e) {
    console.error('[cargarCentros] error:', e);
    state.listaCentros = []; state.listaProveedores = []; state.proveedoresIndex = {};
    M.toast?.({ html: 'Error al cargar centros', displayLength: 2500 });
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
    console.error('[cargarContactosGuardados] error:', e);
    state.contactosGuardados = [];
  }
}

/* =========================================================================
   Helpers para Centro -> Hidden y lookup de comuna por código
   ========================================================================= */

function poblarSelectCentros(centros = []) {
  const sel = document.getElementById('selectCentro');
  if (!sel) return;

  sel.innerHTML = '<option value="" selected>Selecciona un centro (opcional)</option>';

  centros.forEach(ct => {
    const codigo = ct.codigo ?? ct.code ?? ct.Codigo ?? '';
    const nombre = ct.nombre ?? ct.name ?? ct.Nombre ?? '';
    const comuna = ct.comuna ?? ct.Comuna ?? '';
    const hects  = ct.hectareas ?? ct.Hectareas ?? '';

    const opt = document.createElement('option');
    opt.value = ct._id ?? ct.id ?? codigo;
    opt.textContent = `${codigo}${nombre ? ' — ' + nombre : ''}`;
    opt.dataset.codigo    = codigo;
    opt.dataset.comuna    = comuna;
    opt.dataset.hectareas = hects;

    sel.appendChild(opt);
  });

  sel.disabled = false;

  if (!state.__centroSelectWired) {
    sel.addEventListener('change', () => copyCentroToHidden(sel));
    state.__centroSelectWired = true;
  }
}

export function copyCentroToHidden(sel = document.getElementById('selectCentro')) {
  const opt = sel?.selectedOptions?.[0];
  setVal('centroId',        sel?.value || '');
  setVal('centroCodigo',    opt?.dataset.codigo || '');
  setVal('centroCode',      opt?.dataset.codigo || '');
  setVal('centroComuna',    opt?.dataset.comuna || '');
  setVal('centroHectareas', opt?.dataset.hectareas || '');
}

export function lookupComunaByCodigo(codigo) {
  if (!codigo) return '';
  const cod = String(codigo);
  const lista = Array.isArray(state.listaCentros) ? state.listaCentros : [];
  const match = lista.find(ct => {
    const cands = [ct.codigo, ct.code, ct.Codigo].filter(v => v != null).map(String);
    return cands.includes(cod);
  });
  return match?.comuna ?? match?.Comuna ?? '';
}

/* --------------------------------- utils -------------------------------- */
function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}



