import { list } from './api.js';
import { esContactoNuevo, esProveedorNuevoInteraccion } from './normalizers.js';
import { openInteraccionModal } from './modal.js';

export async function renderTable(container, { onChanged } = {}) {
  container.innerHTML = `
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

      <div class="col s12 m3" style="display:flex;gap:8px;align-items:center;">
        <label style="display:flex;align-items:center;gap:6px">
          <input type="checkbox" id="f-solo-nuevos"><span>Solo contactos NUEVOS</span>
        </label>
        <button id="btn-filtrar" class="btn">Filtrar</button>
      </div>
    </div>

    <div class="mmpp-table-wrap">
      <table id="int-table" class="striped highlight" style="font-size:.95rem;width:100%">
        <thead>
          <tr>
            <th>Fecha llamada</th>
            <th>Tipo</th>
            <th>Contacto</th>
            <th>Proveedor</th>
            <th>Tons</th>
            <th>Próx. paso</th>
            <th>Fecha próx.</th>
            <th>Resp.</th>
            <th>Estado</th>
            <th>Nuevo</th>
            <th></th>
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

  // ==== poblar semanas (actual y 19 anteriores) ====
  populateWeeksSelect(fSemana, 20);

  // Delegación para editar
  tbody.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!t || !t.classList) return;
    if (t.classList.contains('edit-int')) {
      const tr = t.closest('tr[data-id]');
      if (!tr) return;
      const id = tr.getAttribute('data-id');
      const idx = Number(tr.getAttribute('data-idx') || -1);
      const row = _lastRows[idx];
      if (!row) return;
      openInteraccionModal({
        preset: row,
        onSaved: refresh
      });
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
      // NOTA: semana la filtramos client-side por semanaKey
      nuevos: fNuevo.checked ? true : undefined
    };

    const semanaSel = (fSemana.value || '').trim();

    console.log('[int] UI filtros ->', { ...params, semanaSel });

    // Traemos sin semana para no depender del filtro del backend
    const resp = await list({ ...params, semana: undefined });
    const items = (resp && (resp.items || resp.data || [])) || [];

    console.log('[int] resp.ok?', resp?.ok, 'items.size', items.length);
    if (items.length) console.log('[int] sample item ->', items[0]);

    // Filtrar por semanaKey en cliente
    const itemsBySemana = semanaSel ? items.filter(x => x.semanaKey === semanaSel) : items;
    console.log('[int] itemsBySemana.size', itemsBySemana.length, 'semanaSel', semanaSel);

    // “solo nuevos”
    const rows = (!fNuevo.checked)
      ? itemsBySemana
      : itemsBySemana.filter(it => esContactoNuevo(it.contactoId) || esProveedorNuevoInteraccion(it));

    // Orden por fecha (fecha de la interacción)
    rows.sort((a,b)=> (new Date(b.fecha||0)) - (new Date(a.fecha||0)));

    console.log('[int] rows a renderizar:', rows.length);
    if (rows.length) {
      const r = rows[0];
      console.log('[int] row[0] campos claves ->', {
        fecha: r.fecha,
        tipo: r.tipo,
        contacto: r.contactoNombre,
        proveedor: r.proveedorNombre,
        tonsAcordadas: r.tonsAcordadas,
        proximoPaso: r.proximoPaso,
        fechaProximo: r.fechaProximo,
        responsablePG: r.responsablePG,
        estado: r.estado,
        semanaKey: r.semanaKey
      });
    }

    _lastRows = rows;

    tbody.innerHTML = rows.map((r, i) => {
      const nuevo = (esContactoNuevo(r.contactoId) || esProveedorNuevoInteraccion(r))
        ? '<span class="nuevo-star yellow" title="Proveedor nuevo">★</span>'
        : '';
      return `
        <tr data-id="${esc(r._id || r.id || '')}" data-idx="${i}">
          <td>${fmtDT(r.fecha)}</td>
          <td>${esc(r.tipo || '')}</td>
          <td>${esc(r.contactoNombre || '')}</td>
          <td>${esc(r.proveedorNombre || '')}</td>
          <td style="text-align:right">${fmtNum(r.tonsAcordadas)}</td>
          <td>${esc(r.proximoPaso || '')}</td>
          <td>${fmtDT(r.fechaProximo)}</td>
          <td>${esc(r.responsablePG || '')}</td>
          <td>${esc(canonEstado(r.estado))}</td>
          <td>${nuevo}</td>
          <td><a class="btn-flat blue-text edit-int">Editar</a></td>
        </tr>`;
    }).join('') || `<tr><td colspan="11" class="grey-text">Sin resultados.</td></tr>`;

    onChanged && onChanged(rows);
  } catch (e) {
    console.error('[int] ERROR refresh():', e);
    M && M.toast && M.toast({ html: 'Error al cargar interacciones', classes: 'red' });
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

function fmtDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('es-CL');
}

function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '';
  const v = Number(n); if (!Number.isFinite(v)) return '';
  return v.toLocaleString('es-CL', { maximumFractionDigits: 2 });
}

function esc(s) {
  return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}


