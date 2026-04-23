// /js/abastecimiento/contactos/quick-disponibilidad.js
// Botón global "Agregar biomasa" en Directorio (Disponibilidades)

import { state, slug } from './state.js';
import { escapeHtml, fetchJson, getModalInstance, debounce } from './ui-common.js';
import { toast } from '../../ui/toast.js';

const API_BASE = window.API_URL || '/api';
const esc = escapeHtml;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthNowKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function normalizeText(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function contactosSource() {
  // Preferimos el listado expuesto por el orquestador; fallback al state local.
  const list = window._contactosGuardados || state.contactosGuardados || [];
  return Array.isArray(list) ? list : [];
}

function buildSearchKey(c) {
  return normalizeText([
    c?.proveedorNombre,
    c?.proveedorKey,
    c?.contactoNombre,
    c?.centroCodigo,
    c?.centroComuna,
    c?.responsablePG
  ].filter(Boolean).join(' '));
}

function ensureInBody(el) {
  if (!el) return;
  if (el.parentElement !== document.body) document.body.appendChild(el);
}

function closeDrop() {
  const drop = document.getElementById('qdProveedorDrop');
  if (drop) drop.style.display = 'none';
}

function setSelectedContacto(c) {
  document.getElementById('qdProveedorInput').value = c?.proveedorNombre || c?.proveedorKey || '';
  document.getElementById('qdContactoId').value = String(c?._id || c?.id || '');
  closeDrop();
  try { document.getElementById('qdTons')?.focus(); } catch {}
}

function renderDrop(items) {
  const drop = document.getElementById('qdProveedorDrop');
  if (!drop) return;
  if (!items.length) {
    drop.innerHTML = `<div class="trato-autocomplete-item" style="cursor:default;color:#94a3b8;">Sin resultados</div>`;
    drop.style.display = '';
    return;
  }

  drop.innerHTML = items.map((c) => {
    const prov = esc(c?.proveedorNombre || c?.proveedorKey || '—');
    const cont = esc(c?.contactoNombre || '');
    const centro = esc(c?.centroCodigo || '');
    const comuna = esc(c?.centroComuna || c?.comuna || '');
    const sub = [cont, centro, comuna].filter(Boolean).join(' · ');
    return `
      <div class="trato-autocomplete-item" data-id="${esc(c?._id || c?.id || '')}">
        <strong>${prov}</strong>
        ${sub ? `<small>${esc(sub)}</small>` : ''}
      </div>
    `.trim();
  }).join('');

  drop.style.display = '';
}

async function guardarDisponibilidad() {
  const btn = document.getElementById('btnQdGuardar');
  if (!btn) return;

  const contactoId = String(document.getElementById('qdContactoId')?.value || '').trim();
  const mesKey = String(document.getElementById('qdMes')?.value || '').trim(); // YYYY-MM
  const tons = Number(String(document.getElementById('qdTons')?.value || '').replace(',', '.'));

  if (!contactoId) {
    toast('Selecciona un proveedor', { variant: 'warning' });
    return;
  }
  if (!/^\d{4}-\d{2}$/.test(mesKey)) {
    toast('Selecciona un mes válido', { variant: 'warning' });
    return;
  }
  if (!Number.isFinite(tons) || tons <= 0) {
    toast('Ingresa tons > 0', { variant: 'warning' });
    return;
  }

  const contactos = contactosSource();
  const c = contactos.find((x) => String(x?._id || x?.id) === contactoId) || null;
  if (!c) {
    toast('Proveedor no encontrado en el directorio', { variant: 'error' });
    return;
  }

  const [anioStr, mesStr] = mesKey.split('-');
  const anio = Number(anioStr);
  const mes = Number(mesStr);

  const proveedorNombre = String(c?.proveedorNombre || '').trim();
  const proveedorKey = String(c?.proveedorKey || (proveedorNombre ? slug(proveedorNombre) : '')).trim();

  btn.disabled = true;
  btn.textContent = 'Guardando…';
  try {
    await fetchJson(`${API_BASE}/disponibilidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anio,
        mes,
        tonsDisponible: tons,
        proveedorKey,
        proveedorNombre,
        contactoId,
        contactoNombre: c?.contactoNombre || '',
        contactoTelefono: c?.contactoTelefono || '',
        contactoEmail: c?.contactoEmail || '',
        centroId: c?.centroId || null,
        centroCodigo: c?.centroCodigo || '',
        comuna: c?.centroComuna || c?.comuna || '',
        estado: 'disponible'
      })
    });

    // limpiar caches de tons en tabla
    try { state.dispTotalCache?.clear?.(); } catch {}

    // reset UI + refrescar tabla
    document.getElementById('qdTons').value = '';
    closeDrop();
    getModalInstance('modalQuickDisponibilidad')?.close();
    toast('Biomasa disponible registrada', { variant: 'success' });
    document.dispatchEvent(new Event('reload-tabla-contactos'));
  } catch (e) {
    console.error('[quick-disponibilidad] save error', e);
    toast('No se pudo guardar la biomasa', { variant: 'error' });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

function openQuickModal() {
  const modalEl = document.getElementById('modalQuickDisponibilidad');
  if (!modalEl) return;
  ensureInBody(modalEl);

  const input = document.getElementById('qdProveedorInput');
  const hid = document.getElementById('qdContactoId');
  const drop = document.getElementById('qdProveedorDrop');
  const mesEl = document.getElementById('qdMes');
  const tonsEl = document.getElementById('qdTons');

  if (hid) hid.value = '';
  if (input) input.value = '';
  if (drop) drop.style.display = 'none';
  if (mesEl && !mesEl.value) mesEl.value = monthNowKey();
  if (tonsEl) tonsEl.value = '';

  getModalInstance('modalQuickDisponibilidad', { dismissible: true })?.open();
  try { input?.focus?.(); } catch {}
}

function bindAutocomplete() {
  const input = document.getElementById('qdProveedorInput');
  const drop = document.getElementById('qdProveedorDrop');
  if (!input || !drop) return;

  const doSearch = debounce(() => {
    const q = normalizeText(input.value || '');
    if (q.length < 2) {
      drop.style.display = 'none';
      drop.innerHTML = '';
      return;
    }
    const src = contactosSource();
    const matches = src
      .map((c) => ({ c, k: c._qdKey || (c._qdKey = buildSearchKey(c)) }))
      .filter((x) => x.k.includes(q))
      .slice(0, 10)
      .map((x) => x.c);
    renderDrop(matches);
  }, 120);

  input.addEventListener('input', () => {
    document.getElementById('qdContactoId').value = '';
    doSearch();
  });

  drop.addEventListener('click', (e) => {
    const item = e.target.closest('.trato-autocomplete-item[data-id]');
    if (!item) return;
    const id = String(item.dataset.id || '').trim();
    const c = contactosSource().find((x) => String(x?._id || x?.id) === id) || null;
    if (c) setSelectedContacto(c);
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !drop.contains(e.target)) closeDrop();
  });
}

function init() {
  const btn = document.getElementById('btnQuickDisponibilidad');
  if (btn && btn.dataset.bound !== '1') {
    btn.dataset.bound = '1';
    btn.addEventListener('click', openQuickModal);
  }

  const save = document.getElementById('btnQdGuardar');
  if (save && save.dataset.bound !== '1') {
    save.dataset.bound = '1';
    save.addEventListener('click', guardarDisponibilidad);
  }

  bindAutocomplete();
}

document.addEventListener('DOMContentLoaded', init);
