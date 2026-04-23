// /js/contactos/asociar-empresa.js
import { apiPatchContactoSafe } from '../../core/api.js';
import { state, $, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';
import { escapeHtml, fetchJson, getModalInstance } from './ui-common.js';
import { buscarCoincidenciasProveedor } from './proveedores.js';
import { toast } from '../../ui/toast.js';

/* ---------------- helpers ---------------- */
const API_BASE = (window.API_URL || '/api'); // base para POST asignaciones
const apiJson = (path, options = {}) => {
  const opts = { credentials: 'same-origin', ...options, headers: { ...(options.headers || {}) } };
  if (opts.body !== undefined && opts.body !== null && typeof opts.body !== 'string') {
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  return fetchJson(`${API_BASE}${path}`, opts);
};

const esc = escapeHtml;

const norm = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const pad2 = (n) => String(n).padStart(2, '0');
const mesKeyFrom = (anio, mes) => `${anio}-${pad2(mes)}`;

/* Construye indice de empresas desde centros + contactos */
function buildProvidersIndex() {
  const out = new Map();

  // desde centros (cacheados por cargarCentros())
  (state.listaCentros || []).forEach((c) => {
    const name = (c.proveedor || c.name || '').trim();
    if (!name) return;
    const key = (c.proveedorKey && c.proveedorKey.length) ? c.proveedorKey : slug(name);
    if (!out.has(key)) out.set(key, { key, name });
  });

  // desde contactos (complemento)
  (state.contactosGuardados || []).forEach((ct) => {
    const name = (ct.proveedorNombre || '').trim();
    if (!name) return;
    const key = (ct.proveedorKey && ct.proveedorKey.length) ? ct.proveedorKey : slug(name);
    if (!out.has(key)) out.set(key, { key, name });
  });

  return Array.from(out.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  );
}

let providersCache = [];
let debounceT = null;

/* ======================== ASIGNACIONES (MMPP) ======================== */
async function postAsignacion(payload){
  return apiJson('/asignaciones', { method: 'POST', body: payload });
}

function getEl(id){ return document.getElementById(id); }

/** Guarda asignacion si el checkbox esta marcado */
async function saveAsignacionIfChecked({ proveedorKey, contactoId }){
  const chk = getEl('asigAgregarDisponibilidad');
  if (!chk || !chk.checked) return; // no pidio guardar

  const anio = parseInt(getEl('asigAnio')?.value, 10);
  const mes  = parseInt(getEl('asigMes')?.value, 10);
  const tons = parseFloat(getEl('asigTons')?.value);

  // Centro desde hidden (estandarizado) o desde el select si existe
  const centroIdHidden = getEl('centroId')?.value || '';
  const selCentro = getEl('selectCentro');
  const centroIdSel = selCentro ? selCentro.value : '';
  const centroId = centroIdHidden || centroIdSel || '';

  if (!proveedorKey) { toast('Falta proveedor', { variant: 'error' }); return; }
  if (!contactoId)   { toast('Falta contacto', { variant: 'error' }); return; }
  if (!centroId)     { toast('Selecciona un centro', { variant: 'error' }); return; }
  if (!anio || !mes || Number.isNaN(tons)) {
    toast('Completa año, mes y cantidad (ton)', { variant: 'error' });
    return;
  }

  const payload = {
    contactoId,
    proveedorKey,
    centroId,
    anio,
    mes,
    mesKey: mesKeyFrom(anio, mes),
    tons,                // cantidad de MMPP en toneladas
    estado: 'disponible',
    fuente: 'contactos',
    createdFrom: 'modal_asociar_empresa'
  };

  await postAsignacion(payload);
  toast('Disponibilidad registrada en asignaciones', { variant: 'success' });
}

/* ====================== INIT / UI del modal Empresas ====================== */
export function initAsociacionContactos() {
  providersCache = buildProvidersIndex();

  const input    = $('#empresaSearch');
  const ul       = $('#searchResults'); // div.am-dropdown
  const btnCrear = $('#btnCrearEmpresa');
  const btnQuitar= $('#btnQuitarEmpresa');

  // Inicializa el select de mes y toggle de bloque si existen en el modal
  const mesSel = getEl('asigMes');

  const chk = getEl('asigAgregarDisponibilidad');
  const block = getEl('asigDisponibilidadBlock');
  const toggle = () => { if (block) block.style.display = (chk && chk.checked) ? '' : 'none'; };
  if (chk) { chk.addEventListener('change', toggle); toggle(); }

  /* --- renderer --- */
  const render = (items = []) => {
    if (!ul) return;
    if (!items.length) {
      ul.innerHTML = '<div class="am-dropdown-empty">Sin resultados</div>';
      ul.classList.add('is-open');
      return;
    }
    ul.innerHTML = items.map(
      (p) => `<div class="am-dropdown-item sel-prov" data-key="${p.key}" data-name="${esc(p.name)}">
        <strong>${esc(p.name)}</strong>
        ${p.hint ? `<span>${esc(p.hint)}</span>` : ''}
      </div>`).join('');
    ul.classList.add('is-open');
  };

  /* --- search (debounced, accent-insensitive) --- */
  const searchNow = (q) => {
    const s = norm(q || '');
    const isCenterCodeQuery = /^\d{4,8}$/.test(String(q || '').trim());
    if (s.length < 2 && !isCenterCodeQuery) {
      if (ul) { ul.innerHTML = ''; ul.classList.remove('is-open'); }
      return;
    }

    const fast = buscarCoincidenciasProveedor(q, { limit: 30 });
    const dedup = new Map();
    fast.forEach((hit) => {
      const key = String(hit?.key || '').trim();
      const name = String(hit?.name || '').trim();
      if (!key || !name || dedup.has(key)) return;
      const hint = hit.type === 'center'
        ? `Centro ${hit.centerCode || '-'}${hit.centerComuna ? ` - ${hit.centerComuna}` : ''}`
        : hit.sublabel || '';
      dedup.set(key, { key, name, hint });
    });

    if (!dedup.size) {
      const fallback = providersCache
        .filter((p) => norm(p.name).includes(s))
        .slice(0, 20);
      render(fallback);
      return;
    }

    render(Array.from(dedup.values()).slice(0, 20));
  };
  const search = (q) => {
    clearTimeout(debounceT);
    debounceT = setTimeout(() => searchNow(q), 120);
  };

  input?.addEventListener('input', (e) => search(e.target.value));

  // Cierra dropdown al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!input?.contains(e.target) && !ul?.contains(e.target)) {
      ul?.classList.remove('is-open');
    }
  }, true);

  // Enter => primer resultado
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = ul?.querySelector('.sel-prov');
      if (first) first.click();
    }
  });

  // click en resultado -> asocia y (si corresponde) guarda disponibilidad
  ul?.addEventListener('click', async (e) => {
    const a = e.target.closest('.sel-prov');
    if (!a) return;
    await asociarAProveedor(a.dataset.key, a.dataset.name);
  });

  // crear empresa nueva con el texto actual -> idem
  btnCrear?.addEventListener('click', async (e) => {
    e.preventDefault();
    const name = (input?.value || '').trim();
    if (name.length < 2) {
      toast('Escribe un nombre (min 2 letras)');
      return;
    }
    await asociarAProveedor(slug(name), name);
  });

  // quitar empresa (y limpiar centro) - usar PATCH seguro
  btnQuitar?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = state.asociarContactoId;
    if (!id) return;
    try {
      await apiPatchContactoSafe(id, {
        proveedorKey: null,
        proveedorNombre: null,
        centroId: null,
        centroCodigo: null,
        centroComuna: null,
        centroHectareas: null,
      });
      await cargarContactosGuardados();
      document.dispatchEvent(new Event('reload-tabla-contactos'));
      toast('Empresa quitada', { variant: 'success' });
      cerrarModal();
    } catch (err) {
      console.error(err);
      toast('No se pudo quitar', { variant: 'error' });
    }
  });

  // Cuando abran el modal desde Personas
  document.addEventListener('asociar-open', () => {
    providersCache = buildProvidersIndex();       // refresca indice
    if (input) input.value = '';                  // limpia input
    if (ul) { ul.innerHTML = ''; ul.classList.remove('is-open'); }  // limpia lista
    // defaults de disponibilidad
    const now = new Date();
    if (getEl('asigAnio') && !getEl('asigAnio').value) getEl('asigAnio').value = now.getFullYear();
    if (mesSel && !mesSel.value) { mesSel.value = String(now.getMonth() + 1); }
    input?.focus();
  });

  // Si se recargan contactos o centros, reconstruye indice
  document.addEventListener('reload-tabla-contactos', () => { providersCache = buildProvidersIndex(); });
  document.addEventListener('centros:loaded', () => { providersCache = buildProvidersIndex(); });
}

