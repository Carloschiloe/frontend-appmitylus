import { list } from './api.js';
import { esContactoNuevo, esProveedorNuevoInteraccion } from './normalizers.js';
import { openInteraccionModal } from './modal.js';

export async function renderTable(container, { onChanged } = {}){
  container.innerHTML = `
  <div class="card"><div class="card-content">
    <div class="row" style="margin-bottom:8px">
      <!-- RESPONSABLE PG: ahora es SELECT con opciones fijas -->
      <div class="col s12 m3">
        <label class="grey-text text-darken-1" style="font-size:12px">Responsable PG</label>
        <select id="f-responsable" class="browser-default" aria-label="Responsable PG">
          <option value="">Todos</option>
          <option value="Claudio Alba">Claudio Alba</option>
          <option value="Patricio Alvarez">Patricio Alvarez</option>
          <option value="Carlos Avendaño">Carlos Avendaño</option>
        </select>
      </div>

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

      <div class="col s12 m3">
        <label class="grey-text text-darken-1" style="font-size:12px">Semana</label>
        <input id="f-semana" placeholder="2025-W43" aria-label="Semana (YYYY-Www)">
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

  // Semana ISO por defecto si el input está vacío
  if (!fSemana.value) {
    fSemana.value = currentIsoWeek();
  }

  // Enter solo en semana (el responsable ahora es select)
  [fSemana].forEach(el => el.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter') btn.click();
  }));

  // Delegación para editar
  tbody.addEventListener('click', (ev)=>{
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

  async function refresh(){
    if (_loading) return;
    _loading = true;
    const oldTxt = btn.textContent;
    btn.textContent = 'Cargando…';
    btn.disabled = true;

    try {
      // Armar params limpios
      const params = {
        tipo: (fTipo.value || '').trim() || undefined,
        responsable: (fResp.value || '').trim() || undefined,
        semana: (fSemana.value || '').trim() || undefined,
        // si tildas "solo nuevos", lo pedimos al backend:
        nuevos: fNuevo.checked ? true : undefined
      };

      // Evita enviar semana vacía
      if (!params.semana) params.semana = currentIsoWeek();

      const resp = await list(params);
      const items = (resp && (resp.items || resp.data || [])) || [];

      // Si el backend aún no implementa 'nuevos', filtramos acá como fallback
      const rows = (!fNuevo.checked) ? items : items.filter(it =>
        esContactoNuevo(it.contactoId) || esProveedorNuevoInteraccion(it)
      );

      // Orden por fecha desc (fecha de la interacción)
      rows.sort((a,b)=> (new Date(b.fecha||0)) - (new Date(a.fecha||0)));

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
            <td style="text-align:right">${fmtNum(r.tonsConversadas)}</td>
            <td>${esc(r.proximoPaso || '')}</td>
            <td>${fmtDT(r.proximoPasoFecha || r.fechaProx)}</td>
            <td>${esc(r.responsable || '')}</td>
            <td>${esc(canonEstado(r.estado))}</td>
            <td>${nuevo}</td>
            <td><a class="btn-flat blue-text edit-int">Editar</a></td>
          </tr>`;
      }).join('') || `<tr><td colspan="11" class="grey-text">Sin resultados.</td></tr>`;

      onChanged && onChanged(rows);
    } catch (e) {
      console.error(e);
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

/* Utils */
function currentIsoWeek(d = new Date()){
  // Si ya tienes un helper global, úsalo:
  if (window.app?.utils?.isoWeek) {
    const w = window.app.utils.isoWeek(d);
    return `${d.getFullYear()}-W${String(w).padStart(2,'0')}`;
  }
  // Fallback ISO week (lunes como primer día)
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7; // 0..6 (0=Lunes)
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // jueves de esa semana
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6)%7)) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

function canonEstado(s){
  const raw = String(s || '').toLowerCase();
  if (raw === 'completado') return 'hecho';
  if (!raw) return '';
  return raw;
}

function fmtDT(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('es-CL');
}
function fmtNum(n){
  if (n === null || n === undefined || n === '') return '';
  const v = Number(n); if (!Number.isFinite(v)) return '';
  return v.toLocaleString('es-CL', { maximumFractionDigits: 2 });
}
function esc(s){ return String(s||'').replace(/[<>&]/g,c=>({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c])); }
