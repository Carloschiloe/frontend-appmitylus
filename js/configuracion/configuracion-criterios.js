import { openAmModal, closeAmModal } from '../ui/am-modal.js';
import { toast } from '../ui/toast.js';

const LS_KEY = 'criteriosClasif';

let criterios = safeParseJson(localStorage.getItem(LS_KEY), []);
let editIdx = null;
let dt = null;

function safeParseJson(raw, fallback) {
  try {
    const v = JSON.parse(raw || '');
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(criterios)); } catch {}
}

function ensureModal() {
  let modal = document.getElementById('criterioModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'criterioModal';
  modal.className = 'am-modal';
  modal.style.maxWidth = '920px';
  modal.setAttribute('aria-hidden', 'true');
  document.body.appendChild(modal);
  return modal;
}

function renderModalContent(modal, data) {
  const isEdit = !!data && editIdx !== null;
  const title = isEdit ? 'Editar criterio' : 'Nuevo criterio';

  modal.innerHTML = `
    <div class="am-modal-head">
      <h3 class="am-modal-title">${esc(title)}</h3>
      <button type="button" class="am-modal-close" data-am-modal-close aria-label="Cerrar">×</button>
    </div>
    <div class="am-modal-body">
      <form id="formCriterio" class="am-form-grid" autocomplete="off">
        <div class="am-form-group" style="grid-column: span 2;">
          <label class="am-label" for="m-cliente">Cliente</label>
          <input id="m-cliente" class="am-input" type="text" value="${esc(data?.cliente || '')}" required />
        </div>

        <div class="am-form-group">
          <label class="am-label" for="m-unKgMin">Un/Kg mín.</label>
          <input id="m-unKgMin" class="am-input" type="number" min="0" step="1" value="${esc(data?.unKgMin ?? '')}" required />
        </div>
        <div class="am-form-group">
          <label class="am-label" for="m-unKgMax">Un/Kg máx.</label>
          <input id="m-unKgMax" class="am-input" type="number" min="0" step="1" value="${esc(data?.unKgMax ?? '')}" required />
        </div>

        <div class="am-form-group">
          <label class="am-label" for="m-rechazoMin">% Rechazo mín.</label>
          <input id="m-rechazoMin" class="am-input" type="number" min="0" max="100" step="0.01" value="${esc(data?.rechazoMin ?? '')}" required />
        </div>
        <div class="am-form-group">
          <label class="am-label" for="m-rechazoMax">% Rechazo máx.</label>
          <input id="m-rechazoMax" class="am-input" type="number" min="0" max="100" step="0.01" value="${esc(data?.rechazoMax ?? '')}" required />
        </div>

        <div class="am-form-group">
          <label class="am-label" for="m-rdmtoMin">% Rdmto mín.</label>
          <input id="m-rdmtoMin" class="am-input" type="number" min="0" max="100" step="0.01" value="${esc(data?.rdmtoMin ?? '')}" required />
        </div>
        <div class="am-form-group">
          <label class="am-label" for="m-rdmtoMax">% Rdmto máx.</label>
          <input id="m-rdmtoMax" class="am-input" type="number" min="0" max="100" step="0.01" value="${esc(data?.rdmtoMax ?? '')}" required />
        </div>
      </form>
      <p class="am-muted" style="margin:12px 0 0;">Se guarda en este navegador (localStorage) hasta integrar maestro central.</p>
    </div>
    <div class="am-modal-foot">
      <button type="button" class="am-btn am-btn-outline" data-am-modal-close>Cancelar</button>
      <button type="submit" form="formCriterio" class="am-btn am-btn-primary">
        <i class="bi bi-check-lg"></i> ${isEdit ? 'Actualizar' : 'Guardar'}
      </button>
    </div>
  `;

  const form = modal.querySelector('#formCriterio');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const cliente = String(modal.querySelector('#m-cliente')?.value || '').trim();
    const unKgMin = Number(modal.querySelector('#m-unKgMin')?.value);
    const unKgMax = Number(modal.querySelector('#m-unKgMax')?.value);
    const rechazoMin = Number(modal.querySelector('#m-rechazoMin')?.value);
    const rechazoMax = Number(modal.querySelector('#m-rechazoMax')?.value);
    const rdmtoMin = Number(modal.querySelector('#m-rdmtoMin')?.value);
    const rdmtoMax = Number(modal.querySelector('#m-rdmtoMax')?.value);

    if (!cliente) return toast('Cliente requerido', { variant: 'warning' });
    const nums = [unKgMin, unKgMax, rechazoMin, rechazoMax, rdmtoMin, rdmtoMax];
    if (nums.some((n) => Number.isNaN(n))) return toast('Campos numéricos inválidos', { variant: 'danger' });
    if (unKgMax < unKgMin || rechazoMax < rechazoMin || rdmtoMax < rdmtoMin) {
      return toast('Los máximos no pueden ser menores al mínimo', { variant: 'warning' });
    }

    const obj = { cliente, unKgMin, unKgMax, rechazoMin, rechazoMax, rdmtoMin, rdmtoMax };
    if (isEdit) criterios[editIdx] = obj;
    else criterios.push(obj);

    save();
    closeAmModal(modal);
    editIdx = null;
    renderTable();
  }, { once: true });
}

