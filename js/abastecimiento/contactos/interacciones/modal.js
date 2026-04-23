// modal.js - Interacciones
// - Usa API_BASE desde ./api.js
// - Autocomplete de contacto + proveedor
// - "Proximo paso" como select estandar

import { create, update, API_BASE } from './api.js';
import { state, slug } from '../state.js';
import { escapeHtml, fetchJson, getModalInstance } from '../ui-common.js';
import { toast } from '../../../ui/toast.js';

let RESPONSABLES = [];
let PROXIMO_PASO_OPCIONES = [];

async function fetchMaestrosList(tipo) {
  const res = await fetch(`${API_BASE}/maestros?tipo=${tipo}&soloActivos=true`);
  if (!res.ok) throw new Error(`Error ${res.status} cargando ${tipo}`);
  const { items } = await res.json();
  return items || [];
}

async function refreshMaestros() {
  const [resps, pasos] = await Promise.all([
    fetchMaestrosList('responsable'),
    fetchMaestrosList('proximo-paso'),
  ]);
  RESPONSABLES          = resps.map((i) => i.nombre);
  PROXIMO_PASO_OPCIONES = pasos.map((i) => i.nombre);
}

const esc = escapeHtml;
const apiJson = (url, options = {}) => fetchJson(url, { credentials: 'same-origin', ...options });

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function toLocalDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDT(local) {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function matchResp(v) {
  const x = String(v || '').trim().toLowerCase();
  return RESPONSABLES.find((r) => r.toLowerCase() === x) || '';
}

function getTipoMeta(tipo) {
  const key = String(tipo || '').toLowerCase();
  if (key === 'reunion') return { label: 'Reunion', icon: 'groups' };
  if (key === 'visita') return { label: 'Visita', icon: 'hiking' };
  if (key === 'muestra') return { label: 'Muestra', icon: 'science' };
  if (key === 'tarea') return { label: 'Compromiso', icon: 'task_alt' };
  return { label: 'Llamada', icon: 'call' };
}

function attachAutocomplete(inputEl, fetcher, onPick, { min = 2 } = {}) {
  const wrap = inputEl.closest('.am-input-group') || inputEl.parentNode;
  wrap.style.position = wrap.style.position || 'relative';

  const box = document.createElement('div');
  box.className = 'am-dropdown';
  wrap.appendChild(box);

  let last = '';
  let timer = null;

  const close = () => { box.innerHTML = ''; box.classList.remove('is-open'); };
  const open = (html) => { box.innerHTML = html; box.classList.add('is-open'); };

  async function run(q) {
    let items = [];
    try { items = await fetcher(q); } catch (e) {
      open('<div class="am-dropdown-empty">Error consultando sugerencias</div>');
      return;
    }
    if (!items || !items.length) {
      open('<div class="am-dropdown-empty">Sin resultados</div>');
      return;
    }
    box.innerHTML = items.map((it, idx) => `
      <div class="am-dropdown-item ac-item" data-idx="${idx}">
        <strong>${esc(it.label)}</strong>
        ${it.sublabel ? `<span>${esc(it.sublabel)}</span>` : ''}
      </div>`).join('');
    box.classList.add('is-open');
    box.querySelectorAll('.ac-item').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number(el.getAttribute('data-idx'));
        close();
        onPick?.(items[i]);
      });
    });
  }

  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim();
    if (q === last) return;
    last = q;
    if (timer) clearTimeout(timer);
    if (q.length < min) { close(); return; }
    open('<div class="am-dropdown-empty">Buscando...</div>');
    timer = setTimeout(() => run(q), 160);
  });

  inputEl.addEventListener('focus', () => {
    const q = inputEl.value.trim();
    if (q.length >= min) { open('<div class="am-dropdown-empty">Buscando...</div>'); run(q); }
  });

  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && e.target !== inputEl) close();
  }, true);
}

function normalizeContacto(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const contactoId = raw.contactoId || raw._id || raw.id || null;
  const contactoNombre = raw.contactoNombre || raw.nombre || raw.contacto || raw.name || '';
  const email = raw.email || raw.contactoEmail || '';
  const telefono = raw.telefono || raw.phone || raw.contactoTelefono || '';
  let empresas = [];
  if (Array.isArray(raw.empresas) && raw.empresas.length) {
    empresas = raw.empresas.map((e) => ({
      nombre: e.nombre || e.proveedorNombre || '',
      proveedorKey: e.proveedorKey || e.empresaKey || ''
    }));
  } else {
    const nombre = raw.proveedorNombre || raw.empresa || '';
    const proveedorKey = raw.proveedorKey || raw.empresaKey || '';
    if (nombre || proveedorKey) empresas = [{ nombre, proveedorKey }];
  }
  const label = raw.label || contactoNombre || '';
  return { contactoId, contactoNombre, email, telefono, empresas, label };
}

