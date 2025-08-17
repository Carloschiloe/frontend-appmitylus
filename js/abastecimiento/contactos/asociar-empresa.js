// /js/contactos/asociar-empresa.js
import { apiUpdateContacto } from '/js/core/api.js';
import { state, $, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';

// --- índice de empresas a partir de centros y contactos ---
function buildProvidersIndex() {
  const out = new Map();

  // desde centros (ya están cacheados por cargarCentros())
  (state.centros || []).forEach(c => {
    const name = (c.proveedorNombre || c.proveedor || '').trim();
    if (!name) return;
    const key = (c.proveedorKey || slug(name));
    if (!out.has(key)) out.set(key, { key, name });
  });

  // incluir empresas que ya existan en contactos (por si no hay centros)
  (state.contactosGuardados || []).forEach(ct => {
    const name = (ct.proveedorNombre || '').trim();
    const key = (ct.proveedorKey || (name ? slug(name) : ''));
    if (name && key && !out.has(key)) out.set(key, { key, name });
  });

  return Array.from(out.values());
}

let providersCache = [];

export function initAsociacionContactos() {
  providersCache = buildProvidersIndex();

  const input = $('#empresaSearch');
  const ul    = $('#searchResults');
  const btnCrear  = $('#btnCrearEmpresa');
  const btnQuitar = $('#btnQuitarEmpresa');

  const render = (items = []) => {
    if (!ul) return;
    if (!items.length) {
      ul.innerHTML = '<li class="collection-item grey-text">Sin resultados</li>';
      return;
    }
    ul.innerHTML = items
      .map(p => `<li class="collection-item">
        <a href="#!" class="sel-prov" data-key="${p.key}" data-name="${esc(p.name)}">${esc(p.name)}</a>
      </li>`)
      .join('');
  };

  const search = (q) => {
    const s = (q || '').trim().toLowerCase();
    if (s.length < 2) { ul && (ul.innerHTML = ''); return; }
    const items = providersCache.filter(p => p.name.toLowerCase().includes(s)).slice(0, 20);
    render(items);
  };

  input?.addEventListener('input', e => search(e.target.value));

  ul?.addEventListener('click', async (e) => {
    const a = e.target.closest('a.sel-prov');
    if (!a) return;
    await asociarAProveedor(a.dataset.key, a.dataset.name);
  });

  btnCrear?.addEventListener('click', async (e) => {
    e.preventDefault();
    const name = (input?.value || '').trim();
    if (name.length < 2) { M.toast?.({ html: 'Escribe un nombre (mín 2 letras)' }); return; }
    await asociarAProveedor(slug(name), name);
  });

  btnQuitar?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = state.asociarContactoId;
    if (!id) return;
    try {
      await apiUpdateContacto(id, {
        proveedorKey: null,
        proveedorNombre: null,
        centroId: null,
        centroCodigo: null,
        centroComuna: null,
        centroHectareas: null
      });
      await cargarContactosGuardados();
      document.dispatchEvent(new Event('reload-tabla-contactos'));
      M.toast?.({ html: 'Empresa quitada' });
      cerrarModal();
    } catch (err) {
      console.error(err);
      M.toast?.({ html: 'No se pudo quitar', classes: 'red' });
    }
  });

  // cada vez que se abra desde Personas, reconstruimos índice y limpiamos UI
  document.addEventListener('asociar-open', () => {
    providersCache = buildProvidersIndex();
    if (input) input.value = '';
    if (ul) ul.innerHTML = '';
  });
}

async function asociarAProveedor(proveedorKey, proveedorNombre) {
  const id = state.asociarContactoId;
  if (!id) { M.toast?.({ html: 'No hay contacto seleccionado', classes: 'red' }); return; }
  try {
    await apiUpdateContacto(id, {
      proveedorKey,
      proveedorNombre,
      // al asociar, dejamos centro en blanco hasta que elijan uno
      centroId: null,
      centroCodigo: null,
      centroComuna: null,
      centroHectareas: null
    });
    await cargarContactosGuardados();
    document.dispatchEvent(new Event('reload-tabla-contactos'));
    M.toast?.({ html: `Asociado a ${proveedorNombre}` });
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

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
