// /js/contactos/asociar-empresa.js
import { apiPatchContactoSafe } from '../../core/api.js';   // ← PATCH seguro
import { state, $, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';

/* ---------------- helpers ---------------- */
const API_BASE = (window.API_URL || '/api'); // base para POST asignaciones

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const norm = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const pad2 = (n) => String(n).padStart(2, '0');
const mesKeyFrom = (anio, mes) => `${anio}-${pad2(mes)}`;

/* Construye índice de empresas desde centros + contactos */
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
  const resp = await fetch(`${API_BASE}/asignaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(()=>'');
    throw new Error(`HTTP ${resp.status} - ${t}`);
  }
  try { return await resp.json(); } catch { return null; }
}

function getEl(id){ return document.getElementById(id); }

/** Guarda asignación si el checkbox está marcado */
async function saveAsignacionIfChecked({ proveedorKey, contactoId }){
  const chk = getEl('asigAgregarDisponibilidad');
  if (!chk || !chk.checked) return; // no pidió guardar

  const anio = parseInt(getEl('asigAnio')?.value, 10);
  const mes  = parseInt(getEl('asigMes')?.value, 10);
  const tons = parseFloat(getEl('asigTons')?.value);

  // Centro desde hidden (estandarizado) o desde el select si existe
  const centroIdHidden = getEl('centroId')?.value || '';
  const selCentro = getEl('selectCentro');
  const centroIdSel = selCentro ? selCentro.value : '';
  const centroId = centroIdHidden || centroIdSel || '';

  if (!proveedorKey) { M?.toast?.({ html:'Falta proveedor', classes:'red' }); return; }
  if (!contactoId)   { M?.toast?.({ html:'Falta contacto', classes:'red' }); return; }
  if (!centroId)     { M?.toast?.({ html:'Selecciona un centro', classes:'red' }); return; }
  if (!anio || !mes || Number.isNaN(tons)) {
    M?.toast?.({ html:'Completa año, mes y cantidad (ton)', classes:'red' });
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
  M?.toast?.({ html: 'Disponibilidad registrada en asignaciones', classes:'teal' });
}

/* ====================== INIT / UI del modal Empresas ====================== */
export function initAsociacionContactos() {
  providersCache = buildProvidersIndex();

  const input    = $('#empresaSearch');
  const ul       = $('#searchResults');
  const btnCrear = $('#btnCrearEmpresa');
  const btnQuitar= $('#btnQuitarEmpresa');

  // Inicializa el select de mes y toggle de bloque si existen en el modal
  const mesSel = getEl('asigMes');
  if (mesSel && window.M?.FormSelect) M.FormSelect.init(mesSel);

  const chk = getEl('asigAgregarDisponibilidad');
  const block = getEl('asigDisponibilidadBlock');
  const toggle = () => { if (block) block.style.display = (chk && chk.checked) ? '' : 'none'; };
  if (chk) { chk.addEventListener('change', toggle); toggle(); }

  /* --- renderer --- */
  const render = (items = []) => {
    if (!ul) return;
    if (!items.length) {
      ul.innerHTML = '<li class="collection-item grey-text">Sin resultados</li>';
      return;
    }
    ul.innerHTML = items.map(
      (p) => `<li class="collection-item">
        <a href="#!" class="sel-prov" data-key="${p.key}" data-name="${esc(p.name)}">${esc(p.name)}</a>
      </li>`).join('');
  };

  /* --- search (debounced, accent-insensitive) --- */
  const searchNow = (q) => {
    const s = norm(q || '');
    if (s.length < 2) { if (ul) ul.innerHTML = ''; return; }
    const items = providersCache.filter((p) => norm(p.name).includes(s)).slice(0, 20);
    render(items);
  };
  const search = (q) => {
    clearTimeout(debounceT);
    debounceT = setTimeout(() => searchNow(q), 120);
  };

  input?.addEventListener('input', (e) => search(e.target.value));

  // Enter => primer resultado
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = ul?.querySelector('a.sel-prov');
      if (first) first.click();
    }
  });

  // click en resultado → asocia y (si corresponde) guarda disponibilidad
  ul?.addEventListener('click', async (e) => {
    const a = e.target.closest('a.sel-prov');
    if (!a) return;
    await asociarAProveedor(a.dataset.key, a.dataset.name);
  });

  // crear empresa nueva con el texto actual → idem
  btnCrear?.addEventListener('click', async (e) => {
    e.preventDefault();
    const name = (input?.value || '').trim();
    if (name.length < 2) {
      M.toast?.({ html: 'Escribe un nombre (mín 2 letras)' });
      return;
    }
    await asociarAProveedor(slug(name), name);
  });

  // quitar empresa (y limpiar centro) — usar PATCH seguro
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
    // defaults de disponibilidad
    const now = new Date();
    if (getEl('asigAnio') && !getEl('asigAnio').value) getEl('asigAnio').value = now.getFullYear();
    if (mesSel && !mesSel.value) { mesSel.value = String(now.getMonth()+1); M.FormSelect?.init(mesSel); }
    input?.focus();
  });

  // Si se recargan contactos o centros, reconstruye índice
  document.addEventListener('reload-tabla-contactos', () => { providersCache = buildProvidersIndex(); });
  document.addEventListener('centros:loaded', () => { providersCache = buildProvidersIndex(); });
}

/* ---------------- acciones ---------------- */
async function asociarAProveedor(proveedorKey, proveedorNombre) {
  const id = state.asociarContactoId;
  if (!id) {
    M.toast?.({ html: 'No hay contacto seleccionado', classes: 'red' });
    return;
  }
  const key  = (proveedorKey || slug(proveedorNombre || '')).trim();
  const name = (proveedorNombre || '').trim();

  try {
    // 1) Asocia proveedor (PATCH seguro)
    await apiPatchContactoSafe(id, {
      proveedorKey: key,
      proveedorNombre: name,
      // limpia centro hasta que lo seleccionen explícitamente
      centroId: null,
      centroCodigo: null,
      centroComuna: null,
      centroHectareas: null,
    });

    // 2) (Opcional) Guarda disponibilidad en 'asignaciones' si el usuario marcó el checkbox
    await saveAsignacionIfChecked({ proveedorKey: key, contactoId: id });

    // 3) Refresca UI
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