function clientFilter(items, q, limit = 8) {
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return items.slice(0, limit);

  function scoreRow(r) {
    const haystack = [
      r.contactoNombre,
      r.email,
      r.telefono,
      (r.empresas?.map((e) => e.nombre).join(' ') || '')
    ].map(norm).join(' ');

    if (!tokens.every((t) => haystack.includes(t))) return -1;
    const name = norm(r.contactoNombre || '');
    let score = 0;
    tokens.forEach((t) => {
      if (name.startsWith(t)) score += 3;
      else if (name.includes(t)) score += 2;
      else score += 1;
    });
    return score;
  }

  return items
    .map((r) => ({ r, s: scoreRow(r) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);
}

async function fetchContactosSmart(q) {
  const limit = 30;
  const tries = [
    `${API_BASE}/suggest/contactos?q=${encodeURIComponent(q)}&limit=${limit}`,
    `${API_BASE}/contactos?search=${encodeURIComponent(q)}&limit=${limit}`,
    `${API_BASE}/contactos?q=${encodeURIComponent(q)}&limit=${limit}`,
    `${API_BASE}/contactos?nombre=${encodeURIComponent(q)}&limit=${limit}`,
  ];

  for (const url of tries) {
    try {
      const json = await apiJson(url);
      const arr = Array.isArray(json) ? json
        : Array.isArray(json.items) ? json.items
        : Array.isArray(json.data) ? json.data
        : [];
      const normed = arr.map(normalizeContacto).filter(Boolean);
      if (normed.length) return normed;
    } catch (err) {
      console.warn('[suggest] fallo', url, err?.message);
    }
  }
  return [];
}

export async function openInteraccionModal({ preset = {}, onSaved } = {}) {
  await refreshMaestros();
  const id = 'modal-interaccion';
  let modal = document.getElementById(id);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = id;
    document.body.appendChild(modal);
  }
  modal.className = 'modal app-modal-modern';

  const currentTipo = String(preset.tipo || 'llamada').toLowerCase();
  const lockTipo = !preset._id && !!preset.tipo;
  const tipoMeta = getTipoMeta(currentTipo);
  const modalTitle = preset._id ? 'Editar interacción' : (lockTipo ? `Nueva ${tipoMeta.label.toLowerCase()}` : 'Nueva interacción');

  const tipoFieldHtml = lockTipo
    ? `<input id="i-tipo" type="hidden" value="${esc(currentTipo)}">`
    : `<div class="am-input-group col-3">
        <label class="am-label">Tipo</label>
        <select id="i-tipo" class="am-select browser-default">
          <option value="llamada">Llamada</option>
          <option value="visita">Visita</option>
          <option value="muestra">Muestra</option>
          <option value="reunion">Reunión</option>
          <option value="tarea">Tarea</option>
        </select>
      </div>`;

  const fechaCol  = lockTipo ? 'col-4' : 'col-3';
  const respCol   = lockTipo ? 'col-4' : 'col-3';
  const estadoCol = lockTipo ? 'col-4' : 'col-3';

  modal.innerHTML = `
    <div class="app-modal-header">
      <div class="app-modal-header-top">
        <h5>${modalTitle}</h5>
        <button type="button" class="modal-close" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px;">&times;</button>
      </div>
    </div>

    <div class="app-modal-body">
      <div class="am-form-grid">

        <div class="am-input-group ${fechaCol}">
          <label class="am-label">Fecha</label>
          <input id="i-fecha" class="am-input" type="datetime-local">
        </div>
        ${tipoFieldHtml}
        <div class="am-input-group ${respCol}">
          <label class="am-label">Responsable</label>
          <select id="i-responsable" class="am-select browser-default"></select>
        </div>
        <div class="am-input-group ${estadoCol}">
          <label class="am-label">Estado</label>
          <select id="i-estado" class="am-select browser-default">
            <option value="pendiente">Pendiente</option>
            <option value="agendado">Agendado</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <div class="am-input-group col-4" style="position:relative;">
          <label class="am-label">Contacto</label>
          <input id="i-contacto-nombre" class="am-input" placeholder="Nombre contacto" autocomplete="off">
        </div>
        <div class="am-input-group col-4" style="position:relative;">
          <label class="am-label">Proveedor</label>
          <input id="i-proveedor-nombre" class="am-input" placeholder="Se autocompleta al elegir contacto" autocomplete="off">
        </div>
        <div class="am-input-group col-4">
          <label class="am-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>Centro (opcional)</span>
            <button type="button" id="i-open-centro-mapa" style="background:none;border:none;color:#4f46e5;cursor:pointer;font-size:12px;font-weight:700;padding:0;display:flex;align-items:center;gap:4px;">
              <i class="material-icons" style="font-size:14px;">map</i> Ver mapa
            </button>
          </label>
          <select id="i-centro-id" class="am-select browser-default">
            <option value="">Sin centro</option>
          </select>
        </div>

        <div class="am-input-group col-3">
          <label class="am-label">Área</label>
          <input id="i-area-codigo" class="am-input" placeholder="Se completa al elegir centro" readonly>
        </div>
        <div class="am-input-group col-3">
          <label class="am-label">Tons conversadas</label>
          <input id="i-tons" class="am-input" type="number" min="0" step="1">
        </div>
        <div class="am-input-group col-3">
          <label class="am-label">Próximo paso</label>
          <select id="i-prox-paso" class="am-select browser-default">
            <option value="">Seleccione...</option>
            ${PROXIMO_PASO_OPCIONES.map((op) => `<option value="${esc(op)}">${esc(op)}</option>`).join('')}
          </select>
        </div>
        <div class="am-input-group col-3">
          <label class="am-label">Fecha próximo paso</label>
          <input id="i-fecha-prox" class="am-input" type="datetime-local">
        </div>

        <div class="am-input-group col-12">
          <label class="am-label">Resumen / Observaciones</label>
          <textarea id="i-resumen" class="am-input" placeholder="Resumen..." style="height:72px;resize:none;padding-top:10px;"></textarea>
        </div>

        <input type="hidden" id="i-contacto-id">
        <input type="hidden" id="i-proveedor-key">
      </div>
    </div>

    <div class="app-modal-footer">
      <button type="button" class="am-btn am-btn-flat modal-close">Cancelar</button>
      <button type="button" id="i-save" class="am-btn am-btn-primary">
        <i class="bi bi-check-lg"></i> Guardar
      </button>
    </div>`;

  const inst = getModalInstance(id, { dismissible: true });
  inst?.open();

  const $ = (sel) => modal.querySelector(sel);
  const setVal = (sel, val) => { const el = $(sel); if (el) el.value = val ?? ''; };

  const selResp = $('#i-responsable');
  selResp.innerHTML = '<option value=""></option>' + RESPONSABLES.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join('');

  setVal('#i-fecha', toLocalDT(preset.fecha || new Date().toISOString()));
  setVal('#i-tipo', preset.tipo || 'llamada');
  setVal('#i-responsable', matchResp(preset.responsable));
  setVal('#i-contacto-nombre', preset.contactoNombre || '');
  setVal('#i-proveedor-nombre', preset.proveedorNombre || '');
  setVal('#i-tons', preset.tonsConversadas ?? '');
  setVal('#i-prox-paso', preset.proximoPaso || '');
  setVal('#i-fecha-prox', toLocalDT(preset.fechaProx || ''));
  setVal('#i-estado', preset.estado || 'pendiente');
  setVal('#i-resumen', preset.resumen || '');
  setVal('#i-contacto-id', preset.contactoId || '');
  setVal('#i-proveedor-key', preset.proveedorKey || '');

  const elContacto = $('#i-contacto-nombre');
  const elProveedor = $('#i-proveedor-nombre');
  const elContactoId = $('#i-contacto-id');
  const elProvKey = $('#i-proveedor-key');
  const elCentroSel = $('#i-centro-id');
  const elArea = $('#i-area-codigo');

  const picked = {
    contactoId: preset.contactoId || null,
    proveedorKey: preset.proveedorKey || null
  };

  function normProveedorKeyFromNombre(nombre) {
    const n = String(nombre || '').trim();
    if (!n) return '';
    const byName = (state.listaProveedores || []).find(
      (p) => String(p?.nombreOriginal || '').trim().toLowerCase() === n.toLowerCase()
    );
    return String(byName?.proveedorKey || slug(n) || '');
  }

  function renderCentrosByProveedor(proveedorKey, selectedCentroId = '') {
    const key = String(proveedorKey || '').trim();
    const centros = (state.listaCentros || []).filter((c) => {
      const cKey = String(c.proveedorKey || slug(c.proveedor || '') || '').trim();
      return key && cKey === key;
    });

    let html = '<option value="">Sin centro</option>';
    html += centros.map((c) => {
      const idCentro = String(c._id || c.id || '');
      const code = String(c.code || c.codigo_centro || c.centroCodigo || '').trim();
      const comuna = String(c.comuna || c.centroComuna || '').trim();
      const areaCodigo = String(c.codigoArea || c.areaCodigo || c.area || 'Sin area').trim();
      const label = [code || idCentro, comuna].filter(Boolean).join(' - ');
      return `<option value="${esc(idCentro)}" data-code="${esc(code)}" data-comuna="${esc(comuna)}" data-area="${esc(areaCodigo)}">${esc(label || 'Centro')}</option>`;
    }).join('');

    elCentroSel.innerHTML = html;
    if (selectedCentroId) elCentroSel.value = String(selectedCentroId);
    if (!elCentroSel.value && preset.centroId) elCentroSel.value = String(preset.centroId);
    if (!elCentroSel.value) elCentroSel.selectedIndex = 0;
    const opt = elCentroSel.selectedOptions?.[0];
    elArea.value = opt?.dataset?.area || '';
  }

  function getCentroMeta() {
    const opt = elCentroSel?.selectedOptions?.[0];
    return {
      code: opt?.dataset?.code || '',
      comuna: opt?.dataset?.comuna || '',
      area: opt?.dataset?.area || ''
    };
  }

  const initialProvKey = picked.proveedorKey || normProveedorKeyFromNombre(preset.proveedorNombre || '');
  renderCentrosByProveedor(initialProvKey, preset.centroId || '');
  if (elArea && preset.areaCodigo && !elArea.value) elArea.value = String(preset.areaCodigo);

  elCentroSel?.addEventListener('change', () => {
    const opt = elCentroSel.selectedOptions?.[0];
    if (elArea) elArea.value = opt?.dataset?.area || '';
  });

  elProveedor?.addEventListener('change', () => {
    const k = normProveedorKeyFromNombre(elProveedor.value || '');
    picked.proveedorKey = k || picked.proveedorKey;
    renderCentrosByProveedor(k, '');
  });

  attachAutocomplete(
    elContacto,
    async (q) => {
      const raw = await fetchContactosSmart(q);
      const filtered = clientFilter(raw, q, 8);
      return filtered.map((it) => ({
        value: it.contactoNombre || '',
        label: it.label || it.contactoNombre || '',
        sublabel: (it.email || it.telefono || '') + (it.empresas?.[0]?.nombre ? `  ${it.empresas[0].nombre}` : ''),
        meta: it
      }));
    },
    (it) => {
      elContacto.value = it.value;
      picked.contactoId = it.meta.contactoId || null;
      elContactoId.value = picked.contactoId || '';

      const empresa = (it.meta.empresas && it.meta.empresas[0]) || null;
      if (empresa) {
        elProveedor.value = empresa.nombre || '';
        picked.proveedorKey = empresa.proveedorKey || empresa.empresaKey || null;
        elProvKey.value = picked.proveedorKey || '';
        renderCentrosByProveedor(picked.proveedorKey, '');
      } else {
        elProveedor.value = '';
        picked.proveedorKey = null;
        elProvKey.value = '';
        renderCentrosByProveedor('', '');
      }
    },
    { min: 2 }
  );

  $('#i-open-centro-mapa')?.addEventListener('click', () => {
    const opt = elCentroSel?.selectedOptions?.[0];
    const focus = String(opt?.dataset?.code || opt?.textContent || '').trim();
    const url = `/html/Centros/index.html?focusCentro=${encodeURIComponent(focus || '')}#tab-mapa`;
    const w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
  });

  $('#i-save')?.addEventListener('click', async () => {
    const centroMeta = getCentroMeta();
    const payload = {
      tipo: ($('#i-tipo')?.value || 'llamada'),
      fecha: fromLocalDT($('#i-fecha')?.value || ''),
      responsable: matchResp($('#i-responsable')?.value || ''),
      contactoNombre: $('#i-contacto-nombre')?.value || '',
      proveedorNombre: $('#i-proveedor-nombre')?.value || '',
      tonsConversadas: num($('#i-tons')?.value || ''),
      proximoPaso: $('#i-prox-paso')?.value || '',
      fechaProx: fromLocalDT($('#i-fecha-prox')?.value || ''),
      estado: ($('#i-estado')?.value || 'pendiente'),
      resumen: $('#i-resumen')?.value || '',
      contactoId: picked.contactoId || preset.contactoId || null,
      proveedorKey: picked.proveedorKey || preset.proveedorKey || null,
      centroId: (elCentroSel?.value || preset.centroId || null),
      centroCodigo: centroMeta.code || preset.centroCodigo || null,
      comuna: centroMeta.comuna || preset.comuna || null,
      areaCodigo: ($('#i-area-codigo')?.value || centroMeta.area || preset.areaCodigo || null),
    };

    try {
      if (preset._id) await update(preset._id, payload);
      else await create(payload);
      toast('Interacción guardada', { variant: 'success', durationMs: 1500 });
      getModalInstance(id)?.close();
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast('Error al guardar', { variant: 'error' });
    }
  });
}
