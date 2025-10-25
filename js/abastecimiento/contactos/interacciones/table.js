import { list } from './api.js';
import { esContactoNuevo } from './normalizers.js';

export async function renderTable(container, { onChanged } = {}){
  container.innerHTML = `
  <div class="card"><div class="card-content">
    <div class="row" style="margin-bottom:8px">
      <div class="col s12 m3"><input id="f-responsable" placeholder="Responsable"></div>
      <div class="col s12 m3">
        <select id="f-tipo" class="browser-default">
          <option value="">Todos los tipos</option>
          <option value="llamada">Llamada</option>
          <option value="visita">Visita</option>
          <option value="muestra">Muestra</option>
          <option value="reunion">Reunión</option>
          <option value="tarea">Tarea</option>
        </select>
      </div>
      <div class="col s12 m3"><input id="f-semana" placeholder="2025-W43"></div>
      <div class="col s12 m3" style="display:flex;gap:8px;align-items:center;">
        <label><input type="checkbox" id="f-solo-nuevos"><span>Solo contactos NUEVOS</span></label>
        <button id="btn-filtrar" class="btn">Filtrar</button>
      </div>
    </div>
    <table id="int-table" class="striped highlight" style="font-size:.95rem">
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
  </div></div>`;

  const tbody = container.querySelector('tbody');
  const btn   = container.querySelector('#btn-filtrar');
  const fNuevo= container.querySelector('#f-solo-nuevos');

  async function refresh(){
    const params = {
      tipo: container.querySelector('#f-tipo').value || undefined,
      responsable: container.querySelector('#f-responsable').value || undefined,
      semana: container.querySelector('#f-semana').value || undefined,
    };
    const { items } = await list(params);

    const rows = items.filter(it => {
      if (!fNuevo.checked) return true;
      return esContactoNuevo(it.contactoId);
    });

    tbody.innerHTML = rows.map(r => {
      const nuevo = esContactoNuevo(r.contactoId) ? '⭐' : '';
      return `
        <tr data-id="${r._id}">
          <td>${fmt(r.fecha)}</td>
          <td>${r.tipo||''}</td>
          <td>${esc(r.contactoNombre||'')}</td>
          <td>${esc(r.proveedorNombre||'')}</td>
          <td>${r.tonsConversadas ?? ''}</td>
          <td>${esc(r.proximoPaso||'')}</td>
          <td>${fmt(r.fechaProx)}</td>
          <td>${esc(r.responsable||'')}</td>
          <td>${esc(r.estado||'')}</td>
          <td>${nuevo}</td>
          <td><a class="btn-flat blue-text edit-int">Editar</a></td>
        </tr>`;
    }).join('');

    if (onChanged) onChanged(rows);
  }

  btn.addEventListener('click', refresh);
  await refresh();
}

function fmt(iso){ if(!iso) return ''; const d=new Date(iso); return d.toLocaleString('es-CL'); }
function esc(s){ return String(s||'').replace(/[<>&]/g,c=>({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c])); }
