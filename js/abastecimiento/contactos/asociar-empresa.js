// /js/contactos/asociar-empresa.js
import { apiUpdateContacto, apiPatchContactoSafe } from '/js/core/api.js';
import { state, $, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';

/* ---------------- helpers ---------------- */
const esc = (s = '') =>
  String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
           .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
           .replace(/'/g,'&#039;');

const norm = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

// Merge-safe: toma el contacto actual del estado y devuelve
// un objeto con TODOS los campos importantes, para sobrevivir a un PUT.
function getContactoBaseForPut(id) {
  const c = (state.contactosGuardados || []).find(x => String(x._id) === String(id)) || {};
  return {
    // Identidad/relación
    proveedorKey:        c.proveedorKey || '',
    proveedorNombre:     c.proveedorNombre || '',
    centroId:            c.centroId ?? null,
    centroCodigo:        c.centroCodigo ?? null,
    centroComuna:        c.centroComuna ?? null,
    centroHectareas:     c.centroHectareas ?? null,
    // Datos de agenda
    contactoNombre:      c.contactoNombre || '',
    contactoTelefono:    c.contactoTelefono || '',
    contactoEmail:       c.contactoEmail || '',
    notas:               c.notas ?? '',
    // Campos de negocio
    resultado:           c.resultado || '',
    tieneMMPP:           c.tieneMMPP || '',
    fechaDisponibilidad: c.fechaDisponibilidad || null,
    dispuestoVender:     c.dispuestoVender || '',
    vendeActualmenteA:   c.vendeActualmenteA || '',
    tonsDisponiblesAprox:c.tonsDisponiblesAprox ?? null,
  };
}

/* Construye índice de empresas desde centros + contactos */
function buildProvidersIndex() {
  const out = new Map();

  // ✅ desde CENTROS (catálogo completo)
  (state.listaCentros || []).forEach((c) => {
    const name = (c.proveedor || c.name || '').trim();
    if (!name) return;
    const key  = (c.proveedorKey && c.proveedorKey.length) ? c.proveedorKey : slug(name);
    if (!out.has(key)) out.set(key, { key, name });
  });

  // ✅ desde CONTACTOS (complementa)
  (state.contactosGuardados || []).forEach((ct) => {
    const name = (ct.proveedorNombre || '').trim();
    if (!name) return;
    const key = (ct.proveedorKey && ct.proveedorKey.length) ? ct.proveedorKey : slug(name);
    if (!out.has(key)) out.set(key, { key, name });
  });

  return Array.from(out.values())
    .sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'base'}));
}

let providersCache = [];
let debounceT = null;

export function initAsociacionContactos() {
  // cache inicial
  providersCache = buildProvidersIndex();

  const input = $('#empresaSearch');
  const ul    = $('#searchResults');
  const btnCrear  = $('#btnCrearEmpresa');
  const btnQuitar = $('#btnQuitarEmpresa');

  /* --- renderer --- */
  const render = (items = []) => {
    if (!ul) return;
    if (!items.length) {
      ul.innerHTML = '<li class="collection-item grey-text">Sin resultados</li>';
      return;
    }
    ul.innerHTML = items.map(p => `
      <li class="collection-item">
        <a href="#!" class="sel-prov" data-key="${p.key}" data-name="${esc(p.name)}">${esc(p.name)}</a>
      </li>
    `).join('');
  };

  /* --- search (debounced, accent-insensitive) --- */
  const searchNow = (q) => {
    const s = norm(q || '');
    if (s.length < 2) { if (ul) ul.innerHTML = ''; return; }
    const items = providersCache.filter(p => norm(p.name).includes(s)).slice(0, 20);
    render(items);
  };
  const search = (q) => { clearTimeout(debounceT); debounceT = setTimeout(()=>searchNow(q), 120); };

  input?.addEventListener('input', (e) => search(e.target.value));

  // Enter => primer resultado
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = ul?.querySelector('a.sel-prov');
      if (first) first.click();
    }
  });

  // click en resultado
  ul?.addEventListener('click', async (e) => {
    const a = e.target.closest('a.sel-prov');
    if (!a) return;
    await asociarAProveedor(a.dataset.key, a.dataset.name);
  });

  // crear empresa nueva con el texto actual
  btnCrear?.addEventListener('click', async (e) => {
    e.preventDefault();
    const name = (input?.value || '').trim();
    if (name.length < 2) { M.toast?.({ html: 'Escribe un nombre (mín 2 letras)' }); return; }
    await asociarAProveedor(slug(name), name);
  });

  // quitar empresa (y limpiar centro)
  btnQuitar?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = state.asociarContactoId;
    if (!id) return;
    try {
      const patch = {
        proveedorKey: null, proveedorNombre: null,
        centroId: null, centroCodigo: null, centroComuna: null, centroHectareas: null,
      };

      // 1) intenta PATCH sin fallback
      try {
        await apiPatchContactoSafe(id, patch);
      } catch (e1) {
        // 2) fallback seguro: merge completo (por si el server hace PUT)
        const base = getContactoBaseForPut(id);
        await apiUpdateContacto(id, { ...base, ...patch });
      }

      await cargarContactosGuardados();
      document.dispatchEvent(new Event('reload-tabla-contactos'));
      M.toast?.({ html: 'Empresa quitada' });
      cerrarModal();
    } catch (err) {
      console.error(err);
      M.toast?.({ html: 'No se pudo quitar', classes: 'red' });
    }
  });

  // Cuando abran el modal desde Personas
  document.addEventListener('asociar-open', () => {
    providersCache = buildProvidersIndex();       // refresca índice
    if (input) input.value = '';                  // limpia input
    if (ul) ul.innerHTML = '';                    // limpia lista
    input?.focus();
  });

  // Si se recargan contactos, reconstruye índice
  document.addEventListener('reload-tabla-contactos', () => {
    providersCache = buildProvidersIndex();
  });

  // Cuando se cargan/actualizan CENTROS, refresca el índice también
  document.addEventListener('centros:loaded', () => {
    providersCache = buildProvidersIndex();
  });
}

/* ---------------- acciones ---------------- */
async function asociarAProveedor(proveedorKey, proveedorNombre) {
  const id = state.asociarContactoId;
  if (!id) { M.toast?.({ html: 'No hay contacto seleccionado', classes: 'red' }); return; }

  const key  = (proveedorKey || slug(proveedorNombre || '')).trim();
  const name = (proveedorNombre || '').trim();

  const patch = {
    proveedorKey: key,
    proveedorNombre: name,
    // limpia centro hasta que lo seleccionen explícitamente
    centroId: null, centroCodigo: null, centroComuna: null, centroHectareas: null,
  };

  try {
    // 1) Intentar PATCH puro (no borra campos si falla PUT)
    try {
      await apiPatchContactoSafe(id, patch);
    } catch (e1) {
      // 2) Fallback: merge completo para sobrevivir a un PUT
      const base = getContactoBaseForPut(id);
      await apiUpdateContacto(id, { ...base, ...patch });
    }

    await cargarContactosGuardados();
    document.dispatchEvent(new Event('reload-tabla-contactos'));
    M.toast?.({ html: `Asociado a ${esc(name)}` });
    cerrarModal();
  } catch (err) {
    console.error(err);
    M.toast?.({ html: 'No se pudo asociar', classes: 'red' });
  }
}

function cerrarModal() {
  const modal = document.getElementById('modalAsociar');
  if (modal && window.M && M.Modal) {
    (M.Modal.getInstance(modal) || M.Modal.init(modal, {})).close();
  }
}
