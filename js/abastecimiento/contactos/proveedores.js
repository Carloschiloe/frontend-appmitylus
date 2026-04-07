// /js/abastecimiento/contactos/proveedores.js
import { state, $, setVal, slug } from './state.js';
import { escapeHtml } from './ui-common.js';

const esc = escapeHtml;

const norm = (s) => String(s || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const centerIdOf = (c) => String(c?._id || c?.id || '').trim();
const centerCodeOf = (c) => String(c?.codigo || c?.code || c?.codigo_centro || c?.centroCodigo || '').trim();
const centerComunaOf = (c) => String(c?.comuna || c?.centroComuna || '').trim();
const centerHaOf = (c) => {
  const raw = c?.hectareas ?? c?.ha ?? c?.centroHectareas ?? '';
  return String(raw).trim();
};

function providerNameFromCenter(c) {
  return String(c?.proveedor || c?.proveedorNombre || c?.name || '').trim();
}

function providerKeyFromCenter(c, fallbackName = '') {
  return String(c?.proveedorKey || slug(fallbackName || providerNameFromCenter(c) || '')).trim();
}

function clearCentroHidden() {
  setVal(['centroId'], '');
  setVal(['centroCodigo'], '');
  setVal(['centroComuna'], '');
  setVal(['centroHectareas'], '');
}

function clearProveedorHidden() {
  setVal(['proveedorNombre'], '');
  setVal(['proveedorKey', 'proveedorId'], '');
}

function getProviderCatalog() {
  const providers = new Map();

  const ensureProvider = (key, name) => {
    const k = String(key || '').trim();
    const n = String(name || '').trim();
    if (!k || !n) return null;
    if (!providers.has(k)) providers.set(k, { key: k, name: n, centers: [] });
    return providers.get(k);
  };

  (state.listaCentros || []).forEach((c) => {
    const name = providerNameFromCenter(c);
    const key = providerKeyFromCenter(c, name);
    const provider = ensureProvider(key, name);
    if (!provider) return;
    provider.centers.push({
      id: centerIdOf(c),
      code: centerCodeOf(c),
      comuna: centerComunaOf(c),
      hectareas: centerHaOf(c)
    });
  });

  (state.listaProveedores || []).forEach((p) => {
    const name = String(p?.nombreOriginal || '').trim();
    const key = String(p?.proveedorKey || slug(name)).trim();
    ensureProvider(key, name);
  });

  (state.contactosGuardados || []).forEach((ct) => {
    const name = String(ct?.proveedorNombre || '').trim();
    const key = String(ct?.proveedorKey || slug(name)).trim();
    ensureProvider(key, name);
  });

  return Array.from(providers.values());
}

function scoreProviderRow(provider, qNorm, tokens) {
  const centerCodes = provider.centers.map((c) => c.code).filter(Boolean).join(' ');
  const centerComunas = provider.centers.map((c) => c.comuna).filter(Boolean).join(' ');
  const haystack = norm(`${provider.name} ${provider.key} ${centerCodes} ${centerComunas}`);
  if (!tokens.every((t) => haystack.includes(t))) return -1;

  const byName = norm(provider.name);
  let score = 20;
  if (byName.startsWith(qNorm)) score += 50;
  else if (byName.includes(qNorm)) score += 28;
  else score += 12;

  if (/^\d{3,8}$/.test(qNorm) && centerCodes.includes(qNorm)) score += 16;
  score += Math.min(provider.centers.length, 6);
  return score;
}

function scoreCenterRow(provider, center, qNorm, tokens) {
  const haystack = norm(`${center.code} ${center.comuna} ${provider.name} ${provider.key}`);
  if (!tokens.every((t) => haystack.includes(t))) return -1;

  let score = 18;
  if (center.code && center.code === qNorm) score += 80;
  else if (center.code && center.code.startsWith(qNorm)) score += 60;
  else if (center.code && center.code.includes(qNorm)) score += 40;

  const byProvider = norm(provider.name);
  if (byProvider.startsWith(qNorm)) score += 12;
  else if (byProvider.includes(qNorm)) score += 8;
  return score;
}

export function buscarCoincidenciasProveedor(query, { limit = 20 } = {}) {
  const qNorm = norm(query);
  if (!qNorm) return [];
  const tokens = qNorm.split(' ').filter(Boolean);
  if (!tokens.length) return [];

  const rows = [];
  const providers = getProviderCatalog();

  providers.forEach((provider) => {
    const providerScore = scoreProviderRow(provider, qNorm, tokens);
    if (providerScore >= 0) {
      const count = provider.centers.length;
      const sublabel = count
        ? `${count} centro${count === 1 ? '' : 's'} asociado${count === 1 ? '' : 's'}`
        : 'Sin centros asociados';
      rows.push({
        type: 'provider',
        score: providerScore,
        key: provider.key,
        name: provider.name,
        label: provider.name,
        sublabel
      });
    }

    provider.centers.forEach((center) => {
      const centerScore = scoreCenterRow(provider, center, qNorm, tokens);
      if (centerScore < 0) return;
      const codeTxt = center.code || 'Sin codigo';
      const comunaTxt = center.comuna || 's/comuna';
      rows.push({
        type: 'center',
        score: centerScore,
        key: provider.key,
        name: provider.name,
        label: `${codeTxt} - ${provider.name}`,
        sublabel: `${comunaTxt}${center.hectareas ? ` (${center.hectareas} ha)` : ''}`,
        centerId: center.id,
        centerCode: center.code,
        centerComuna: center.comuna,
        centerHectareas: center.hectareas
      });
    });
  });

  return rows
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.type !== b.type) return a.type === 'center' ? -1 : 1;
      return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
    })
    .slice(0, limit);
}

