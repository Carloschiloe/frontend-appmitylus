// /js/abastecimiento/contactos/gestion-board.js
export function createGestionBoardModule({
  state,
  normalizeText,
  toDateSafe,
  fmtDateShort,
  startOfToday,
  endOfToday,
  plusDays,
  debounce,
  isVisitaPendiente,
  listInteracciones,
  openInteraccionModal,
  abrirDetalleContacto,
  activateTab,
  refreshConsultaFilterStates
}) {
  let interaccionesCache = [];
  const gestionDismissed = new Set();
  let gestionBoardFocus = 'all';
  let gestionMuestraStage = 'all';
  const gestionFilters = {
    responsable: '',
    fuente: '',
    search: ''
  };

  function loadDismissed() {
    // Persistencia local deshabilitada: estado en memoria del cliente.
  }

  function saveDismissed() {
    // Persistencia local deshabilitada: estado en memoria del cliente.
  }

  function applyGestionFilters(items) {
    const q = normalizeText(gestionFilters.search);
    return items.filter((it) => {
      if (gestionFilters.responsable && (it.responsable || '') !== gestionFilters.responsable) return false;
      if (gestionFilters.fuente && (it.source || '') !== gestionFilters.fuente) return false;
      if (!q) return true;
      const haystack = normalizeText([it.proveedor, it.contacto, it.paso, it.responsable].join(' '));
      return haystack.includes(q);
    });
  }

  function detectMuestraEstado(it = {}) {
    const base = normalizeText([it.paso, it.rawEstado, it.rawProximoPaso, it.rawResumen].join(' '));
    if (!base) return '';
    if (base.includes('resultado') && (base.includes('muestra') || base.includes('analisis') || base.includes('analis'))) {
      return 'resultado recibido';
    }
    if (base.includes('analisis') || base.includes('analis')) return 'en analisis';
    if (base.includes('planta') || base.includes('enviar a planta')) return 'enviada planta';
    if (base.includes('muestra') || it.rawEnAgua === true) return 'recibida';
    return '';
  }

  function isMuestraItem(it = {}) {
    return !!detectMuestraEstado(it);
  }

  function isMuestraStageMatch(it = {}) {
    if (gestionMuestraStage === 'all') return true;
    const est = detectMuestraEstado(it);
    return est === gestionMuestraStage;
  }

  function syncGestionResponsablesOptions(items) {
    const sel = document.getElementById('gestionFltResponsable');
    if (!sel) return;
    const current = sel.value || '';
    const values = [...new Set(items.map((x) => String(x.responsable || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'es'));
    const head = '<option value="">Todos los responsables</option>';
    const opts = values.map((v) => `<option value="${v.replace(/"/g, '&quot;')}">${v}</option>`).join('');
    sel.innerHTML = head + opts;
    if (current && values.includes(current)) sel.value = current;
  }

  function collectGestionItems() {
    const contactos = (state.contactosGuardados || []).map((c) => ({
      source: 'contacto',
      id: String(c._id || ''),
      proveedor: c.proveedorNombre || '-',
      contacto: c.contactoNombre || c.contacto || '',
      paso: c.proximoPaso || 'Sin accion',
      fechaProximo: toDateSafe(c.proximoPasoFecha),
      responsable: c.responsablePG || c.responsable || c.contactoResponsable || '',
      rawEstado: c.estado || '',
      rawProximoPaso: c.proximoPaso || '',
      rawResumen: c.observaciones || '',
      rawEnAgua: false
    }));

    const interacciones = (interaccionesCache || []).map((r) => ({
      source: 'interaccion',
      id: String(r._id || r.id || ''),
      proveedor: r.proveedorNombre || '-',
      contacto: r.contactoNombre || '',
      paso: r.proximoPaso || r.tipo || 'Interaccion',
      fechaProximo: toDateSafe(r.fechaProximo || r.proximoPasoFecha || r.fecha),
      responsable: r.responsablePG || r.responsable || '',
      rawEstado: r.estado || '',
      rawProximoPaso: r.proximoPaso || '',
      rawResumen: r.resumen || '',
      rawEnAgua: false
    }));

    const visitas = (state.visitasGuardadas || []).map((v) => ({
      source: 'visita',
      id: String(v._id || v.id || ''),
      proveedor: v.proveedorNombre || '-',
      contacto: v.contacto || '',
      paso: v.estado || 'Visita',
      fechaProximo: toDateSafe(v.proximoPasoFecha),
      responsable: v.responsable || '',
      rawEstado: v.estado || '',
      rawProximoPaso: v.estado || '',
      rawResumen: v.observaciones || '',
      rawEnAgua: String(v.enAgua || '').toLowerCase().startsWith('s')
    }));

    return [...contactos, ...interacciones, ...visitas].filter((it) => !gestionDismissed.has(`${it.source}:${it.id}`));
  }

  function itemHtml(it, laneType = '') {
    const title = `${it.paso || 'Gestion'} - ${it.proveedor || '-'}`;
    const sub = [it.contacto || '', it.responsable ? `Resp: ${it.responsable}` : ''].filter(Boolean).join(' | ');
    const muestraEstado = detectMuestraEstado(it);
    const sourceLabel = it.source === 'visita' ? 'Visita' : (it.source === 'interaccion' ? 'Interaccion' : 'Contacto');
    const sourceClass = it.source === 'visita' ? 'src-visita' : (it.source === 'interaccion' ? 'src-interaccion' : 'src-contacto');
    const laneClass = laneType ? `is-${laneType}` : '';
    return `
      <li class="gestion-item ${laneClass}">
        <div class="gestion-item-top">
          <span class="gestion-item-title">${title}</span>
          <span class="gestion-item-date">${fmtDateShort(it.fechaProximo)}</span>
        </div>
        <div class="gestion-item-sub">${sub || 'Sin detalle'}</div>
        <div class="gestion-item-sub gestion-item-tags">
          <span class="gestion-src-chip ${sourceClass}">${sourceLabel}</span>
          ${muestraEstado ? `<span class="muestra-chip muestra-${muestraEstado.replace(/\s+/g, '-')}">Muestreo: ${muestraEstado}</span>` : ''}
        </div>
        <div class="gestion-item-actions">
          <button class="dash-btn gestion-mini" data-gestion-open="${it.source}" data-id="${it.id}">Abrir</button>
          <button class="dash-btn gestion-mini" data-gestion-dismiss="${it.source}:${it.id}">Gestionado</button>
        </div>
      </li>
    `;
  }

  function renderGestionList(elId, list, laneType = '') {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<li class="empty">Sin elementos.</li>';
      return;
    }
    el.innerHTML = list.slice(0, 15).map((it) => itemHtml(it, laneType)).join('');
  }

  function renderGestionKpis(overdue, today, next, noDate) {
    const root = document.getElementById('gestionKpis');
    if (!root) return;
    const vals = [overdue.length, today.length, next.length, noDate.length];
    root.querySelectorAll('.gestion-kpi .v').forEach((el, idx) => {
      el.textContent = String(vals[idx] ?? 0);
    });
  }

  function renderGestionSidebarBadges(overdue, today, next, visible) {
    const set = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    set('sbBadgeOverdue', `V ${overdue.length}`);
    set('sbBadgeToday', `H ${today.length}`);
    set('sbBadgeNext', String(next.length));

    let interacciones = 0;
    let visitas = 0;
    for (const it of visible) {
      if (it.source === 'interaccion') interacciones += 1;
      else if (it.source === 'visita') visitas += 1;
    }
    set('sbBadgeInteracciones', String(interacciones));
    set('sbBadgeVisitas', String(visitas));
  }

  function renderConsultaCounts() {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };

    const contactos = Array.isArray(state.contactosGuardados) ? state.contactosGuardados : [];
    const visitas = Array.isArray(state.visitasGuardadas) ? state.visitasGuardadas : [];
    const interacciones = Array.isArray(interaccionesCache) ? interaccionesCache : [];

    const empresasSet = new Set();
    const agendaSet = new Set();
    for (const c of contactos) {
      const prov = String(c.proveedorNombre || c.proveedor || '').trim();
      if (prov) empresasSet.add(prov.toLowerCase());

      const contacto = String(c.contactoNombre || c.contacto || '').trim();
      const fono = String(c.contactoTelefono || '').trim();
      const mail = String(c.contactoEmail || '').trim();
      if (contacto || fono || mail) agendaSet.add(String(c._id || `${contacto}|${fono}|${mail}`));
    }

    set('consultaCountEmpresas', empresasSet.size);
    set('consultaCountVisitas', visitas.filter(isVisitaPendiente).length);
    set('consultaCountAgenda', agendaSet.size);
    const muestreosAprox = visitas.reduce((acc, v) => {
      const count = Number(v?.muestreoCount || 0);
      if (count > 0) return acc + count;
      return v?.hasMuestreo ? acc + 1 : acc;
    }, 0);
    set('consultaCountMuestreos', muestreosAprox);
    set('consultaCountInteracciones', interacciones.length);
    set('consultaCountResumen', contactos.length + visitas.length + interacciones.length + muestreosAprox);
  }

  function applyGestionFocusView() {
    const map = {
      overdue: document.getElementById('laneWrapOverdue'),
      today: document.getElementById('laneWrapToday'),
      next: document.getElementById('laneWrapNext'),
      nodate: document.getElementById('laneWrapNoDate')
    };
    Object.values(map).forEach((el) => el?.classList.remove('is-hidden'));
    const stage = document.getElementById('gestionMuestraStage');
    if (stage) stage.classList.toggle('is-hidden', gestionBoardFocus !== 'muestras');

    if (gestionBoardFocus === 'urgent') {
      map.today?.classList.add('is-hidden');
      map.next?.classList.add('is-hidden');
      map.nodate?.classList.add('is-hidden');
    } else if (gestionBoardFocus === 'today') {
      map.overdue?.classList.add('is-hidden');
      map.next?.classList.add('is-hidden');
      map.nodate?.classList.add('is-hidden');
    } else if (gestionBoardFocus === 'next') {
      map.overdue?.classList.add('is-hidden');
      map.today?.classList.add('is-hidden');
      map.nodate?.classList.add('is-hidden');
    } else if (gestionBoardFocus === 'nodate') {
      map.overdue?.classList.add('is-hidden');
      map.today?.classList.add('is-hidden');
      map.next?.classList.add('is-hidden');
    }
  }

  function bindFilters() {
    if (document.body.dataset.gestionFiltersBound === '1') return;
    document.body.dataset.gestionFiltersBound = '1';

    const selResp = document.getElementById('gestionFltResponsable');
    const selFuente = document.getElementById('gestionFltFuente');
    const inputSearch = document.getElementById('gestionSearch');
    const btnClear = document.getElementById('gestionClearFilters');

    selResp?.addEventListener('change', () => {
      gestionFilters.responsable = selResp.value || '';
      renderBoard().catch(() => {});
    });

    selFuente?.addEventListener('change', () => {
      gestionFilters.fuente = selFuente.value || '';
      renderBoard().catch(() => {});
    });

    inputSearch?.addEventListener('input', debounce(() => {
      gestionFilters.search = inputSearch.value || '';
      renderBoard().catch(() => {});
    }, 140));

    btnClear?.addEventListener('click', () => {
      gestionFilters.responsable = '';
      gestionFilters.fuente = '';
      gestionFilters.search = '';
      if (selResp) selResp.value = '';
      if (selFuente) selFuente.value = '';
      if (inputSearch) inputSearch.value = '';
      renderBoard().catch(() => {});
    });

    document.getElementById('gestionResetDismissed')?.addEventListener('click', () => {
      gestionDismissed.clear();
      saveDismissed();
      renderBoard().catch(() => {});
    });

    document.querySelectorAll('[data-gestion-focus]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const focus = btn.getAttribute('data-gestion-focus') || 'all';
        gestionBoardFocus = focus;
        document.querySelectorAll('[data-gestion-focus]').forEach((x) => x.classList.remove('is-active'));
        btn.classList.add('is-active');
        if (focus !== 'muestras') gestionMuestraStage = 'all';
        document.querySelectorAll('[data-muestra-stage]').forEach((x) => {
          x.classList.toggle('is-active', (x.getAttribute('data-muestra-stage') || 'all') === gestionMuestraStage);
        });
        renderBoard().catch(() => {});
        applyGestionFocusView();
      });
    });

    document.querySelectorAll('[data-muestra-stage]').forEach((btn) => {
      btn.addEventListener('click', () => {
        gestionMuestraStage = btn.getAttribute('data-muestra-stage') || 'all';
        document.querySelectorAll('[data-muestra-stage]').forEach((x) => x.classList.remove('is-active'));
        btn.classList.add('is-active');
        renderBoard().catch(() => {});
        applyGestionFocusView();
      });
    });
  }

  async function renderBoard() {
    const tab = document.getElementById('tab-gestion');
    if (!tab) return;

    try {
      const from = plusDays(startOfToday(), -30).toISOString();
      const to = plusDays(startOfToday(), 60).toISOString();
      const resp = await listInteracciones({ fromProx: from, toProx: to, limit: 2000 });
      interaccionesCache = Array.isArray(resp?.items) ? resp.items : [];
    } catch {
      interaccionesCache = [];
    }

    const all = collectGestionItems();
    syncGestionResponsablesOptions(all);
    const visible = applyGestionFilters(all);
    let focused = visible;
    if (gestionBoardFocus === 'muestras') {
      focused = visible.filter((it) => isMuestraItem(it) && isMuestraStageMatch(it));
    }

    const sod = startOfToday();
    const eod = endOfToday();
    const plus7 = plusDays(eod, 7);

    const withDate = focused.filter((x) => x.fechaProximo);
    const noDate = focused.filter((x) => !x.fechaProximo);

    const overdue = withDate.filter((x) => x.fechaProximo < sod).sort((a, b) => a.fechaProximo - b.fechaProximo);
    const today = withDate.filter((x) => x.fechaProximo >= sod && x.fechaProximo <= eod).sort((a, b) => a.fechaProximo - b.fechaProximo);
    const next = withDate.filter((x) => x.fechaProximo > eod && x.fechaProximo <= plus7).sort((a, b) => a.fechaProximo - b.fechaProximo);

    renderGestionKpis(overdue, today, next, noDate);
    renderGestionSidebarBadges(overdue, today, next, focused);
    renderConsultaCounts();
    renderGestionList('gestionLaneOverdue', overdue, 'overdue');
    renderGestionList('gestionLaneToday', today, 'today');
    renderGestionList('gestionLaneNext', next, 'next');
    renderGestionList('gestionLaneNoDate', noDate, 'nodate');
    refreshConsultaFilterStates();
    applyGestionFocusView();
  }

  function bindBoardEvents() {
    if (document.body.dataset.gestionBoardBound === '1') return;
    document.body.dataset.gestionBoardBound = '1';

    document.addEventListener('click', (e) => {
      const dismissBtn = e.target.closest('[data-gestion-dismiss]');
      if (dismissBtn) {
        const key = dismissBtn.getAttribute('data-gestion-dismiss');
        if (key) {
          gestionDismissed.add(key);
          saveDismissed();
          renderBoard().catch(() => {});
        }
        return;
      }

      const btn = e.target.closest('[data-gestion-open]');
      if (!btn) return;
      const source = btn.getAttribute('data-gestion-open');
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (source === 'interaccion') {
        activateTab('#tab-interacciones');
        const row = interaccionesCache.find((r) => String(r._id || r.id || '') === id);
        if (row) openInteraccionModal({ preset: row, onSaved: () => renderBoard() });
        return;
      }
      if (source === 'visita') {
        activateTab('#tab-visitas');
        window.dispatchEvent(new CustomEvent('visita:open-readonly', { detail: { id } }));
        return;
      }
      if (source === 'contacto') {
        activateTab('#tab-contactos');
        const c = (state.contactosGuardados || []).find((x) => String(x._id || '') === id);
        if (c) abrirDetalleContacto(c);
      }
    });
  }

  loadDismissed();

  return {
    bindFilters,
    bindBoardEvents,
    renderBoard
  };
}