/* ---------------- acciones ---------------- */
async function asociarAProveedor(proveedorKey, proveedorNombre) {
  const id = state.asociarContactoId;
  if (!id) {
    toast('No hay contacto seleccionado', { variant: 'error' });
    return;
  }
  const key  = (proveedorKey || slug(proveedorNombre || '')).trim();
  const name = (proveedorNombre || '').trim();

  try {
    // 1) Asocia proveedor (PATCH seguro)
    await apiPatchContactoSafe(id, {
      proveedorKey: key,
      proveedorNombre: name,
      // limpia centro hasta que lo seleccionen explicitamente
      centroId: null,
      centroCodigo: null,
      centroComuna: null,
      centroHectareas: null,
    });

    // 2) (Opcional) Guarda disponibilidad en 'asignaciones' si el usuario marco el checkbox
    await saveAsignacionIfChecked({ proveedorKey: key, contactoId: id });

    // 3) Refresca UI
    await cargarContactosGuardados();
    document.dispatchEvent(new Event('reload-tabla-contactos'));
    toast(`Asociado a ${esc(name)}`, { variant: 'success' });
    cerrarModal();
  } catch (err) {
    console.error(err);
    toast('No se pudo asociar', { variant: 'error' });
  }
}

function cerrarModal() {
  getModalInstance('modalAsociar')?.close();
}
