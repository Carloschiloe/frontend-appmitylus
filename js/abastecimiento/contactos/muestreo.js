import { createModalConfirm, getModalInstance, isModalOpen as isAnyModalOpen } from './ui-common.js';
import { listMuestreos, createMuestreo, updateMuestreo } from './muestreo-api.js';
import { toast } from '../../ui/toast.js';

let MUESTREO_CATS = [];

// Carga categorías desde Maestros (única fuente de verdad)
async function loadCategoriasFromAPI() {
  const res = await fetch('/api/maestros?tipo=categoria-muestreo&soloActivos=true');
  if (!res.ok) throw new Error(`Error ${res.status} cargando categorías de muestreo`);
  const { items } = await res.json();
  
  const toSlug = (txt) => String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/\s+/g, '_').replace(/[^\w-]+/g, '');

  MUESTREO_CATS = (items || []).map((it) => {
    const slug = toSlug(it.nombre);
    return {
      key: it._id,
      slug: slug,
      label: it.nombre,
      type: it.tipoCat || 'procesable',
    };
  });
}
loadCategoriasFromAPI();

function n2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function fmtNum(v, d = 2) {
  return (Number(v) || 0).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function safeText(v = '') {
  return String(v || '').trim();
}

const RANGE_LABELS = {
  uxkg: 'U x Kg',
  pesoVivo: 'Peso vivo',
  pesoCocida: 'Peso cocida',
  rendimiento: 'R% carne',
  total: 'Total muestra',
  procesable: 'Procesable',
  rechazos: 'Rechazos',
  defectos: 'Defectos'
};

function validateMuestreoRanges(row = {}) {
  const numericLimits = [
    { field: 'uxkg', min: 0, max: 1000 },
    { field: 'pesoVivo', min: 0, max: 200000 },
    { field: 'pesoCocida', min: 0, max: 200000 },
    { field: 'rendimiento', min: 0, max: 100 },
    { field: 'total', min: 0, max: 999999 },
    { field: 'procesable', min: 0, max: 999999 },
    { field: 'rechazos', min: 0, max: 999999 },
    { field: 'defectos', min: 0, max: 999999 }
  ];

  for (const cfg of numericLimits) {
    const value = Number(row[cfg.field]);
    const label = RANGE_LABELS[cfg.field] || cfg.field;
    if (!Number.isFinite(value)) return `${label} debe ser numerico.`;
    if (value < cfg.min || value > cfg.max) {
      return `${label} debe estar entre ${cfg.min} y ${cfg.max}.`;
    }
  }

  const cats = row.cats && typeof row.cats === 'object' ? row.cats : {};
  for (const cat of MUESTREO_CATS) {
    const value = Number(cats[cat.key] ?? 0);
    if (!Number.isFinite(value)) return `${cat.label}: valor invalido.`;
    if (value < 0 || value > 999999) return `${cat.label} debe estar entre 0 y 999999.`;
  }

  return '';
}

export function createMuestreoModule({
  activateTab,
  createInteraccion,
  listInteracciones,
  normalizeInteraccionForSave,
  onSavedGestion,
  normalizeText
}) {
  let muestreoStep = 1;
  let muestreoOpening = false;
  let muestreosCache = [];
  let muestreosDerivados = [];
  let derivadosTs = 0;
  let pendingSeed = null;
  let _lastSavedMuestreo = null;
  let currentSeed = null;
  let summaryScope = null;
  let remoteScopeKey = '';
  let remoteTs = 0;
  let remoteLoaded = false;
  let muDirty = false;
  let muestreoMode = 'create';
  let editingMuestreoId = '';
  const askConfirm = createModalConfirm({
    id: 'modalMuestreoConfirm',
    className: 'modal app-modal',
    defaultTitle: 'Confirmar accion',
    defaultMessage: 'Deseas continuar?',
    cancelText: 'Volver',
    acceptText: 'Aceptar'
  });
  const selectedMuestreoCats = new Set();
  const muCatValues = Object.create(null);

  function buildSummaryScope(seed = null) {
    if (!seed || typeof seed !== 'object') return null;
    const visitaId = safeText(seed.visitaId || seed.idVisita);
    if (visitaId) return { visitaId };
    const proveedorKey = safeText(seed.proveedorKey).toLowerCase();
    if (proveedorKey) return { proveedorKey };
    const proveedorNombre = safeText(seed.proveedor || seed.proveedorNombre);
    if (proveedorNombre) return { proveedorNombre };
    return null;
  }

  function getScopeKey(scope = null) {
    if (!(scope && typeof scope === 'object')) return '';
    return JSON.stringify(scope);
  }

  async function loadMuestreosRemote(force = false) {
    const key = getScopeKey(summaryScope);
    const now = Date.now();
    const isFresh = (now - remoteTs) < 45000;
    if (!force && key === remoteScopeKey && isFresh && remoteLoaded) return muestreosCache;

    const params = { limit: 2000, ...(summaryScope || {}) };
    const rows = await listMuestreos(params);
    muestreosCache = Array.isArray(rows) ? rows : [];
    remoteScopeKey = key;
    remoteTs = now;
    remoteLoaded = true;
    return muestreosCache;
  }

  function invalidateRemoteCache() {
    remoteTs = 0;
    remoteScopeKey = '';
    remoteLoaded = false;
  }

  function touchScope(scope = null) {
    const next = scope && typeof scope === 'object' ? { ...scope } : null;
    const nextKey = getScopeKey(next);
    const prevKey = getScopeKey(summaryScope);
    summaryScope = next;
    if (nextKey !== prevKey) {
      muestreosCache = [];
      invalidateRemoteCache();
    }
  }

  async function refreshDerivadosMuestreo(force = false) {
    if (typeof listInteracciones !== 'function') return [];
    const now = Date.now();
    if (!force && (now - derivadosTs) < 60000) return muestreosDerivados;
    try {
      const from = new Date(now - (14 * 24 * 60 * 60 * 1000)).toISOString();
      const to = new Date(now + (90 * 24 * 60 * 60 * 1000)).toISOString();
      const resp = await listInteracciones({ fromProx: from, toProx: to, limit: 2000 });
      const items = Array.isArray(resp?.items) ? resp.items : [];
      muestreosDerivados = items
        .filter((it) => {
          const paso = normalizeText(it?.proximoPaso || '');
          const estado = normalizeText(it?.estado || '');
          if (!paso.includes('tomar muestra')) return false;
          return estado === 'pendiente' || estado === 'agendado' || !estado;
        })
        .map((it) => ({
          id: String(it?._id || it?.id || ''),
          fecha: String(it?.fechaProximo || it?.proximoPasoFecha || it?.fecha || '').slice(0, 10),
          proveedor: it?.proveedorNombre || '-',
          centro: it?.centroCodigo || it?.centroId || '-',
          linea: '-',
          rendimiento: null,
          uxkg: null,
          procesable: null,
          rechazos: null,
          defectos: null,
          derivado: true,
          estado: normalizeText(it?.estado || '') || 'pendiente',
          route: 'terreno',
          rawPaso: String(it?.proximoPaso || ''),
          rawResumen: String(it?.resumen || '')
        }));
      derivadosTs = now;
      return muestreosDerivados;
    } catch (err) {
      console.warn('[muestreo] derivacion interacciones fallo', err);
      return muestreosDerivados;
    }
  }

  function getMuestreoInputs() {
    const centroVal = safeText(document.getElementById('muestreoCentro')?.value);
    return {
      proveedor: safeText(document.getElementById('muestreoProveedor')?.value),
      centro: centroVal,
      centroCodigo: centroVal,
      linea: safeText(document.getElementById('muestreoLinea')?.value),
      fecha: safeText(document.getElementById('muestreoFecha')?.value),
      origen: safeText(document.getElementById('muestreoOrigen')?.value || 'abastecimiento'),
      responsable: safeText(document.getElementById('muestreoResponsable')?.value),
      uxkg: n2(document.getElementById('muestreoUxKg')?.value),
      pesoVivo: n2(document.getElementById('muestreoPesoVivo')?.value),
      pesoCocida: n2(document.getElementById('muestreoPesoCocida')?.value)
    };
  }

  function setMuestreoRoute(route = 'abastecimiento') {
    const r = ['abastecimiento', 'calidad'].includes(route) ? route : 'abastecimiento';
    const inp = document.getElementById('muestreoOrigen');
    if (inp) inp.value = r;

    document.querySelectorAll('.mu-tipo-btn').forEach((btn) => {
      const isActive = btn.getAttribute('data-mu-route') === r;
      btn.classList.toggle('is-active', isActive);
      btn.style.background = isActive ? '#0ea5e9' : '#fff';
      btn.style.color = isActive ? '#fff' : '#64748b';
    });
    // Legacy support: old [data-mu-route] buttons if any remain
    document.querySelectorAll('[data-mu-route]:not(.mu-tipo-btn)').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-mu-route') === r);
    });
    const tech = document.getElementById('muestreoTechnicalBlock');
    if (tech) tech.style.display = '';
    refreshMuestreoStepSummary();
  }

  function refreshMuestreoStepSummary() {
    const el = document.getElementById('muStepSummaryText');
    if (!el) return;
    const b = getMuestreoInputs();
    const routeLabel = b.origen === 'planta' ? 'Planta' : (b.origen === 'directa' ? 'Directa' : 'Terreno');
    el.textContent = [routeLabel, b.proveedor || 'Proveedor -', b.linea || 'Linea -', b.fecha || 'Fecha -'].join(' | ');
  }

  function shouldShowMuestreoSide() {
    const formViewVisible = !document.getElementById('muestreoFormView')?.classList.contains('muestreo-hidden');
    return formViewVisible && muestreoStep === 3;
  }

  function markDirty() { muDirty = true; }
  function resetDirty() { muDirty = false; }

  function setMuestreoMode(mode = 'create', seed = null) {
    const edit = mode === 'edit';
    muestreoMode = edit ? 'edit' : 'create';
    editingMuestreoId = edit ? safeText(seed?.muestreoId || seed?.id || '') : '';

    const titleEl = document.getElementById('muModalTitle');
    if (titleEl) titleEl.textContent = edit ? 'Editar muestreo MMPP' : 'Nuevo Muestreo';

    const saveMain = document.getElementById('btnMuestreoSave');
    if (saveMain) saveMain.textContent = edit ? 'Guardar cambios' : 'Guardar muestreo';
  }

  function syncMuestreoSideModal() {}
  function syncMuestreoDualLayout() {}
  function scheduleMuestreoDualLayout() {}

  function setMuestreoStep(step = 1) {
    const requested = Math.max(1, Math.min(Number(step) || 1, 3));
    muestreoStep = requested;

    document.querySelectorAll('.mu-step-tab[data-mu-step]').forEach((btn) => {
      const n = Number(btn.getAttribute('data-mu-step') || '1');
      const active = n === muestreoStep;
      btn.classList.toggle('is-active', active);
      btn.style.borderBottom = active ? '2px solid #0f766e' : '2px solid transparent';
      btn.style.color = active ? '#0f766e' : '#94a3b8';
      const numEl = btn.querySelector('.mu-step-num');
      if (numEl) {
        numEl.style.background = active ? '#0f766e' : '#e2e8f0';
        numEl.style.color = active ? '#fff' : '#64748b';
      }
      btn.disabled = false;
    });

    document.getElementById('muStep1')?.classList.toggle('muestreo-hidden', muestreoStep !== 1);
    document.getElementById('muStep2')?.classList.toggle('muestreo-hidden', muestreoStep !== 2);
    document.getElementById('muStep3')?.classList.toggle('muestreo-hidden', muestreoStep !== 3);

    const navStep1 = document.getElementById('muNavStep1');
    const navStep2 = document.getElementById('muNavStep2');
    const navStep3 = document.getElementById('muNavStep3');
    const navHistorial = document.getElementById('muNavHistorial');
    if (navStep1) navStep1.style.display = muestreoStep === 1 ? 'flex' : 'none';
    if (navStep2) navStep2.style.display = muestreoStep === 2 ? 'flex' : 'none';
    if (navStep3) navStep3.style.display = muestreoStep === 3 ? 'flex' : 'none';
    if (navHistorial) navHistorial.style.display = 'none';

    refreshMuestreoStepSummary();
  }

  function computeMuestreoRendimiento() {
    const vivo = n2(document.getElementById('muestreoPesoVivo')?.value);
    const cocida = n2(document.getElementById('muestreoPesoCocida')?.value);
    const rend = (vivo > 0) ? (cocida / vivo) * 100 : 0;
    const el = document.getElementById('muestreoRendimiento');
    if (el) el.value = vivo > 0 ? `${fmtNum(rend, 2)} %` : '';
    return n2(rend);
  }

  function readMuestreoCategorias() {
    const out = {};
    MUESTREO_CATS.forEach((cat) => {
      const input = document.querySelector(`[data-mu-cat="${cat.key}"]`);
      const val = (input ? input.value : muCatValues[cat.key]);
      out[cat.key] = n2(val);
    });
    return out;
  }

  function computeMuestreoTotals() {
    const cats = readMuestreoCategorias();
    let total = 0;
    let procesable = 0;
    let rechazos = 0;
    let defectos = 0;
    MUESTREO_CATS.forEach((cat) => {
      const v = n2(cats[cat.key]);
      total += v;
      if (cat.type === 'procesable') procesable = v;
      else if (cat.type === 'rechazo') rechazos += v;
      else defectos += v;
    });
    return {
      total: n2(total),
      procesable: n2(procesable),
      rechazos: n2(rechazos),
      defectos: n2(defectos),
      cats
    };
  }

  function repaintMuestreoTable() {
    const totals = computeMuestreoTotals();
    const base = n2(totals.total); // Base es el TOTAL de la muestra
    
    // Calcular % para cada item en la lista lateral
    MUESTREO_CATS.forEach((cat) => {
      const pctEl = document.querySelector(`[data-mu-pct="${cat.key}"]`);
      if (!pctEl) return;
      const catValue = n2(totals.cats[cat.key]);
      const pct = base > 0 ? (catValue / base) * 100 : 0;
      pctEl.textContent = `${fmtNum(pct, 2)} %`;
    });

    // Actualizar tarjetas de resumen inferiores
    const totalPct = base > 0 ? 100 : 0;
    const procPct = base > 0 ? (totals.procesable / base) * 100 : 0;
    const rechPct = base > 0 ? (totals.rechazos / base) * 100 : 0;
    const defectPct = base > 0 ? (totals.defectos / base) * 100 : 0;

    const setCard = (id, weight, pct, showWeight = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (showWeight) {
        const weightTxt = weight > 0 ? `${fmtNum(weight, 2)} kg` : '-';
        el.textContent = `${weightTxt} (${fmtNum(pct, 2)}%)`;
      } else {
        el.textContent = `${fmtNum(pct, 2)} %`;
      }
    };

    const totalEl = document.getElementById('muTotalMuestra');
    if (totalEl) totalEl.textContent = totals.total > 0 ? `${fmtNum(totals.total, 2)} kg` : '—';
    setCard('muProcesable', totals.procesable, procPct);
    setCard('muRechazos',   totals.rechazos,   rechPct);
    setCard('muDefectos',   totals.defectos,   defectPct);
  }

  function renderMuestreoCategorias() {
    const editor   = document.getElementById('muCatEditorList');
    const selector = document.getElementById('muCatSelector');
    if (!editor || !selector) return;

    // Procesable siempre seleccionado (por tipo, desde maestros)
    MUESTREO_CATS.filter(c => c.type === 'procesable').forEach(c => selectedMuestreoCats.add(c.key));

    const tfoot = document.getElementById('muCatTotalsRow');

    const CFG = [
      { type: 'procesable', label: 'Procesable', color: '#0f766e', bg: '#f0fdf4', canRemove: false },
      { type: 'defecto',    label: 'Defectos',   color: '#2563eb', bg: '#fff7ed', canRemove: true  },
      { type: 'rechazo',    label: 'Rechazos',   color: '#dc2626', bg: '#fef2f2', canRemove: true  },
    ];

    const catsOf = (type) => MUESTREO_CATS.filter(c => c.type === type);

    // ── Fila de 3 botones tipo Excel filter ──────────────────────────────────
    selector.style.display = 'flex';
    selector.innerHTML = CFG.map(({ type, label, color }) => {
      const cats    = catsOf(type);
      const selKeys = cats.filter(c => selectedMuestreoCats.has(c.key));
      const badge   = selKeys.length
        ? `<span style="background:${color};color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:700;margin-left:2px;">${selKeys.length}</span>`
        : '';
      const items = cats.map(c => {
        const chk = selectedMuestreoCats.has(c.key);
        const disabled = type === 'procesable' ? 'disabled' : '';
        return `<label style="display:flex;align-items:center;gap:9px;padding:7px 14px;cursor:pointer;font-size:13px;color:#1e293b;user-select:none;"
            onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
            <input type="checkbox" data-mu-check="${c.key}" ${chk ? 'checked' : ''} ${disabled}
              style="width:15px;height:15px;accent-color:${color};cursor:pointer;flex-shrink:0;">
            ${c.label}
          </label>`;
      }).join('');

      return `<div style="position:relative;flex:1;">
        <button type="button" data-mu-group-btn="${type}"
          style="width:100%;display:flex;align-items:center;justify-content:space-between;
            background:#fff;border:1.5px solid ${selKeys.length ? color : '#e2e8f0'};border-radius:10px;
            padding:8px 12px;cursor:pointer;transition:border-color .15s;color:${selKeys.length ? color : '#475569'};">
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:9px;height:9px;border-radius:50%;background:${color};flex-shrink:0;"></span>
            <span style="font-size:13px;font-weight:600;">${label}</span>
            ${badge}
          </span>
          <span style="font-size:10px;color:#94a3b8;margin-left:4px;">▾</span>
        </button>
        <div id="muGroupDrop-${type}"
          style="display:none;position:absolute;left:0;top:calc(100% + 4px);z-index:200;
            background:#fff;border:1px solid #e2e8f0;border-radius:10px;
            box-shadow:0 8px 24px rgba(0,0,0,.14);min-width:100%;padding:4px 0 0;max-height:260px;overflow-y:auto;">
          ${items}
          <div style="padding:8px 12px;border-top:1px solid #f1f5f9;text-align:right;position:sticky;bottom:0;background:#fff;">
            <button type="button" data-mu-group-apply="${type}"
              style="background:${color};color:#fff;border:none;border-radius:7px;
                padding:6px 16px;font-size:12px;font-weight:700;cursor:pointer;width:100%;">
              Aplicar
            </button>
          </div>
        </div>
      </div>`;
    }).join('');

    // Toggle dropdown
    selector.querySelectorAll('[data-mu-group-btn]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.getAttribute('data-mu-group-btn');
        const drop = document.getElementById(`muGroupDrop-${type}`);
        if (!drop) return;
        const opening = drop.style.display === 'none';
        document.querySelectorAll('[id^="muGroupDrop-"]').forEach(d => { d.style.display = 'none'; });
        if (opening) drop.style.display = 'block';
      });
    });

    // Aplicar — lee checkboxes y actualiza selección
    selector.querySelectorAll('[data-mu-group-apply]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.getAttribute('data-mu-group-apply');
        const drop = document.getElementById(`muGroupDrop-${type}`);
        if (!drop) return;
        drop.querySelectorAll('[data-mu-check]').forEach(cb => {
          const key = cb.getAttribute('data-mu-check');
          if (!key) return;
          if (cb.checked) selectedMuestreoCats.add(key);
          else { selectedMuestreoCats.delete(key); muCatValues[key] = 0; }
        });
        drop.style.display = 'none';
        markDirty();
        renderMuestreoCategorias();
      });
    });

    // Evitar que clics dentro del dropdown lo cierren
    selector.querySelectorAll('[id^="muGroupDrop-"]').forEach(d => {
      d.addEventListener('click', e => e.stopPropagation());
    });

    // ── Tabla: filas de categorías seleccionadas ──────────────────────────────
    const typeOrder = { procesable: 0, defecto: 1, rechazo: 2 };
    const selected  = MUESTREO_CATS
      .filter(c => selectedMuestreoCats.has(c.key))
      .sort((a, b) => (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3));

    if (tfoot) tfoot.style.display = selected.length ? '' : 'none';

    if (!selected.length) {
      editor.innerHTML = '<tr><td colspan="3" style="padding:16px 10px;color:#94a3b8;font-size:13px;text-align:center;">Selecciona categorías con los botones de arriba.</td></tr>';
      repaintMuestreoTable();
      return;
    }

    const rowBg    = { procesable: '#f0fdf4', rechazo: '#fef2f2', defecto: '#fff7ed' };
    const dotColor = { procesable: '#0f766e', rechazo: '#dc2626', defecto: '#2563eb' };
    const canRemoveOf = (type) => CFG.find(c => c.type === type)?.canRemove ?? true;

    editor.innerHTML = selected.map(cat => {
      const bg    = rowBg[cat.type]    || '#f8fafc';
      const color = dotColor[cat.type] || '#64748b';
      const raw   = n2(muCatValues[cat.key]);
      const removeBtn = canRemoveOf(cat.type)
        ? `<button type="button" data-mu-cat-remove="${cat.key}" title="Quitar"
            style="background:none;border:none;cursor:pointer;color:#cbd5e1;font-size:16px;
              padding:0 0 0 5px;line-height:1;flex-shrink:0;"
            onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'">×</button>`
        : '';
      return `<tr style="background:${bg};border-bottom:1px solid #f1f5f9;">
        <td style="padding:5px 12px;">
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;"></span>
            <span style="font-size:13px;color:#1e293b;">${cat.label}</span>
            ${removeBtn}
          </span>
        </td>
        <td style="padding:5px 12px;text-align:right;">
          <input class="am-input" type="number" min="0" max="999999" step="0.01" inputmode="decimal"
            data-mu-cat="${cat.key}" value="${raw > 0 ? String(raw) : ''}" placeholder="0.00"
            style="width:110px;text-align:right;padding:3px 10px;height:30px;font-size:13px;">
        </td>
        <td style="padding:5px 12px;text-align:right;font-weight:600;color:#475569;font-size:13px;"
          data-mu-pct="${cat.key}">0.00 %</td>
      </tr>`;
    }).join('');

    editor.querySelectorAll('[data-mu-cat]').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.getAttribute('data-mu-cat');
        if (key) muCatValues[key] = n2(input.value);
        repaintMuestreoTable();
        markDirty();
      });
    });

    editor.querySelectorAll('[data-mu-cat-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-mu-cat-remove');
        if (!key) return;
        selectedMuestreoCats.delete(key);
        muCatValues[key] = 0;
        markDirty();
        renderMuestreoCategorias();
      });
    });

    repaintMuestreoTable();
  }

  function getPeriodCut(period) {
    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'week') {
      const day = startDay.getDay();
      const sunday = new Date(startDay);
      sunday.setDate(startDay.getDate() - day);
      return sunday;
    }
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'year') return new Date(now.getFullYear(), 0, 1);
    return null;
  }

  function filterMuestreosForResumen() {
    const q = normalizeText(document.getElementById('muResumenBuscar')?.value || '');
    const period = document.getElementById('muResumenPeriodo')?.value || 'all';
    const cut = getPeriodCut(period);
    return muestreosCache.filter((x) => {
      if (q) {
        const hs = normalizeText([x.proveedor, x.centro, x.linea].join(' '));
        if (!hs.includes(q)) return false;
      }
      if (cut && x.fecha) {
        const d = new Date(x.fecha);
        if (Number.isNaN(d.getTime()) || d < cut) return false;
      }
      return true;
    });
  }

  function renderMuestreoTopCats(list) {
    const el = document.getElementById('muTopCats');
    if (!el) return;
    const sums = {};
    MUESTREO_CATS.forEach((c) => { if (c.type !== 'procesable') sums[c.key] = 0; });
    list.forEach((m) => {
      Object.entries(m.cats || {}).forEach(([k, v]) => {
        if (sums[k] !== undefined) sums[k] += Number(v) || 0;
      });
    });
    const top = Object.entries(sums)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => {
        const cat = MUESTREO_CATS.find((x) => x.key === k);
        return { label: cat?.label || k, value: n2(v) };
      });
    if (!top.length || top.every((x) => x.value <= 0)) {
      el.innerHTML = '<div class="mu-topcat"><div class="title">Top categorias</div><div class="value">Sin datos</div></div>';
      return;
    }
    el.innerHTML = top.map((x) => `<div class="mu-topcat"><div class="title">${x.label}</div><div class="value">${fmtNum(x.value, 2)}</div></div>`).join('');
  }

  function generarInformePDF(m) {
    if (!m) return;
    const clasificaciones = Array.isArray(m.clasificaciones) ? m.clasificaciones : [];
    const evaluacion      = Array.isArray(m.evaluacion)      ? m.evaluacion      : [];
    const primary   = clasificaciones[0];
    const rend      = Number(m.rendimiento) || 0;
    const uxkg      = Number(m.uxkg)        || 0;
    const total     = Number(m.total)       || 0;
    const procesable= Number(m.procesable)  || 0;
    const rechazos  = Number(m.rechazos)    || 0;
    const pctProc   = fmtNum(total > 0 ? (procesable / total) * 100 : 0, 1);
    const pctRech   = fmtNum(total > 0 ? (rechazos   / total) * 100 : 0, 1);
    const fecha     = m.fecha || new Date().toISOString().slice(0, 10);

    // Texto de recomendación automático
    let recomendacion = '';
    if (primary) {
      recomendacion = `La materia prima muestreada <strong>califica como ${primary.nombre}</strong>${primary.tipoPrincipal ? ` (tipo: ${primary.tipoPrincipal})` : ''}. Los indicadores R%: <strong>${fmtNum(rend, 2)}%</strong> y calibre <strong>${fmtNum(uxkg, 0)} un/kg</strong> se encuentran dentro de los rangos requeridos.`;
    } else {
      const fallosPrincipales = evaluacion.filter(e => !e.cumple);
      const detallesFallos = fallosPrincipales.length
        ? `<ul style="margin:8px 0 0 18px;font-size:13px;color:#7f1d1d;">${fallosPrincipales.map(e => `<li><strong>${e.nombre}</strong>: ${e.razon || 'No cumple los parámetros requeridos'}</li>`).join('')}</ul>`
        : '';
      recomendacion = `La materia prima muestreada <strong>no clasifica en ninguna categoría</strong> según los parámetros actuales del maestro.${detallesFallos}<br><br>Se recomienda hacer seguimiento para determinar si los indicadores mejoran con el tiempo (maduración de calibre o mejora de rendimiento) antes de programar cosecha.`;
    }

    const evalHTML = evaluacion.length ? evaluacion.map(ev => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div style="width:22px;height:22px;border-radius:50%;background:${ev.cumple ? '#22c55e' : '#ef4444'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:1px;">${ev.cumple ? '✓' : '✗'}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;">${ev.nombre}</div>
          ${ev.razon ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${ev.razon}</div>` : ''}
        </div>
      </div>`).join('') : '<div style="color:#94a3b8;font-size:13px;">Sin criterios configurados.</div>';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Muestreo — ${m.proveedorNombre || m.proveedor || ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;padding:32px;font-size:14px;line-height:1.5}
  h1{font-size:22px;font-weight:800;color:#0f766e;margin-bottom:4px}
  .sub{font-size:13px;color:#64748b;margin-bottom:28px}
  .section{margin-bottom:22px}
  .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#475569;letter-spacing:.06em;margin-bottom:10px;padding-bottom:5px;border-bottom:1.5px solid #e2e8f0}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:4px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center}
  .kpi-label{font-size:11px;color:#64748b;margin-bottom:4px}
  .kpi-val{font-size:22px;font-weight:800;color:#0f766e}
  .clas-box{border:2px solid #16a34a;border-radius:10px;padding:16px;text-align:center;background:#f0fdf4}
  .clas-box.fail{border-color:#ef4444;background:#fef2f2}
  .clas-label{font-size:11px;font-weight:700;text-transform:uppercase;color:#475569}
  .clas-val{font-size:26px;font-weight:800;color:#16a34a;margin-top:4px}
  .clas-val.fail{color:#ef4444}
  .rec-box{background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.7}
  .footer{margin-top:32px;font-size:11px;color:#94a3b8;text-align:right;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:16px}.no-print{display:none}}
</style>
</head>
<body>
  <div class="no-print" style="background:#0f766e;color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-weight:700;">Informe de Muestreo MMPP — Vista preliminar</span>
    <button onclick="window.print()" style="background:#fff;color:#0f766e;border:none;padding:6px 16px;border-radius:6px;font-weight:700;cursor:pointer;">Imprimir / Guardar PDF</button>
  </div>
  <h1>Informe de Muestreo MMPP</h1>
  <div class="sub">${m.proveedorNombre || m.proveedor || '—'} &nbsp;·&nbsp; Centro: ${m.centro || m.centroCodigo || '—'} &nbsp;·&nbsp; Línea: ${m.linea || '—'} &nbsp;·&nbsp; Fecha: ${fecha} &nbsp;·&nbsp; Responsable: ${m.responsable || m.responsablePG || '—'}</div>
  <div class="section">
    <div class="sec-title">Indicadores del Muestreo</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">R% Carne</div><div class="kpi-val">${fmtNum(rend, 2)}%</div></div>
      <div class="kpi"><div class="kpi-label">U × Kg (Calibre)</div><div class="kpi-val">${fmtNum(uxkg, 0)}</div></div>
      <div class="kpi"><div class="kpi-label">Procesable</div><div class="kpi-val">${pctProc}%</div></div>
      <div class="kpi"><div class="kpi-label">Rechazo</div><div class="kpi-val">${pctRech}%</div></div>
    </div>
  </div>
  <div class="section">
    <div class="sec-title">Clasificación</div>
    <div class="clas-box ${primary ? '' : 'fail'}">
      <div class="clas-label">Tipo de producto</div>
      <div class="clas-val ${primary ? '' : 'fail'}">${primary ? primary.nombre : 'S/C — No clasifica'}</div>
      ${primary?.tipoPrincipal ? `<div style="font-size:13px;color:#64748b;margin-top:4px;">${primary.tipoPrincipal}</div>` : ''}
    </div>
  </div>
  <div class="section">
    <div class="sec-title">Evaluación por Criterio (Parámetros Maestro)</div>
    ${evalHTML}
  </div>
  <div class="section">
    <div class="sec-title">Recomendación</div>
    <div class="rec-box">${recomendacion}</div>
  </div>
  <div class="footer">Generado el ${new Date().toLocaleDateString('es-CL')} · Sistema MMPP Abastecimiento</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=860,height=960');
    if (!win) { toast('Habilita ventanas emergentes para generar el informe', { variant: 'warning' }); return; }
    win.document.write(html);
    win.document.close();
  }

  async function renderMuestreoResumen({ compact = false } = {}) {
    try {
      await loadMuestreosRemote(false);
    } catch (err) {
      console.error('[muestreo] no se pudo cargar desde API', err);
      toast('No se pudieron cargar muestreos desde servidor.', { variant: 'error' });
      muestreosCache = [];
      remoteTs = Date.now();
      remoteScopeKey = getScopeKey(summaryScope);
      remoteLoaded = true;
    }

    const list = filterMuestreosForResumen();
    const derivados = (compact || summaryScope) ? [] : await refreshDerivadosMuestreo();
    const body = document.getElementById('muResumenBody');
    if (!body) return;

    // En modo compact: ajusta encabezado — sin columna Proveedor
    const thead = body.closest('table')?.querySelector('thead tr');
    if (thead) {
      thead.innerHTML = compact
        ? '<th>Fecha</th><th>Centro</th><th>Línea</th><th>R%</th><th>U×Kg</th><th>Procesable</th><th>Rechazos</th><th>Tipo</th>'
        : '<th>Fecha</th><th>Proveedor</th><th>Centro</th><th>Línea</th><th>R%</th><th>U×Kg</th><th>Procesable</th><th>Rechazos</th><th>Tipo</th>';
    }

    // En modo compact: muestra solo los 5 más recientes (ya vienen ordenados newest-first)
    const displayList = compact ? list.slice(0, 5) : list;

    if (!displayList.length && !derivados.length) {
      body.innerHTML = `<tr><td colspan="${compact ? 8 : 9}" class="muted">Sin muestreos registrados.</td></tr>`;
    } else {
      const rowsDer = derivados.map((x) => `
        <tr class="mu-row-derivado">
          <td>${x.fecha || '-'}</td>
          <td>${x.proveedor || '-'} <span class="mu-chip mu-chip-ok">${detectDerivadoStage(x.rawPaso, x.rawResumen)}</span></td>
          <td>${x.centro || '-'}</td>
          <td>${x.linea || '-'}</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td><button type="button" class="dash-btn mu-start-btn" data-mu-start="${x.id}" data-mu-route="${detectDerivadoRoute(x.rawPaso, x.rawResumen)}">Iniciar muestreo</button></td>
          <td>-</td>
        </tr>
      `).join('');
      const rowsDone = displayList.slice().reverse().map((x) => {
        const clasif = Array.isArray(x.clasificaciones) ? x.clasificaciones : [];
        const primClasif = clasif[0];
        const tipoBadge = primClasif
          ? `<span style="background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0;border-radius:20px;padding:1px 8px;font-size:11px;font-weight:700;white-space:nowrap;">${primClasif.nombre}</span>`
          : `<span style="background:#fee2e2;color:#ef4444;border:1px solid #fecaca;border-radius:20px;padding:1px 8px;font-size:11px;white-space:nowrap;">S/C</span>`;
        return `<tr>
          <td>${x.fecha || '-'}</td>
          ${compact ? '' : `<td>${x.proveedor || '-'}</td>`}
          <td>${x.centro || '-'}</td>
          <td>${x.linea || '-'}</td>
          <td>${fmtNum(x.rendimiento, 1)} %</td>
          <td>${fmtNum(x.uxkg, 0)}</td>
          <td>${fmtNum(x.total > 0 ? (x.procesable / x.total) * 100 : 0, 1)} %</td>
          <td>${fmtNum(x.total > 0 ? (x.rechazos / x.total) * 100 : 0, 1)} %</td>
          <td>${tipoBadge}</td>
        </tr>`;
      }).join('');
      body.innerHTML = rowsDer + rowsDone;
    }

    // KPIs calculados sobre el historial completo del proveedor (no solo los 5 mostrados)
    const count = list.length;
    const avg = (fn) => count ? list.reduce((a, b) => a + (fn(b) || 0), 0) / count : 0;
    const totalM = list.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const totalR = list.reduce((a, b) => a + (Number(b.rechazos) || 0), 0);

    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    set('muKpiCount', String(count));
    set('muKpiRend', `${fmtNum(avg((x) => Number(x.rendimiento)), 1)} %`);
    set('muKpiUxKg', fmtNum(avg((x) => Number(x.uxkg)), 0));
    set('muKpiRech', `${fmtNum(totalM > 0 ? (totalR / totalM) * 100 : 0, 1)} %`);
    if (!compact) renderMuestreoTopCats(list);
  }

  function setMuestreoView(mode = 'form') {
    const form = document.getElementById('muestreoFormView');
    const sum = document.getElementById('muestreoSummaryView');
    const bForm = document.getElementById('btnMuestreoViewForm');
    const bSum = document.getElementById('btnMuestreoViewSummary');
    const isForm = mode === 'form';
    form?.classList.toggle('muestreo-hidden', !isForm);
    sum?.classList.toggle('muestreo-hidden', isForm);
    bForm?.classList.toggle('is-active', isForm);
    bSum?.classList.toggle('is-active', !isForm);
    if (bForm) { bForm.style.background = isForm ? '#fff' : 'transparent'; bForm.style.color = isForm ? '#0f766e' : '#64748b'; bForm.style.boxShadow = isForm ? '0 1px 3px rgba(0,0,0,.1)' : 'none'; }
    if (bSum)  { bSum.style.background  = !isForm ? '#fff' : 'transparent'; bSum.style.color  = !isForm ? '#0f766e' : '#64748b'; bSum.style.boxShadow  = !isForm ? '0 1px 3px rgba(0,0,0,.1)' : 'none'; }

    const stepsIndicator = document.getElementById('muStepsIndicator');
    if (stepsIndicator) stepsIndicator.style.display = isForm ? 'flex' : 'none';

    if (!isForm) {
      ['muNavStep1', 'muNavStep2', 'muNavStep3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      const navHistorial = document.getElementById('muNavHistorial');
      if (navHistorial) navHistorial.style.display = 'flex';

      const isEdit = muestreoMode === 'edit';
      const filterRow = document.getElementById('muHistorialFilterRow');
      const headerEl  = document.getElementById('muHistorialHeader');
      const headerTxt = document.getElementById('muHistorialHeaderText');
      const topCats   = document.getElementById('muTopCats');

      if (filterRow) filterRow.style.display = isEdit ? 'none' : '';
      if (topCats)   topCats.style.display   = isEdit ? 'none' : '';
      if (headerEl) {
        headerEl.style.display = isEdit ? 'flex' : 'none';
        if (isEdit && headerTxt) {
          const prov = document.getElementById('muestreoProveedor')?.value?.trim() || '';
          headerTxt.textContent = prov ? `Muestreos anteriores de ${prov}` : 'Muestreos anteriores del proveedor';
        }
      }

      loadMuestreosRemote(true)
        .then(() => renderMuestreoResumen({ compact: isEdit }))
        .catch(() => renderMuestreoResumen({ compact: isEdit }).catch(() => {}));
    } else {
      setMuestreoStep(muestreoStep);
    }
  }

  function detectDerivadoRoute(rawPaso = '', rawResumen = '') {
    const txt = normalizeText(`${rawPaso} ${rawResumen}`);
    if (txt.includes('planta')) return 'planta';
    if (txt.includes('directa') || txt.includes('procesar')) return 'directa';
    return 'terreno';
  }

  function detectDerivadoStage(rawPaso = '', rawResumen = '') {
    const txt = normalizeText(`${rawPaso} ${rawResumen}`);
    if (txt.includes('resultado')) return 'Resultado pendiente';
    if (txt.includes('planta')) return 'Enviar a planta';
    if (txt.includes('procesar') || txt.includes('directa')) return 'Recepcion directa';
    return 'Programada';
  }

  function applySeedToForm(seed = null) {
    currentSeed = seed && typeof seed === 'object' ? { ...seed } : null;
    if (!currentSeed) return;
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== null && String(value).trim() !== '') el.value = String(value);
    };

    const setNum = (id, value, digits = 2) => {
      const el = document.getElementById(id);
      const n = Number(value);
      if (!el) return;
      if (Number.isFinite(n)) {
        el.value = digits === 0 ? String(Math.round(n)) : n.toFixed(digits);
      }
    };

    set('muestreoProveedor', currentSeed.proveedor || currentSeed.proveedorNombre || '');
    // Sync hidden proveedorKey/Id fields
    const hidKey = document.getElementById('muestreoProveedorKey');
    const hidId = document.getElementById('muestreoProveedorId');
    if (hidKey) hidKey.value = currentSeed.proveedorKey || '';
    if (hidId) hidId.value = currentSeed.proveedorId || currentSeed.contactoId || '';

    // Poblar centros dinámicamente para este proveedor
    const seedCentro = currentSeed.centro || currentSeed.centroCodigo || '';
    const seedKey    = currentSeed.proveedorKey || '';
    if (seedKey) {
      // populateCentrosForProveedor estará disponible en el closure de bindUI
      // lo llamamos desde un helper global temporal
      const allCentros = window._state?.listaCentros || [];
      const centroSel  = document.getElementById('muestreoCentro');
      if (centroSel) {
        const centrosDelProv = allCentros.filter(c => (c.proveedorKey || '') === seedKey);
        centroSel.innerHTML = '<option value="">— Seleccionar centro —</option>';
        if (centrosDelProv.length) {
          centrosDelProv.forEach(c => {
            const codigo = c.codigo || c.code || c.Codigo || '';
            const nombre = c.nombre || c.name || c.proveedor || codigo;
            const label  = codigo ? `${codigo}${nombre && nombre !== codigo ? ' — ' + nombre : ''}` : nombre;
            const selOpt = (codigo && codigo === seedCentro) ? ' selected' : '';
            centroSel.innerHTML += `<option value="${codigo}"${selOpt}>${label}</option>`;
          });
          if (centrosDelProv.length === 1) centroSel.selectedIndex = 1;
        } else if (seedCentro) {
          centroSel.innerHTML += `<option value="${seedCentro}" selected>${seedCentro}</option>`;
        }
      }
    } else if (seedCentro) {
      // Sin key de proveedor: rellenar el select con el código que trae la seed
      const centroSel = document.getElementById('muestreoCentro');
      if (centroSel) {
        centroSel.innerHTML = `<option value="">— Seleccionar centro —</option><option value="${seedCentro}" selected>${seedCentro}</option>`;
      }
    }

    set('muestreoLinea', currentSeed.linea || '');
    set('muestreoFecha', currentSeed.fecha || todayIso());
    set('muestreoResponsable', currentSeed.responsable || currentSeed.responsablePG || '');
    setNum('muestreoUxKg', currentSeed.uxkg, 0);
    setNum('muestreoPesoVivo', currentSeed.pesoVivo, 2);
    setNum('muestreoPesoCocida', currentSeed.pesoCocida, 2);
    if (currentSeed.route) setMuestreoRoute(currentSeed.route);


    selectedMuestreoCats.clear();
    Object.keys(muCatValues).forEach((k) => { muCatValues[k] = 0; });

    const cats = currentSeed.cats && typeof currentSeed.cats === 'object' ? currentSeed.cats : {};
    const baseFallback = Number(currentSeed.procesable);

    MUESTREO_CATS.forEach((cat) => {
      // Intentar cargar por ID (cat.key) o por su slug (cat.slug) para compatibilidad
      const valById   = cats[cat.key];
      const valBySlug = cats[cat.slug];
      const raw = Number(valById !== undefined ? valById : valBySlug);
      
      const val = Number.isFinite(raw) ? n2(raw) : 0;
      if (cat.type === 'procesable') {
        const pVal = Number.isFinite(raw) ? val : (Number.isFinite(baseFallback) ? n2(baseFallback) : 0);
        muCatValues[cat.key] = pVal;
        if (pVal > 0) selectedMuestreoCats.add(cat.key);
      } else {
        muCatValues[cat.key] = val;
        if (val > 0) selectedMuestreoCats.add(cat.key);
      }
    });

    renderMuestreoCategorias();
    computeMuestreoRendimiento();
    repaintMuestreoTable();
    refreshMuestreoStepSummary();
  }

  function openMuestreoPanel({
    route = 'terreno',
    view = 'form',
    scope = null,
    mode = 'create'
  } = {}) {
    muestreoOpening = true;
    touchScope(scope);
    if (view === 'form') setMuestreoStep(1);
    setMuestreoRoute(route);
    setMuestreoView(view);
    const openNow = () => {
      const modal = document.getElementById('modalMuestreo');
      if (!modal) {
        muestreoOpening = false;
        document.getElementById('muestreoProveedor')?.focus();
        return;
      }
      const inst = getModalInstance(modal);
      inst?.open();
      modal.querySelector('.modal-content')?.scrollTo({ top: 0, behavior: 'auto' });
      clearMuestreoForm({ preserveMode: true });
      setMuestreoMode(mode, pendingSeed);
      setMuestreoRoute(route);
      setMuestreoView(view);
      currentSeed = null;
      const seedResponsable = pendingSeed?.responsable || pendingSeed?.responsablePG || '';
      cargarResponsablesMuestreo(seedResponsable).catch(() => {});
      applySeedToForm(pendingSeed);
      pendingSeed = null;
      resetDirty();
      setTimeout(() => document.getElementById('muestreoProveedor')?.focus(), 40);
      setTimeout(() => { muestreoOpening = false; }, 260);

    };
    requestAnimationFrame(() => setTimeout(openNow, 60));
  }

  function openMuestreoFromSeed(seed = {}, {
    route = 'terreno',
    view = 'form',
    mode = 'create'
  } = {}) {
    pendingSeed = (seed && typeof seed === 'object') ? { ...seed } : null;
    openMuestreoPanel({ route, view, scope: buildSummaryScope(pendingSeed), mode });
  }

  function clearMuestreoForm({ preserveMode = false } = {}) {
    document.getElementById('muestreoForm')?.reset();
    const f = document.getElementById('muestreoFecha');
    if (f) f.value = todayIso();
    selectedMuestreoCats.clear();
    Object.keys(muCatValues).forEach((k) => { muCatValues[k] = 0; });
    document.querySelectorAll('[data-mu-cat]').forEach((el) => { el.value = ''; });
    setMuestreoRoute('terreno');
    setMuestreoStep(1);
    renderMuestreoCategorias();
    computeMuestreoRendimiento();
    repaintMuestreoTable();
    if (!preserveMode) setMuestreoMode('create');
    resetDirty();
  }

  // ── Carga responsables desde Maestros en el select del modal ──────────────
  async function cargarResponsablesMuestreo(selectedVal = '') {
    const sel = document.getElementById('muestreoResponsable');
    if (!sel) return;
    try {
      const r = await fetch('/api/maestros?tipo=responsable&soloActivos=true');
      const json = await r.json();
      const items = json.items || [];
      sel.innerHTML = '<option value="">— Seleccionar —</option>' +
        items.map(i => `<option value="${i.nombre}" ${i.nombre === selectedVal ? 'selected' : ''}>${i.nombre}</option>`).join('');
    } catch {
      sel.innerHTML = '<option value="">— Seleccionar —</option>';
      if (selectedVal) sel.innerHTML += `<option value="${selectedVal}" selected>${selectedVal}</option>`;
    }
  }

  function bindUI() {
    if (document.body.dataset.muestreoBound === '1') return;
    document.body.dataset.muestreoBound = '1';

    touchScope(null);
    renderMuestreoCategorias();
    const fechaEl = document.getElementById('muestreoFecha');
    if (fechaEl && !fechaEl.value) fechaEl.value = todayIso();
    setMuestreoRoute('terreno');
    setMuestreoStep(1);
    computeMuestreoRendimiento();
    repaintMuestreoTable();
    setMuestreoMode('create');

    // Unidad muestreadora toggle: Abastecimiento / Calidad
    document.querySelectorAll('.mu-tipo-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-mu-route') || 'abastecimiento';
        setMuestreoRoute(route);
        markDirty();
      });
    });
    // Legacy route buttons (backwards compat)
    document.querySelectorAll('[data-mu-route]:not(.mu-tipo-btn)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-mu-route') || 'terreno';
        setMuestreoRoute(route);
        markDirty();
      });
    });

    // ── Proveedor autocomplete (event delegation sobre document para máxima robustez) ──
    document.addEventListener('input', (e) => {
      if (e.target.id !== 'muestreoProveedor') return;
      const muProvInput = e.target;
      const muProvDrop  = document.getElementById('muestreoProveedorDrop');
      const muProvKey   = document.getElementById('muestreoProveedorKey');
      const muProvId    = document.getElementById('muestreoProveedorId');

      const q = muProvInput.value.toLowerCase().trim();
      if (muProvKey) muProvKey.value = '';
      if (muProvId)  muProvId.value  = '';

      if (!q || !muProvDrop) { if (muProvDrop) muProvDrop.style.display = 'none'; return; }

      const contactos = window._contactosGuardados || [];
      const matches = contactos.filter(c =>
        (c.proveedorNombre || '').toLowerCase().includes(q) ||
        (c.proveedorKey   || '').toLowerCase().includes(q)
      ).slice(0, 8);

      if (!matches.length) { muProvDrop.style.display = 'none'; return; }

      muProvDrop.innerHTML = matches.map(c =>
        `<div class="mu-prov-item" data-id="${c._id || c.id}" data-key="${c.proveedorKey || ''}" data-nombre="${c.proveedorNombre || ''}" data-centro="${c.centroCodigo || c.centro || ''}" data-responsable="${c.responsablePG || c.responsable || ''}" style="padding:9px 14px;cursor:pointer;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${c.proveedorNombre} <small style="color:#94a3b8;">${c.proveedorKey || ''}</small></div>`
      ).join('');
      muProvDrop.style.display = 'block';
      markDirty();
    });

    // ── Helper: poblar select de Centro con los centros del proveedor ──
    function populateCentrosForProveedor(proveedorKey = '', selectedCodigo = '') {
      const centroSel = document.getElementById('muestreoCentro');
      if (!centroSel) return;

      // Buscar todos los centros del proveedor en state.listaCentros
      const allCentros = window._state?.listaCentros || [];
      // También intentamos desde el módulo de state importado globalmente
      const centrosDelProv = allCentros.filter(c => {
        const pKey = c.proveedorKey || '';
        return pKey === proveedorKey;
      });

      centroSel.innerHTML = '<option value="">— Seleccionar centro —</option>';

      if (!centrosDelProv.length && !selectedCodigo) {
        // Sin centros conocidos: dejar solo el placeholder
        return;
      }

      if (!centrosDelProv.length && selectedCodigo) {
        // Tenemos el código de la seed pero no centros => agregar como opción manual
        centroSel.innerHTML += `<option value="${selectedCodigo}" selected>${selectedCodigo}</option>`;
        return;
      }

      centrosDelProv.forEach(c => {
        const codigo = c.codigo || c.code || c.Codigo || '';
        const nombre = c.nombre || c.name || c.proveedor || codigo;
        const label  = codigo ? `${codigo}${nombre && nombre !== codigo ? ' — ' + nombre : ''}` : nombre;
        const sel    = (codigo && codigo === selectedCodigo) ? ' selected' : '';
        centroSel.innerHTML += `<option value="${codigo}"${sel}>${label}</option>`;
      });

      // Si solo hay 1 centro, seleccionarlo automáticamente
      if (centrosDelProv.length === 1 && !selectedCodigo) {
        centroSel.selectedIndex = 1;
      }
    }

    document.addEventListener('click', (e) => {
      // Selección de ítem en proveedor dropdown
      const item = e.target.closest('.mu-prov-item');
      if (item) {
        const muProvInput = document.getElementById('muestreoProveedor');
        const muProvDrop  = document.getElementById('muestreoProveedorDrop');
        const muProvKey   = document.getElementById('muestreoProveedorKey');
        const muProvId    = document.getElementById('muestreoProveedorId');
        if (muProvInput) muProvInput.value = item.dataset.nombre;
        if (muProvKey)   muProvKey.value   = item.dataset.key  || '';
        if (muProvId)    muProvId.value    = item.dataset.id   || '';

        // Poblar centros dinámicamente para este proveedor
        populateCentrosForProveedor(item.dataset.key || '', '');

        // Autofill Responsable: seleccionar option con ese valor
        const respEl = document.getElementById('muestreoResponsable');
        if (respEl && item.dataset.responsable) {
          const opt = Array.from(respEl.options).find(o => o.value === item.dataset.responsable);
          if (opt) respEl.value = item.dataset.responsable;
        }
        if (muProvDrop) muProvDrop.style.display = 'none';
        refreshMuestreoStepSummary();
        markDirty();
        return;
      }
      // Cerrar dropdown si clic fuera
      const muProvInput = document.getElementById('muestreoProveedor');
      const muProvDrop  = document.getElementById('muestreoProveedorDrop');
      if (muProvDrop && muProvInput && !muProvInput.contains(e.target) && !muProvDrop.contains(e.target)) {
        muProvDrop.style.display = 'none';
      }
    });


    document.querySelectorAll('[data-mu-step]').forEach((btn) => {
      btn.addEventListener('click', () => setMuestreoStep(Number(btn.getAttribute('data-mu-step') || '1')));
    });
    document.getElementById('muestreoPesoVivo')?.addEventListener('input', () => { computeMuestreoRendimiento(); markDirty(); });
    document.getElementById('muestreoPesoCocida')?.addEventListener('input', () => { computeMuestreoRendimiento(); markDirty(); });
    ['muestreoProveedor', 'muestreoCentro', 'muestreoLinea', 'muestreoFecha']
      .forEach((id) => document.getElementById(id)?.addEventListener('input', () => { refreshMuestreoStepSummary(); markDirty(); }));
    document.getElementById('muestreoResponsable')?.addEventListener('change', () => { refreshMuestreoStepSummary(); markDirty(); });
    document.getElementById('btnMuEditBase')?.addEventListener('click', () => setMuestreoStep(1));
    document.getElementById('btnMuToStep2')?.addEventListener('click', () => setMuestreoStep(2));
    document.getElementById('btnMuBackToStep1')?.addEventListener('click', () => setMuestreoStep(1));
    document.getElementById('btnMuToStep3')?.addEventListener('click', () => setMuestreoStep(3));
    document.getElementById('btnMuBackToStep2')?.addEventListener('click', () => setMuestreoStep(2));
    document.getElementById('btnMuestreoViewForm')?.addEventListener('click', () => setMuestreoView('form'));
    document.getElementById('btnMuestreoViewSummary')?.addEventListener('click', () => setMuestreoView('summary'));
    document.getElementById('btnMuestreoClear')?.addEventListener('click', () => clearMuestreoForm({ preserveMode: true }));


    const saveAction = async () => {
      const base = getMuestreoInputs();
      if (!base.proveedor || !base.fecha) {
        toast('Proveedor y fecha son obligatorios.', { variant: 'error' });
        return;
      }
      const rendimiento = computeMuestreoRendimiento();
      const totals = computeMuestreoTotals();
      const row = {
        id: '',
        ...base,
        visitaId: safeText(currentSeed?.visitaId || ''),
        proveedorKey: safeText(document.getElementById('muestreoProveedorKey')?.value || currentSeed?.proveedorKey || '').toLowerCase(),
        centroId: safeText(currentSeed?.centroId || ''),
        centroCodigo: safeText(currentSeed?.centroCodigo || base.centro),
        proveedorNombre: base.proveedor,
        responsablePG: base.responsable,
        rendimiento,
        total: totals.total,
        procesable: totals.procesable,
        rechazos: totals.rechazos,
        defectos: totals.defectos,
        cats: totals.cats
      };

      const rangeError = validateMuestreoRanges(row);
      if (rangeError) {
        toast(rangeError, { variant: 'error' });
        return;
      }

      const isEdit = muestreoMode === 'edit' && !!editingMuestreoId;
      const payloadSave = {
        visitaId: row.visitaId || null,
        proveedorKey: row.proveedorKey || '',
        proveedorNombre: row.proveedorNombre,
        centroId: row.centroId || null,
        centroCodigo: row.centroCodigo || '',
        centro: row.centro || '',
        linea: row.linea || '',
        fecha: row.fecha,
        origen: row.origen || 'terreno',
        responsablePG: row.responsablePG || '',
        uxkg: row.uxkg,
        pesoVivo: row.pesoVivo,
        pesoCocida: row.pesoCocida,
        rendimiento: row.rendimiento,
        total: row.total,
        procesable: row.procesable,
        rechazos: row.rechazos,
        defectos: row.defectos,
        cats: row.cats
      };

      let savedMuestreo = null;
      try {
        savedMuestreo = isEdit
          ? await updateMuestreo(editingMuestreoId, payloadSave)
          : await createMuestreo(payloadSave);
      } catch (err) {
        console.error('[muestreo] no se pudo guardar en API', err);
        toast('No se pudo guardar el muestreo en servidor.', { variant: 'error' });
        return;
      }

      invalidateRemoteCache();
      muestreosCache = [savedMuestreo, ...muestreosCache].filter((x, idx, arr) => {
        const id = String(x?.id || x?._id || '');
        if (!id) return true;
        return arr.findIndex((it) => String(it?.id || it?._id || '') === id) === idx;
      });
      window.dispatchEvent(new CustomEvent(isEdit ? 'muestreo:updated' : 'muestreo:created', {
        detail: { id: savedMuestreo?.id || editingMuestreoId || '', visitaId: row.visitaId || '' }
      }));
      if (row.visitaId) window.dispatchEvent(new CustomEvent('visita:updated', { detail: { id: row.visitaId } }));

      if (!isEdit) {
      const pasoByOrigen = {
        terreno: 'Tomar muestras',
        directa: 'Procesar y registrar muestra',
        planta: 'Enviar a planta y esperar resultados'
      };
      const prox = pasoByOrigen[row.origen] || 'Tomar muestras';
      const resumen = [
        `Origen: ${row.origen || '-'}`,
        `R%: ${fmtNum(row.rendimiento, 2)}%`,
        `U x Kg: ${fmtNum(row.uxkg, 0)}`,
        `Procesable: ${fmtNum(row.procesable, 2)}`,
        `Rechazos: ${fmtNum(row.rechazos, 2)}`,
        `Defectos: ${fmtNum(row.defectos, 2)}`
      ].join(' | ');
      const payload = normalizeInteraccionForSave({
        fecha: row.fecha,
        tipo: 'muestra',
        responsable: row.responsable || '',
        proveedorNombre: row.proveedor,
        contactoNombre: row.proveedor,
        tonsConversadas: Number(row.procesable) || 0,
        proximoPaso: prox,
        proximoPasoFecha: row.fecha,
        estado: 'pendiente',
        resumen,
        observaciones: `Muestreo ${row.linea || ''} ${row.centro || ''}`.trim()
      });

      try {
        await createInteraccion(payload);
        window.dispatchEvent(new CustomEvent('interaccion:created'));
      } catch (err) {
        console.error('[muestreo] no se pudo crear interaccion', err);
        toast('Muestreo guardado. Interacción no sincronizada.', { variant: 'warning' });
      }
      }

      // Limpieza de estados y refresco de datos en tablas
      resetDirty();
      try {
        await Promise.resolve(onSavedGestion?.());
      } catch (err) {
        console.warn('[muestreo] error en onSavedGestion callback', err);
      }
      
      // Mostrar modal de resultado con clasificación y evaluación
      if (savedMuestreo) {
        try {
          _lastSavedMuestreo = savedMuestreo;
          const clasificaciones = Array.isArray(savedMuestreo.clasificaciones) ? savedMuestreo.clasificaciones : [];
          const evaluacion      = Array.isArray(savedMuestreo.evaluacion)      ? savedMuestreo.evaluacion      : [];
          const primary = clasificaciones[0];
          const clasifico = !!primary;

          const rend      = Number(savedMuestreo.rendimiento ?? row.rendimiento) || 0;
          const uxkg      = Number(savedMuestreo.uxkg        ?? row.uxkg)        || 0;
          const total     = Number(savedMuestreo.total       ?? row.total)       || 0;
          const procesable= Number(savedMuestreo.procesable  ?? row.procesable)  || 0;
          const rechazos  = Number(savedMuestreo.rechazos    ?? row.rechazos)    || 0;

          const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = String(val ?? '-'); };
          const setHTML = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };

          // Meta línea: "Proveedor · Centro · Línea N · dd mmm yyyy"
          const prov   = savedMuestreo.proveedorNombre || savedMuestreo.proveedor || row.proveedor || '';
          const centro = savedMuestreo.centro || savedMuestreo.centroCodigo || row.centro || '';
          const linea  = savedMuestreo.linea  || row.linea  || '';
          const fecha  = (savedMuestreo.fecha || row.fecha || '').slice(0, 10);
          const metaParts = [prov, centro ? `Centro ${centro}` : '', linea ? `Línea ${linea}` : '', fecha].filter(Boolean);
          set('muResMeta', metaParts.join(' · '));

          // KPIs
          set('muResRend',    `${fmtNum(rend, 2)} %`);
          set('muResUxKg',    fmtNum(uxkg, 0));
          set('muResPctProc', `${fmtNum(total > 0 ? (procesable / total) * 100 : 0, 1)} %`);
          set('muResPctRech', `${fmtNum(total > 0 ? (rechazos   / total) * 100 : 0, 1)} %`);

          // Caja de clasificación — verde si clasificó, rojo si no
          const clasBox  = document.getElementById('muResClasBox');
          const iconWrap = document.getElementById('muResIconWrap');
          const icon     = document.getElementById('muResIcon');
          if (clasifico) {
            if (clasBox)  { clasBox.style.borderColor = '#bbf7d0'; clasBox.style.background = '#f0fdf4'; }
            if (iconWrap) { iconWrap.style.background = '#dcfce7'; }
            if (icon)     { icon.textContent = '✓'; icon.style.color = '#16a34a'; }
            setHTML('muResClas', `<span style="color:#0f766e;">${primary.nombre}</span>`);
            set('muResTipo', primary.tipoPrincipal ? `Tipo: ${primary.tipoPrincipal}` : '');
          } else {
            if (clasBox)  { clasBox.style.borderColor = '#fecaca'; clasBox.style.background = '#fef2f2'; }
            if (iconWrap) { iconWrap.style.background = '#fee2e2'; }
            if (icon)     { icon.textContent = '✗'; icon.style.color = '#ef4444'; }
            setHTML('muResClas', `<span style="color:#dc2626;font-size:28px;">No clasifica</span>`);
            set('muResTipo', 'S/C — Revisar criterios abajo');
          }

          // Criterios de evaluación
          const evalEl = document.getElementById('muResListaEvaluacion');
          if (evalEl) {
            if (evaluacion.length) {
              // Primero los que fallan, luego los que cumplen
              const sorted = [...evaluacion].sort((a, b) => Number(b.cumple ?? 1) - Number(a.cumple ?? 1));
              // Invertido: fallos primero
              const fails = sorted.filter(e => !e.cumple);
              const oks   = sorted.filter(e =>  e.cumple);
              const renderEv = (ev) => {
                const ok = ev.cumple;
                return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:8px;background:${ok ? '#f0fdf4' : '#fef2f2'};border:1px solid ${ok ? '#bbf7d0' : '#fecaca'};">
                  <span style="width:20px;height:20px;border-radius:50%;background:${ok ? '#22c55e' : '#ef4444'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-top:1px;">${ok ? '✓' : '✗'}</span>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:700;color:${ok ? '#14532d' : '#7f1d1d'};">${ev.nombre}</div>
                    ${ev.razon ? `<div style="font-size:12px;color:${ok ? '#15803d' : '#b91c1c'};margin-top:2px;">${ev.razon}</div>` : ''}
                  </div>
                </div>`;
              };
              evalEl.innerHTML = [...fails, ...oks].map(renderEv).join('');
            } else {
              evalEl.innerHTML = '<div style="font-size:13px;color:#94a3b8;padding:8px 0;">Sin criterios configurados en maestros.</div>';
            }
          }

          // Cerrar formulario primero para evitar overlay apilado
          getModalInstance('modalMuestreo')?.close();
          const modalEl = document.getElementById('modalMuResultado');
          if (modalEl) getModalInstance(modalEl)?.open();
        } catch (e) {
          console.error('[muestreo] error abriendo modal resultado', e);
          toast('Muestreo guardado.', { variant: 'success' });
        }
      } else {
        toast(isEdit ? 'Muestreo actualizado.' : 'Muestreo guardado.', { variant: 'success' });
      }

      // Refresca caché en background para que el historial esté listo si el usuario lo abre
      renderMuestreoResumen().catch(() => {});
    };

    const handleSave = async (e) => {
      e.preventDefault();
      await saveAction();
    };

    document.getElementById('btnMuestreoSave')?.addEventListener('click', handleSave);
    document.getElementById('btnMuestreoSaveSide')?.addEventListener('click', handleSave);
    document.getElementById('btnMuInformePDF')?.addEventListener('click', () => generarInformePDF(_lastSavedMuestreo));

    document.getElementById('btnMuestreoCloseMain')?.addEventListener('click', (e) => {
      e.preventDefault();
      getModalInstance('modalMuestreo')?.close();
      resetDirty();
    });

    document.getElementById('btnMuestreoCloseSide')?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (muDirty) {
        const ok = await askConfirm('Cerrar panel lateral', 'Estas seguro que deseas cerrar el panel lateral?', 'Si, cerrar');
        if (!ok) return;
      }
    });
    if (document.body.dataset.muEscBound !== '1') {
      document.body.dataset.muEscBound = '1';
      document.addEventListener('keydown', async (e) => {
        if (e.key !== 'Escape') return;
        if (!isAnyModalOpen('modalMuestreo')) return;
        if (isAnyModalOpen('modalMuestreoConfirm')) return;
        e.preventDefault();
        e.stopPropagation();
        if (muDirty) {
          const ok = await askConfirm('Cancelar muestreo', 'Estas seguro que deseas cerrar/cancelar? Se perderan cambios no guardados.', 'Si, cerrar');
          if (!ok) return;
        }
        getModalInstance('modalMuestreo')?.close();
        resetDirty();
      }, true);
    }
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mu-start]');
      if (!btn) return;
      const id = btn.getAttribute('data-mu-start') || '';
      const route = btn.getAttribute('data-mu-route') || 'terreno';
      const hit = (muestreosDerivados || []).find((x) => x.id === id);
      pendingSeed = hit ? {
        proveedor: hit.proveedor,
        centro: hit.centro,
        fecha: hit.fecha || todayIso(),
        route: route || hit.route || 'terreno'
      } : null;
      openMuestreoPanel({
        route: pendingSeed?.route || route,
        view: 'form',
        scope: buildSummaryScope(pendingSeed)
      });
    });
    // Cierra dropdowns de grupos al hacer clic fuera
    document.addEventListener('click', () => {
      document.querySelectorAll('[id^="muGroupDrop-"]').forEach(d => { d.style.display = 'none'; });
    });

    document.getElementById('muResumenBuscar')?.addEventListener('input', () => { renderMuestreoResumen().catch(() => {}); });
    document.getElementById('muResumenPeriodo')?.addEventListener('change', () => { renderMuestreoResumen().catch(() => {}); });
    window.addEventListener('interaccion:created', () => {
      derivadosTs = 0;
      renderMuestreoResumen().catch(() => {});
    });
    window.addEventListener('muestreo:created', () => {
      invalidateRemoteCache();
      renderMuestreoResumen().catch(() => {});
    });
    window.addEventListener('muestreo:updated', () => {
      invalidateRemoteCache();
      renderMuestreoResumen().catch(() => {});
    });
  }

  return {
    bindUI,
    openPanel: openMuestreoPanel,
    openFromSeed: openMuestreoFromSeed,
    scheduleLayout: () => {},
    isOpening: () => muestreoOpening
  };
}