export function mostrarCentrosDeProveedor(proveedorKey, preselectCentroId = null) {
  const select = $('#selectCentro');
  if (!select) return;

  const key = String(proveedorKey || '').trim();
  const centers = (state.listaCentros || []).filter((c) => {
    const cKey = providerKeyFromCenter(c);
    return cKey === key;
  });

  let html = `<option value="" ${!preselectCentroId ? 'selected' : ''}>Sin centro (solo contacto al proveedor)</option>`;
  html += centers.map((c) => {
    const id = centerIdOf(c);
    const code = centerCodeOf(c);
    const comuna = centerComunaOf(c);
    const hect = centerHaOf(c);
    const selected = preselectCentroId && String(preselectCentroId) === String(id) ? 'selected' : '';
    return `<option ${selected} value="${esc(id)}" data-code="${esc(code)}" data-comuna="${esc(comuna)}" data-hect="${esc(hect)}">${esc(code || '-')} - ${esc(comuna || 's/comuna')} (${esc(hect || '-')} ha)</option>`;
  }).join('');

  select.innerHTML = html;
  select.disabled = false;
}

export function resetSelectCentros() {
  const select = $('#selectCentro');
  if (!select) return;
  select.innerHTML = '<option value="" selected>Sin centro (solo contacto al proveedor)</option>';
  select.disabled = true;
  clearCentroHidden();
}

function applyProviderPick(item, { syncInput = true } = {}) {
  if (!item) return false;

  const input = document.getElementById('buscadorProveedor');
  const providerName = String(item.name || '').trim();
  const providerKey = String(item.key || slug(providerName)).trim();
  const centerId = String(item.centerId || '').trim();
  const centerCode = String(item.centerCode || '').trim();
  const centerComuna = String(item.centerComuna || '').trim();
  const centerHectareas = String(item.centerHectareas || '').trim();

  if (!providerName || !providerKey) return false;
  if (syncInput && input) input.value = providerName;

  setVal(['proveedorNombre'], providerName);
  setVal(['proveedorKey', 'proveedorId'], providerKey);
  mostrarCentrosDeProveedor(providerKey, centerId || null);

  if (centerId) {
    setVal(['centroId'], centerId);
    setVal(['centroCodigo'], centerCode);
    setVal(['centroComuna'], centerComuna);
    setVal(['centroHectareas'], centerHectareas);
  } else {
    clearCentroHidden();
  }

  return true;
}

export function seleccionarCentroPorCodigo(code) {
  const target = String(code || '').trim();
  if (!/^\d{4,8}$/.test(target)) return false;

  const center = (state.listaCentros || []).find((c) => centerCodeOf(c) === target);
  if (!center) return false;

  const providerName = providerNameFromCenter(center);
  const providerKey = providerKeyFromCenter(center, providerName);
  return applyProviderPick({
    type: 'center',
    name: providerName,
    key: providerKey,
    centerId: centerIdOf(center),
    centerCode: centerCodeOf(center),
    centerComuna: centerComunaOf(center),
    centerHectareas: centerHaOf(center)
  });
}

