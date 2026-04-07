// modal.js - Interacciones
// - Usa API_BASE desde ./api.js
// - Autocomplete de contacto + proveedor
// - "Proximo paso" como select estandar

import { create, update, API_BASE } from './api.js';
import { state, slug } from '../state.js';
import { escapeHtml, fetchJson, getModalInstance } from '../ui-common.js';

const RESPONSABLES = [
  'Claudio Alba',
  'Patricio Alvarez',
  'Carlos Avendano',
];

const PROXIMO_PASO_OPCIONES = [
  'Nueva visita',
  'Tomar muestras',
  'Negociar precio/volumen',
  'Contacto telefonico',
  'Reunion',
  'Esperar disponibilidad',
  'Sin accion',
];

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
  const field = inputEl.closest('.input-field') || inputEl.parentNode;
  field.style.position = field.style.position || 'relative';

  const box = document.createElement('div');
  box.className = 'autocomplete-menu card';
  field.appendChild(box);

  let last = '';
  let timer = null;

  const close = () => { box.innerHTML = ''; box.style.display = 'none'; };
  const open = (html) => { box.innerHTML = html; box.style.display = 'block'; };

  async function run(q) {
    let items = [];
    try {
      items = await fetcher(q);
    } catch (e) {
      console.error('[autocomplete] error consultando', e);
      open('<div class="autocomplete-empty">Error consultando sugerencias</div>');
      return;
    }
    if (!items || !items.length) {
      open('<div class="autocomplete-empty">Sin resultados</div>');
      return;
    }
    const html = items.map((it, idx) => `
      <a href="#" data-idx="${idx}" class="collection-item ac-item">
        <div class="ac-title">${esc(it.label)}</div>
        ${it.sublabel ? `<div class="grey-text ac-sub">${esc(it.sublabel)}</div>` : ''}
      </a>`).join('');
    open(`<div class="collection">${html}</div>`);
    box.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const i = Number(a.getAttribute('data-idx'));
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
    open('<div class="autocomplete-empty">Buscando...</div>');
    timer = setTimeout(() => run(q), 160);
  });

  inputEl.addEventListener('focus', () => {
    const q = inputEl.value.trim();
    if (q.length >= min) {
      open('<div class="autocomplete-empty">Buscando...</div>');
      run(q);
    }
  });

  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && e.target !== inputEl) close();
  });
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

export function openInteraccionModal({ preset = {}, onSaved } = {}) {
  const id = 'modal-interaccion';
  let modal = document.getElementById(id);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal app-modal app-modal--wide app-modal--form modal-interaccion';
    document.body.appendChild(modal);
  } else {
    modal.className = 'modal app-modal app-modal--wide app-modal--form modal-interaccion';
  }

  const currentTipo = String(preset.tipo || 'llamada').toLowerCase();
  const lockTipo = !preset._id && !!preset.tipo;
  const tipoMeta = getTipoMeta(currentTipo);
  const modalTitle = preset._id ? 'Editar interaccion' : (lockTipo ? `Nueva ${tipoMeta.label.toLowerCase()}` : 'Nueva interaccion');
  const tipoFieldHtml = lockTipo
    ? `<input id="i-tipo" type="hidden" value="${esc(currentTipo)}">`
    : `
      <label class="inter-field-tipo inter-field-short">Tipo
        <select id="i-tipo" class="browser-default modern-select">
          <option value="llamada">Llamada</option>
          <option value="visita">Visita</option>
          <option value="muestra">Muestra</option>
          <option value="reunion">Reunion</option>
          <option value="tarea">Tarea</option>
        </select>
      </label>`;

  modal.innerHTML = `
    <div class="modal-content">
      <div class="inter-modal-head">
        <div class="inter-modal-head-main">
          <h5>${modalTitle}</h5>
          <span class="inter-type-badge"><i class="material-icons tiny">${tipoMeta.icon}</i>${tipoMeta.label}</span>
        </div>
        <p>Registra llamada, reunion o compromiso en una vista simple.</p>
      </div>
      <div class="inter-modal-grid ${lockTipo ? 'inter-modal-grid--locked' : ''}">
        <label class="inter-field-fecha inter-field-short">Fecha de la interaccion
          <input id="i-fecha" class="mmpp-input" type="datetime-local">
        </label>
        ${tipoFieldHtml}
        <label class="inter-field-responsable">Responsable PG
          <select id="i-responsable" class="browser-default modern-select"></select>
        </label>

        <label class="inter-field-contacto inter-contacto-row">Contacto
          <input id="i-contacto-nombre" class="mmpp-input" placeholder="Nombre contacto" autocomplete="off">
        </label>
        <label class="inter-field-proveedor">Proveedor
          <input id="i-proveedor-nombre" class="mmpp-input" placeholder="Proveedor (se autocompleta al elegir contacto)" autocomplete="off">
        </label>
        <label class="inter-field-centro inter-field-short">
          <span class="inter-field-label">
            <span>Centro (opcional)</span>
            <button type="button" id="i-open-centro-mapa" class="inter-map-link" title="Ver centro en mapa">
              <i class="material-icons tiny">map</i> Ver mapa
            </button>
          </span>
          <select id="i-centro-id" class="browser-default modern-select">
            <option value="">Sin centro</option>
          </select>
        </label>
        <label class="inter-field-area inter-field-short">Area
          <input id="i-area-codigo" class="mmpp-input" placeholder="Se completa al elegir centro" readonly>
        </label>

        <label class="inter-field-tons inter-field-short">Tons conversadas (opcional)
          <input id="i-tons" class="mmpp-input" type="number" min="0" step="1">
        </label>
        <label class="inter-field-prox">Proximo paso
          <select id="i-prox-paso" class="browser-default modern-select">
            <option value="">Seleccione...</option>
            ${PROXIMO_PASO_OPCIONES.map((op) => `<option value="${esc(op)}">${esc(op)}</option>`).join('')}
          </select>
        </label>
        <label class="inter-field-fecha-prox inter-field-short">Fecha proximo paso
          <input id="i-fecha-prox" class="mmpp-input" type="datetime-local">
        </label>

        <label class="inter-field-estado inter-field-short">Estado
          <select id="i-estado" class="browser-default modern-select">
            <option value="pendiente">Pendiente</option>
            <option value="agendado">Agendado</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>

        <label class="span-2 inter-resumen-row">
          Resumen
          <textarea id="i-resumen" class="mmpp-input inter-modal-textarea" placeholder="Resumen/Observaciones"></textarea>
        </label>

        <input type="hidden" id="i-contacto-id">
        <input type="hidden" id="i-proveedor-key">
      </div>
    </div>
    <div class="modal-footer modal-actions">
      <button type="button" class="modal-close btn-flat">Cancelar</button>
      <button type="button" id="i-save" class="mmpp-button">Guardar</button>
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
      M.toast?.({ html: 'Interaccion guardada', displayLength: 1500 });
      getModalInstance(id)?.close();
      onSaved?.();
    } catch (e) {
      console.error(e);
      M.toast?.({ html: 'Error al guardar', classes: 'red' });
    }
  });
}
