// /js/abastecimiento/contactos/interacciones/table.js
import { list } from './api.js';
import { esContactoNuevo, esProveedorNuevoInteraccion } from './normalizers.js';
import { openInteraccionModal } from './modal.js';

export async function renderTable(container, { onChanged } = {}) {
  container.innerHTML = `
  <style id="int-table-styles">
    /* compacta tipografías y filas */
    #int-table th, #int-table td{ font-size:.85rem; line-height:1.15; }
    #int-table .c-compact{ font-size:.85rem; }
    #int-table .subline{ font-size:.75rem; color:#6b7280; margin-top:2px; } /* gris-500 */
    #int-table .strong{ font-weight:600; letter-spacing:.2px; }
    /* ocultar columna Proveedor (dejamos el dato debajo del contacto) */
    #int-table th.th-proveedor, 
    #int-table td.td-proveedor { display:none; }

    /* sub-fila expandible */
    #int-table tr.subrow { background:#f8fafc; } /* slate-50 */
    #int-table tr.subrow td { padding:10px 12px; font-size:.85rem; }
    #int-table .obs-title { font-weight:600; margin-right:6px; }
    #int-table .hide { display:none !important; }

    /* acciones compactas */
    #int-table .acts { display:flex; gap:8px; align-items:center; }
    #int-table .acts .btn-flat { padding:0 6px; min-width:auto; }
    #int-table .caret { display:inline-block; transition:transform .18s ease; vertical-align:middle; }
    #int-table tr.expanded .caret { transform:rotate(180deg); }
    #int-table .nuevo-star { font-size:14px; }
  </style>

  <div class="card"><div class="card-content">
    <div class="row" style="margin-bottom:8px">
      <!-- RESPONSABLE PG (select fijo) -->
      <div class="col s12 m3">
        <label class="grey-text text-darken-1" style="font-size:12px">Responsable PG</label>
        <select id="f-responsable" class="browser-default" aria-label="Responsable PG">
          <option value="">Todos</option>
          <option value="Claudio Alba">Claudio Alba</option>
          <option value="Patricio Alvarez">Patricio Alvarez</option>
          <option value="Carlos Avendaño">Carlos Avendaño</option>
        </select>
      </div>

      <!-- TIPO (select) -->
      <div class="col s12 m3">
        <label class="grey-text text-darken-1" style="font-size:12px">Tipo</label>
        <select id="f-tipo" class="browser-default" aria-label="Tipo">
          <option value="">Todos los tipos</option>
          <option value="llamada">Llamada</option>
          <option value="visita">Visita</option>
          <option value="muestra">Muestra</option>
          <option value="reunion">Reunión</option>
          <option value="tarea">Tarea</option>
        </select>
      </div>

      <!-- SEMANA (select autogenerado con últimas 20 semanas) -->
      <div class="col s12 m3">
        <label class="grey-text text-darken-1" style="font-size:12px">Semana</label>
        <select id="f-semana" class="browser-default" aria-label="Semana (YYYY-Www)"></select>
      </div>

      <!-- PRÓXIMO PASO (nuevo filtro) -->
      <div class="col s12 m3">
        <label class="grey-text text-darken-1" style="font-size:12px">Próx. paso</label>
        <select id="f-prox" class="browser-default" aria-label="Próximo paso">
          <option value="">Todos</option>
        </select>
      </div>

      <div class="col s12" style="display:flex;gap:12px;align-items:center;margin-top:8px">
        <label style="display:flex;align-items:center;gap:6px">
          <input type="checkbox" id="f-solo-nuevos"><span>Solo contactos NUEVOS</span>
        </label>
        <button id="btn-filtrar" class="btn">Filtrar</button>
      </div>
    </div>

    <div class="mmpp-table-wrap">
      <table id="int-table" class="striped highlight c-compact" style="width:100%">
        <thead>
          <tr>
            <th>Fecha llamada</th>
            <th>Tipo</th>
            <th>Contacto</th>
            <th class="th-proveedor">Proveedor</th>
            <th>Tons</th>
            <th>Próx. paso</th>   <!-- fecha pequeña va debajo -->
            <th>Resp.</th>        <!-- estado pequeño va debajo -->
            <th>Nuevo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </div></div>`;

  const tbody   = container.querySelector('tbody');
  const btn     = container.querySelector('#btn-filtrar');
  const fTipo   = container.querySelector('#f-tipo');
  const fResp   = container.querySelector('#f-responsable');
  const fSemana = container.querySelector('#f-semana');
  const fNuevo  = container.querySelector('#f-solo-nuevos');
  const fPaso   = container.querySelector('#f-prox');

  // ==== poblar semanas (actual y 19 anteriores) ====
  populateWeeksSelect(fSemana, 20);

  // refrescar al cambiar filtros (para no depender del botón)
  fSemana.addEventListener('change', refresh);
  fTipo.addEventListener('change', refresh);
  fResp.addEventListener('change', refresh);
  fNuevo.addEventListener('change', refresh);
  fPaso.addEventListener('change', refresh);

  // Delegación: editar y expandir
  tbody.addEventListener('click', (ev) => {
    const t = ev.target;

    // Editar
    if (t && t.classList && t.classList.contains('edit-int')) {
      const tr = t.closest('tr[data-id].main-row');
      if (!tr) return;
      const idx = Number(tr.getAttribute('data-idx') || -1);
      const row = _lastRows[idx];
      if (!row) return;
      openInteraccionModal({ preset: row, onSaved: refresh });
      return;
    }

    // Expandir/colapsar observaciones
    const toggleBtn = t.closest?.('.more-int');
    if (toggleBtn) {
      const main = toggleBtn.closest('tr.main-row');
      const sub  = main?.nextElementSibling;
      if (sub && sub.classList.contains('subrow')) {
        sub.classList.toggle('hide');
        main.classList.toggle('expanded');
      }
    }
  });

  let _lastRows = [];
  let _loading = false;

  async function refresh() {
    if (_loading) return;
    _loading = true;
    const oldTxt = btn.textContent;
    btn.textContent = 'Cargando…';
    btn.disabled = true;

    try {
      const params = {
        tipo: (fTipo.value || '').trim() || undefined,
        responsable: (fResp.value || '').trim() || undefined,
        // semana: la filtramos client-side por semanaKey
        nuevos: fNuevo.checked ? true : undefined
      };

      const semanaSel = (fSemana.value || '').trim();
      const pasoSel   = (fPaso.value   || '').trim();

      // Traemos sin semana para no depender del filtro del backend
      const resp = await list({ ...params, semana: undefined });
      const items = (resp && (resp.items || resp.data || [])) || [];

      // Filtrar por semana (cliente)
      let rows = semanaSel ? items.filter(x => x.semanaKey === semanaSel) : items;

      // Filtro: “solo nuevos”
      if (fNuevo.checked) {
        rows = rows.filter(it => esContactoNuevo(it.contactoId) || esProveedorNuevoInteraccion(it));
      }

      // Filtro: Próximo paso
      if (pasoSel) {
        const norm = (s) => String(s || '').trim().toLowerCase();
        rows = rows.filter(r => norm(r.proximoPaso) === norm(pasoSel));
      }

      // Orden por fecha desc
      rows.sort((a,b)=> (new Date(b.fecha||0)) - (new Date(a.fecha||0)));

      // Poblar opciones de Próx. paso dinámicamente (sin duplicados)
      populatePasoOptions(fPaso, rows, pasoSel);

      _lastRows = rows;

      tbody.innerHTML = rows.map((r, i) => {
        const nuevo = (esContactoNuevo(r.contactoId) || esProveedorNuevoInteraccion(r))
          ? '<span class="nuevo-star yellow" title="Proveedor nuevo">★</span>'
          : '';

        // contacto fuerte + proveedor en sublínea
        const contactoProveedor = `
          <div class="strong">${esc(r.contactoNombre || '')}</div>
          <div class="subline">${esc(r.proveedorNombre || '')}</div>
        `;

        // Próx. paso EN GRANDE + fecha chiquita debajo
        const proxPasoCell = `
          <div>${esc(r.proximoPaso || '') || '—'}</div>
          <div class="subline">${fmtD(r.fechaProximo)}</div>
        `;

        // Responsable EN GRANDE + estado chiquito debajo
        const respCell = `
          <div>${esc(r.responsablePG || '') || '—'}</div>
          <div class="subline">${esc(canonEstado(r.estado))}</div>
        `;

        // Acciones: Ver (expansión) + Editar
        const acciones = `
          <div class="acts">
            <a class="btn-flat grey-text text-darken-2 more-int" title="Ver resumen/observaciones">
              <i class="material-icons tiny caret">expand_more</i> Ver
            </a>
            <a class="btn-flat blue-text edit-int">Editar</a>
          </div>
        `;

        // Fila principal + subfila (observaciones)
        const subTexto = esc(r.resumen || r.observaciones || 'Sin observaciones registradas');
        return `
          <tr class="main-row" data-id="${esc(r._id || r.id || '')}" data-idx="${i}">
            <td>${fmtD(r.fecha)}</td>
            <td>${esc((r.tipo || '').toUpperCase())}</td>
            <td>${contactoProveedor}</td>
            <td class="td-proveedor">${esc(r.proveedorNombre || '')}</td>
            <td style="text-align:right">${fmtNum(r.tonsAcordadas)}</td>
            <td>${proxPasoCell}</td>
            <td>${respCell}</td>
            <td>${nuevo}</td>
            <td>${acciones}</td>
          </tr>
          <tr class="subrow hide">
            <td colspan="9">
              <span class="obs-title">Resumen / Observaciones:</span>
              <span>${subTexto}</span>
            </td>
          </tr>`;
      }).join('') || `<tr><td colspan="9" class="grey-text">Sin resultados.</td></tr>`;

      onChanged && onChanged(rows);
    } catch (e) {
      console.error('[int] ERROR refresh():', e);
      window.M && M.toast && M.toast({ html: 'Error al cargar interacciones', classes: 'red' });
    } finally {
      _loading = false;
      btn.textContent = oldTxt;
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', refresh);
  await refresh();
}

/* ===== Helpers ===== */
function populateWeeksSelect(selectEl, count = 20) {
  const weeks = lastNWeeks(count);
  selectEl.innerHTML = weeks.map(w => `<option value="${w}">${w}</option>`).join('');
  const curr = currentIsoWeek();
  const has = weeks.includes(curr);
  selectEl.value = has ? curr : weeks[0];
}

function populatePasoOptions(sel, rows, keepValue='') {
  // junta opciones únicas (ignorando mayúsculas/minúsculas)
  const norm = s => String(s||'').trim();
  const uniq = [...new Set(rows.map(r => norm(r.proximoPaso)).filter(v => v))].sort((a,b)=>a.localeCompare(b,'es'));
  const old = sel.value;
  const want = keepValue || old;
  sel.innerHTML = `<option value="">Todos</option>` + uniq.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if (want && uniq.includes(want)) sel.value = want;
}

function lastNWeeks(n = 20) {
  const out = [];
  let d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(currentIsoWeek(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
  }
  return out;
}

function currentIsoWeek(d = new Date()) {
  if (window.app?.utils?.isoWeek) {
    const w = window.app.utils.isoWeek(d);
    return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
  }
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function canonEstado(s) {
  const raw = String(s || '').toLowerCase();
  if (raw === 'completado') return 'hecho';
  if (!raw) return '';
  return raw;
}

// === fechas SOLO con día/mes/año (sin hora)
function fmtD(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('es-CL'); // 23-10-2025
}

function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '';
  const v = Number(n); if (!Number.isFinite(v)) return '';
  return v.toLocaleString('es-CL', { maximumFractionDigits: 2 });
}

function esc(s) {
  return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}
