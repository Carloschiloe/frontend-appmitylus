// /js/contactos/data.js
import { apiGetCentros, apiGetContactos } from '/js/core/api.js';
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

    // Index de proveedores (como lo tenías)
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

    // 👇 NUEVO: popular el select de centros y enganchar change
    poblarSelectCentros(state.listaCentros);
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
   Helpers NUEVOS para Centro -> Hidden y lookup de comuna por código
   ========================================================================= */

/**
 * Llena el <select id="selectCentro"> con opciones que llevan data-*:
 *  data-codigo, data-comuna, data-hectareas
 */
function poblarSelectCentros(centros = []) {
  const sel = document.getElementById('selectCentro');
  if (!sel) return;

  sel.innerHTML = '<option value="" selected>Selecciona un centro (opcional)</option>';

  centros.forEach(ct => {
    const codigo = ct.codigo ?? ct.code ?? ct.Codigo ?? '';
    const nombre = ct.nombre ?? ct.Nombre ?? '';
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

  // Para no enganchar el listener más de una vez
  if (!state.__centroSelectWired) {
    sel.addEventListener('change', () => copyCentroToHidden(sel));
    state.__centroSelectWired = true;
  }
}

/**
 * Copia los data-* de la opción seleccionada a los inputs hidden del formulario:
 *  #centroId, #centroCodigo/#centroCode, #centroComuna, #centroHectareas
 */
export function copyCentroToHidden(sel = document.getElementById('selectCentro')) {
  const opt = sel?.selectedOptions?.[0];
  setVal('centroId',        sel?.value || '');
  setVal('centroCodigo',    opt?.dataset.codigo || '');
  setVal('centroCode',      opt?.dataset.codigo || '');
  setVal('centroComuna',    opt?.dataset.comuna || '');
  setVal('centroHectareas', opt?.dataset.hectareas || '');
}

/**
 * Fallback robusto: dado un código de centro (string/number),
 * busca en state.listaCentros y retorna su comuna (si existe).
 */
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