function attachAutocomplete(inputEl, fetcher, onPick, { min = 1 } = {}) {
  const field = inputEl.closest('.input-field') || inputEl.parentNode;
  if (!field) return () => {};
  if (!field.style.position) field.style.position = 'relative';

  let box = field.querySelector('.autocomplete-menu.contacto-provider-autocomplete');
  if (!box) {
    box = document.createElement('div');
    box.className = 'autocomplete-menu contacto-provider-autocomplete';
    field.appendChild(box);
  }

  let timer = null;
  let lastQuery = '';
  let currentItems = [];

  const close = () => {
    box.innerHTML = '';
    box.style.display = 'none';
    currentItems = [];
  };

  const open = (html) => {
    box.innerHTML = html;
    box.style.display = 'block';
  };

  const renderItems = (items) => {
    if (!items.length) {
      open('<div class="autocomplete-empty">Sin resultados</div>');
      return;
    }

    const html = items.map((it, idx) => `
      <a href="#" data-idx="${idx}" class="collection-item ac-item">
        <div class="ac-title">${esc(it.label || '')}</div>
        ${it.sublabel ? `<div class="ac-sub grey-text">${esc(it.sublabel)}</div>` : ''}
      </a>`).join('');
    open(`<div class="collection">${html}</div>`);

    box.querySelectorAll('a[data-idx]').forEach((a) => {
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const idx = Number(a.getAttribute('data-idx'));
        const picked = currentItems[idx];
        close();
        onPick?.(picked);
      });
    });
  };

  const run = async (q) => {
    let items = [];
    try {
      items = await Promise.resolve(fetcher(q));
    } catch (err) {
      console.error('[proveedores] autocomplete error', err);
      open('<div class="autocomplete-empty">Error consultando sugerencias</div>');
      return;
    }
    currentItems = Array.isArray(items) ? items : [];
    renderItems(currentItems);
  };

  inputEl.addEventListener('input', () => {
    const q = String(inputEl.value || '').trim();
    if (q === lastQuery) return;
    lastQuery = q;
    if (timer) clearTimeout(timer);
    if (q.length < min) {
      close();
      return;
    }
    open('<div class="autocomplete-empty">Buscando...</div>');
    timer = setTimeout(() => run(q), 110);
  });

  inputEl.addEventListener('focus', () => {
    const q = String(inputEl.value || '').trim();
    if (q.length < min) return;
    open('<div class="autocomplete-empty">Buscando...</div>');
    run(q);
  });

  inputEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      close();
      return;
    }
    if (ev.key === 'Enter' && currentItems.length) {
      ev.preventDefault();
      const first = currentItems[0];
      close();
      onPick?.(first);
    }
  });

  document.addEventListener('click', (ev) => {
    if (ev.target === inputEl || box.contains(ev.target)) return;
    close();
  });

  return close;
}

function resolveProviderExact(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;

  const codeMatch = raw.match(/\b(\d{4,8})\b/);
  if (codeMatch && seleccionarCentroPorCodigo(codeMatch[1])) return true;

  const query = norm(raw);
  const providers = getProviderCatalog();
  const found = providers.find((p) => norm(p.name) === query);
  if (!found) return false;
  return applyProviderPick({
    type: 'provider',
    key: found.key,
    name: found.name
  });
}

function clearSelectionUI() {
  clearProveedorHidden();
  resetSelectCentros();
}

export function setupBuscadorProveedores() {
  const input = $('#buscadorProveedor');
  if (!input) return;
  if (input.dataset.providerAutocompleteBound === '1') return;
  input.dataset.providerAutocompleteBound = '1';

  attachAutocomplete(
    input,
    (q) => buscarCoincidenciasProveedor(q, { limit: 16 }),
    (picked) => applyProviderPick(picked),
    { min: 1 }
  );

  input.addEventListener('blur', () => {
    const value = String(input.value || '').trim();
    if (!value) {
      clearSelectionUI();
      return;
    }

    const fixed = resolveProviderExact(value);
    if (fixed) return;

    const selectedProvider = String($('#proveedorNombre')?.value || '').trim();
    if (!selectedProvider || norm(selectedProvider) !== norm(value)) {
      clearSelectionUI();
    }
  });
}

export function syncHiddenFromSelect(selectEl) {
  const select = selectEl || document.getElementById('selectCentro');
  if (!select) return;
  const opt = select.options[select.selectedIndex];
  setVal(['centroId'], select.value || '');
  setVal(['centroCodigo'], opt?.dataset?.code || '');
  setVal(['centroComuna'], opt?.dataset?.comuna || '');
  setVal(['centroHectareas'], opt?.dataset?.hect || '');
}