function renderTable() {
  const cont = document.getElementById('criterios-clasificacion-content');
  if (!cont) return;

  const tbody = cont.querySelector('#criteriosTable tbody');
  if (!tbody) return;

  tbody.innerHTML = (criterios || []).map((c, idx) => `
    <tr>
      <td>${esc(c.cliente)}</td>
      <td>${esc(c.unKgMin)}</td>
      <td>${esc(c.unKgMax)}</td>
      <td>${esc(c.rechazoMin)}</td>
      <td>${esc(c.rechazoMax)}</td>
      <td>${esc(c.rdmtoMin)}</td>
      <td>${esc(c.rdmtoMax)}</td>
      <td class="config-actions-cell">
        <button type="button" class="am-btn am-btn-outline am-btn-sm am-btn-icon btn-edit" data-idx="${idx}" aria-label="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button type="button" class="am-btn am-btn-danger am-btn-sm am-btn-icon btn-del" data-idx="${idx}" aria-label="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="8" class="config-empty">Sin resultados</td></tr>`;

  if (typeof $ !== 'undefined' && $.fn?.dataTable) {
    try {
      if (dt) { dt.destroy(); dt = null; }
      if ($.fn.dataTable.isDataTable('#criteriosTable')) $('#criteriosTable').DataTable().destroy();

      dt = $('#criteriosTable').DataTable({
        paging: false,
        searching: false,
        info: false,
        responsive: true,
        dom: '<"config-dt-toolbar"B>t',
        buttons: [
          { extend: 'copyHtml5', text: 'Copiar', className: 'am-export-btn' },
          { extend: 'csvHtml5', text: 'CSV', className: 'am-export-btn' },
          { extend: 'excelHtml5', text: 'Excel', className: 'am-export-btn' },
          { extend: 'pdfHtml5', text: 'PDF', className: 'am-export-btn' },
        ],
        language: { emptyTable: 'No hay criterios de clasificación' },
      });
    } catch (err) {
      console.warn('[config][criterios] DataTable init error', err);
    }
  }

  tbody.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      editIdx = Number(btn.dataset.idx);
      const modal = ensureModal();
      renderModalContent(modal, criterios[editIdx]);
      openAmModal(modal);
    });
  });

  tbody.querySelectorAll('.btn-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      if (!Number.isFinite(idx)) return;
      if (!confirm('¿Seguro de eliminar este criterio?')) return;
      criterios.splice(idx, 1);
      save();
      renderTable();
    });
  });
}

// ===== RENDER PRINCIPAL
export function renderCriteriosClasificacion() {
  const cont = document.getElementById('criterios-clasificacion-content');
  if (!cont) return;

  cont.innerHTML = `
    <div class="am-card config-card">
      <div class="config-card-head">
        <div>
          <h6 class="config-card-title">Criterios</h6>
          <p class="config-card-sub">Rangos base para clasificación por cliente.</p>
        </div>
        <div class="config-card-actions">
          <button id="btnAddCriterio" class="am-btn am-btn-primary" type="button">
            <i class="bi bi-plus-lg"></i> Nuevo criterio
          </button>
        </div>
      </div>

      <div class="config-table-wrap">
        <table id="criteriosTable" class="am-table display" aria-describedby="tablaCriteriosDescripcion">
          <caption id="tablaCriteriosDescripcion" class="sr-only">Tabla con criterios de clasificación</caption>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Un/Kg min</th>
              <th>Un/Kg max</th>
              <th>% Rechazo min</th>
              <th>% Rechazo max</th>
              <th>% Rdmto min</th>
              <th>% Rdmto max</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;

  cont.querySelector('#btnAddCriterio')?.addEventListener('click', () => {
    editIdx = null;
    const modal = ensureModal();
    renderModalContent(modal, null);
    openAmModal(modal);
  });

  renderTable();
}

