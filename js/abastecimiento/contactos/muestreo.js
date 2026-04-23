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
  const selectedMuestreoCats = new Set(['procesable']);
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
    const saveSide = document.getElementById('btnMuestreoSaveSide');
    const help = document.querySelector('#modalMuestreoItems .mu-side-help');
    if (saveMain) saveMain.textContent = edit ? 'Guardar cambios' : 'Guardar muestreo';
    if (saveSide) saveSide.textContent = edit ? 'Guardar cambios' : 'Guardar muestreo';
    if (help) help.innerHTML = edit
      ? 'Edita valores base del muestreo. El <strong>% se calcula automáticamente</strong> y no se puede editar.'
      : 'Ingresa valores base por item. El <strong>% se calcula automáticamente</strong> y no se puede editar.';
  }

  function syncMuestreoSideModal() {
    const sideInst = getModalInstance('modalMuestreoItems', { opacity: 0, dismissible: false });
    if (!sideInst) return;
    if (shouldShowMuestreoSide()) {
      sideInst.open();
      const side = document.getElementById('modalMuestreoItems');
      const sideContent = side?.querySelector('.modal-content');
      if (sideContent) sideContent.scrollTop = 0;
    } else {
      sideInst.close();
    }
  }

  function syncMuestreoDualLayout() {
    const main = document.getElementById('modalMuestreo');
    const side = document.getElementById('modalMuestreoItems');
    if (!(main && side)) return;
    const mainInst = getModalInstance('modalMuestreo');
    if (!(mainInst?.isOpen || main.style.display === 'block' || main.classList.contains('open'))) return;

    const vw = Math.max(window.innerWidth || document.documentElement.clientWidth || 0, 360);
    const margin = 16;
    const gap = 2;
    const wantSide = shouldShowMuestreoSide();

    const mainSoloW = Math.min(980, Math.max(360, vw - (margin * 2)));
    const sideTargetW = Math.min(420, Math.max(320, Math.floor(vw * 0.26)));
    const minMainWithSide = 620;
    const mainWithSideW = Math.min(920, Math.max(minMainWithSide, vw - (margin * 2) - gap - sideTargetW));
    const canFitPair = wantSide && (mainWithSideW + gap + sideTargetW + margin * 2 <= vw);

    const alignedTop = '4.5%';
    main.style.top = alignedTop;
    main.style.maxHeight = '84vh';
    main.style.setProperty('transform', 'none', 'important');
    main.style.setProperty('right', 'auto', 'important');
    main.style.setProperty('margin', '0', 'important');
    side.style.top = alignedTop;
    side.style.maxHeight = '84vh';
    side.style.setProperty('transform', 'none', 'important');
    side.style.setProperty('right', 'auto', 'important');
    side.style.setProperty('margin', '0', 'important');

    if (canFitPair) {
      const leftAnchorDesktop = 290;
      const maxMainLeftAllowed = Math.max(margin, vw - margin - sideTargetW - gap - mainWithSideW);
      const fittedMainLeft = Math.min(maxMainLeftAllowed, Math.max(margin, leftAnchorDesktop));
      const sideLeft = fittedMainLeft + mainWithSideW + gap;

      side.style.setProperty('width', `${sideTargetW}px`, 'important');
      side.style.setProperty('max-width', `${sideTargetW}px`, 'important');
      side.style.setProperty('left', `${sideLeft}px`, 'important');
      main.style.setProperty('width', `${mainWithSideW}px`, 'important');
      main.style.setProperty('max-width', `${mainWithSideW}px`, 'important');
      main.style.setProperty('left', `${fittedMainLeft}px`, 'important');
      side.dataset.layoutHidden = '0';
      document.body.classList.add('mu-layout-active');
      document.body.style.setProperty('--mu-modal-top', alignedTop);
      document.body.style.setProperty('--mu-main-left', `${fittedMainLeft}px`);
      document.body.style.setProperty('--mu-main-width', `${mainWithSideW}px`);
      document.body.style.setProperty('--mu-side-left', `${sideLeft}px`);
      document.body.style.setProperty('--mu-side-width', `${sideTargetW}px`);
      syncMuestreoSideModal();
      return;
    }

    main.style.setProperty('width', `${mainSoloW}px`, 'important');
    main.style.setProperty('left', `${Math.floor((vw - mainSoloW) / 2)}px`, 'important');
    main.style.setProperty('max-width', `${mainSoloW}px`, 'important');
    document.body.classList.add('mu-layout-active');
    document.body.style.setProperty('--mu-modal-top', alignedTop);
    document.body.style.setProperty('--mu-main-left', `${Math.floor((vw - mainSoloW) / 2)}px`);
    document.body.style.setProperty('--mu-main-width', `${mainSoloW}px`);
    side.dataset.layoutHidden = '1';
    getModalInstance('modalMuestreoItems', { opacity: 0, dismissible: false })?.close();
  }

  function scheduleMuestreoDualLayout() {
    const reapply = () => syncMuestreoDualLayout();
    requestAnimationFrame(() => {
      reapply();
      requestAnimationFrame(reapply);
    });
    [160, 320, 520].forEach((ms) => setTimeout(reapply, ms));
  }

  function setMuestreoStep(step = 1) {
    const requested = Math.max(1, Math.min(Number(step) || 1, 3));
    muestreoStep = requested;
    document.querySelectorAll('[data-mu-step]').forEach((btn) => {
      const n = Number(btn.getAttribute('data-mu-step') || '1');
      btn.classList.toggle('is-active', n === muestreoStep);
      btn.disabled = false;
    });
    document.getElementById('muStep1')?.classList.toggle('muestreo-hidden', muestreoStep !== 1);
    document.getElementById('muStep2')?.classList.toggle('muestreo-hidden', muestreoStep !== 2);
    document.getElementById('muStep3')?.classList.toggle('muestreo-hidden', muestreoStep !== 3);
    document.getElementById('muStepSummary')?.classList.toggle('muestreo-hidden', muestreoStep === 1);
    syncMuestreoSideModal();
    scheduleMuestreoDualLayout();
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

    setCard('muTotalMuestra', totals.total, totalPct, true);
    setCard('muProcesable',   totals.procesable, procPct);
    setCard('muRechazos',     totals.rechazos, rechPct);
    setCard('muDefectos',     totals.defectos, defectPct);
  }

  function renderMuestreoCategorias() {
    const editor = document.getElementById('muCatEditorList');
    const selector = document.getElementById('muCatSelector');
    if (!editor || !selector) return;

    selector.innerHTML = MUESTREO_CATS.map((cat) => {
      const active = selectedMuestreoCats.has(cat.key) ? ' is-active' : '';
      return `<button type="button" class="mu-cat-chip${active}" data-mu-cat-toggle="${cat.key}">${cat.label}</button>`;
    }).join('');
    selector.querySelectorAll('[data-mu-cat-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-mu-cat-toggle');
        if (!key || key === 'procesable') return;
        if (selectedMuestreoCats.has(key)) selectedMuestreoCats.delete(key);
        else selectedMuestreoCats.add(key);
        markDirty();
        renderMuestreoCategorias();
      });
    });

    const selected = MUESTREO_CATS.filter((cat) => selectedMuestreoCats.has(cat.key));
    if (!selected.length) {
      editor.innerHTML = '<div class="muted">Selecciona una categoria para comenzar.</div>';
      repaintMuestreoTable();
      return;
    }

    editor.innerHTML = selected.map((cat) => {
      const dot = (color, label) => `<span class="mu-state-dot" title="${label}" aria-label="${label}" style="background:${color};width:14px;height:14px;border-radius:50%;display:inline-block;border:2px solid #fff;outline:1px solid #8ea6c5;box-sizing:border-box;"></span>`;
      const state = cat.type === 'procesable'
        ? dot('#0f766e', 'Procesable')
        : (cat.type === 'defecto'
          ? dot('#2563eb', 'Defecto')
          : dot('#dc2626', 'Rechazo'));
      const raw = n2(muCatValues[cat.key]);
      const valueTxt = raw > 0 ? String(raw) : '';
      return `
        <div class="mu-cat-editor-item">
          <div class="type">${state}</div>
          <div class="name">${cat.label}</div>
          <input class="am-input mu-cat-value" type="number" min="0" max="999999" step="0.01" inputmode="decimal" data-mu-cat="${cat.key}" value="${valueTxt}" placeholder="0.00" aria-label="${cat.label} valor base" title="Ingresa valor base">
          <div class="pct" data-mu-pct="${cat.key}">0.00 %</div>
        </div>
      `;
    }).join('');

    editor.querySelectorAll('[data-mu-cat]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.getAttribute('data-mu-cat');
        if (key) muCatValues[key] = n2(input.value);
        repaintMuestreoTable();
        markDirty();
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

  async function renderMuestreoResumen() {
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
    const derivados = summaryScope ? [] : await refreshDerivadosMuestreo();
    const body = document.getElementById('muResumenBody');
    if (!body) return;
    if (!list.length && !derivados.length) {
      body.innerHTML = '<tr><td colspan="8" class="muted">Sin muestreos registrados.</td></tr>';
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
        </tr>
      `).join('');
      const rowsDone = list.slice().reverse().map((x) => `
        <tr>
          <td>${x.fecha || '-'}</td>
          <td>${x.proveedor || '-'}</td>
          <td>${x.centro || '-'}</td>
          <td>${x.linea || '-'}</td>
          <td>${fmtNum(x.rendimiento, 2)} %</td>
          <td>${fmtNum(x.uxkg, 0)}</td>
          <td>${fmtNum(x.procesable, 2)}</td>
          <td>${fmtNum(x.rechazos, 2)}</td>
        </tr>
      `).join('');
      body.innerHTML = rowsDer + rowsDone;
    }

    const count = list.length;
    const avg = (fn) => count ? list.reduce((a, b) => a + (fn(b) || 0), 0) / count : 0;
    const totalM = list.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const totalR = list.reduce((a, b) => a + (Number(b.rechazos) || 0), 0);

    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    set('muKpiCount', String(count));
    set('muKpiRend', `${fmtNum(avg((x) => Number(x.rendimiento)), 2)} %`);
    set('muKpiUxKg', fmtNum(avg((x) => Number(x.uxkg)), 0));
    set('muKpiRech', `${fmtNum(totalM > 0 ? (totalR / totalM) * 100 : 0, 2)} %`);
    renderMuestreoTopCats(list);
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
    syncMuestreoSideModal();
    scheduleMuestreoDualLayout();
    if (!isForm) {
      loadMuestreosRemote(true)
        .then(() => renderMuestreoResumen())
        .catch(() => renderMuestreoResumen().catch(() => {}));
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
    selectedMuestreoCats.add('procesable');
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
      currentSeed = null;
      const seedResponsable = pendingSeed?.responsable || pendingSeed?.responsablePG || '';
      cargarResponsablesMuestreo(seedResponsable).catch(() => {});
      applySeedToForm(pendingSeed);
      pendingSeed = null;
      resetDirty();
      syncMuestreoSideModal();
      scheduleMuestreoDualLayout();
      setTimeout(() => document.getElementById('muestreoProveedor')?.focus(), 40);
      if (view === 'summary') renderMuestreoResumen().catch(() => {});
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
    selectedMuestreoCats.add('procesable');
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
      
      // Feedback simple
      if (savedMuestreo) {
        try {
          // Poblar modal de resultados simple
          const clasificaciones = Array.isArray(savedMuestreo.clasificaciones) ? savedMuestreo.clasificaciones : [];
          const primary = clasificaciones[0];
          const clasEl = document.getElementById('muResClas');
          if (clasEl) {
            clasEl.textContent = primary ? primary.nombre : 'S/C (No clasifica)';
            clasEl.style.color = primary ? '#0f172a' : '#dc2626';
          }
          const modalEl = document.getElementById('modalMuResultado');
          if (modalEl) getModalInstance(modalEl)?.open();
        } catch (e) {
          toast('Muestreo guardado.', { variant: 'success' });
        }
      } else {
        toast(isEdit ? 'Muestreo actualizado.' : 'Muestreo guardado.', { variant: 'success' });
      }

      setMuestreoView('summary');
      renderMuestreoResumen().catch(() => {});
    };

    const handleSave = async (e) => {
      e.preventDefault();
      await saveAction();
    };

    document.getElementById('btnMuestreoSave')?.addEventListener('click', handleSave);
    document.getElementById('btnMuestreoSaveSide')?.addEventListener('click', handleSave);

    document.getElementById('btnMuestreoCloseMain')?.addEventListener('click', (e) => {
      e.preventDefault();
      getModalInstance('modalMuestreoItems', { opacity: 0, dismissible: false })?.close();
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
      getModalInstance('modalMuestreoItems', { opacity: 0, dismissible: false })?.close();
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
        getModalInstance('modalMuestreoItems', { opacity: 0, dismissible: false })?.close();
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
    scheduleLayout: scheduleMuestreoDualLayout,
    isOpening: () => muestreoOpening
  };
}
