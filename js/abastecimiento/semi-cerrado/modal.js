// /js/abastecimiento/semi-cerrado/modal.js
// Base de API robusta (con barra final) para evitar errores de concatenación
const API = (() => {
  const env = (window.API_BASE || window.API_URL || '').toString().trim();
  if (env) return env.endsWith('/') ? env : env + '/';
  if (location.hostname.includes('frontend-appmitylus.vercel.app')) {
    return 'https://backend-appmitylus.vercel.app/api/'; // prod
  }
  return '/api/'; // dev con proxy
})();
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const fmtCL = (n)=> Number(n||0).toLocaleString('es-CL', { maximumFractionDigits: 2 });

console.log('[semi] API =', API);

/** Crea el contenedor del modal si no existe */
function ensureModal(){
  let wrap = $('#modalSemiCerrado');
  if (!wrap){
    wrap = document.createElement('div');
    wrap.id = 'modalSemiCerrado';
    wrap.className = 'modal';
    document.body.appendChild(wrap);
  }
  return wrap;
}

/** Render del modal (sin ids internos obligatorios) */
function renderModalUI(wrap){
  wrap.innerHTML = `
    <div class="modal-content">
      <h5>Asignar biomasa <span class="green-text text-darken-2">semi-cerrada</span></h5>

      <div class="row">
        <div class="input-field col s12 m6">
          <label class="active">Proveedor</label>
          <input id="sc_proveedorNombre" type="text" readonly>
        </div>
        <div class="input-field col s12 m6">
          <label class="active">Contacto</label>
          <input id="sc_contactoNombre" type="text" readonly>
        </div>
      </div>

      <div class="row">
        <div class="input-field col s12 m6">
          <label class="active">Centro (código, opcional)</label>
          <input id="sc_centroCodigo" type="text" readonly>
        </div>
        <div class="input-field col s12 m6">
          <label class="active">Responsable PG</label>
          <input id="sc_responsablePG" type="text" readonly>
        </div>
      </div>

      <div class="row">
        <div class="input-field col s12 m4">
          <label class="active" for="sc_periodo">Período (YYYY-MM)</label>
          <input id="sc_periodo" type="month">
        </div>
        <div class="input-field col s12 m4">
          <label class="active">Tons disponibles (referencia)</label>
          <input id="sc_tonsDisp" type="text" readonly>
        </div>
        <div class="input-field col s12 m4">
          <label class="active" for="sc_cantidadTon">Cantidad (ton) a semi-cerrar</label>
          <input id="sc_cantidadTon" type="number" min="0" step="0.01" placeholder="Ej: 120">
        </div>
      </div>

      <div class="input-field">
        <textarea id="sc_notas" class="materialize-textarea" placeholder="Notas (opcional)"></textarea>
        <label for="sc_notas">Notas (opcional)</label>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="card-content" style="padding:10px">
          <span class="card-title" style="font-size:16px">Disponibilidad de MMPP (asignaciones)</span>
          <div style="overflow:auto">
            <table class="striped" style="min-width:520px">
              <thead>
                <tr><th>Mes</th><th class="right-align">Tons</th><th>Estado</th><th>Opciones</th></tr>
              </thead>
              <tbody id="sc_histBody"><tr><td colspan="4" class="grey-text">Cargando…</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end">
      <a href="#!" class="modal-close btn-flat">Cancelar</a>
      <a id="sc_btnGuardar" href="#!" class="btn">
        <i class="material-icons left">save</i>Guardar
      </a>
    </div>
  `;
  if (window.M?.updateTextFields) M.updateTextFields();
}

/** GET historial de semi-cerrados por proveedor */
async function loadHistorial({ proveedorKey }){
  const tbody = $('#sc_histBody');
  if (!proveedorKey){
    tbody.innerHTML = `<tr><td colspan="4" class="grey-text">Sin proveedor seleccionado.</td></tr>`;
    return;
  }
  try{
    const url = `${API}semi-cerrados?proveedorKey=${encodeURIComponent(proveedorKey)}`;
    console.log('[semi] GET', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    const data = await res.json();
    // backend devuelve array o {ok:true,data:[...]}
    const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);

    if (!items.length){
      tbody.innerHTML = `<tr><td colspan="4" class="grey-text">Sin asignaciones registradas.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(it => `
      <tr>
        <td>${String(it.periodo || '').replace('-', ' / ')}</td>
        <td class="right-align">${fmtCL(it.tons ?? 0)}</td>
        <td>${it.estado || 'disponible'}</td>
        <td>
          <a href="#!" class="blue-text tooltipped" data-id="${it._id}" data-act="edit"  data-tooltip="Editar"><i class="material-icons">edit</i></a>
          <a href="#!" class="red-text  tooltipped" data-id="${it._id}" data-act="del"   data-tooltip="Eliminar"><i class="material-icons">delete</i></a>
        </td>
      </tr>
    `).join('');
    if (window.M?.AutoInit) M.AutoInit();
  }catch(e){
    console.error('[semi] historial Error:', e);
    tbody.innerHTML = `<tr><td colspan="4" class="red-text">Error cargando historial</td></tr>`;
  }
}

/** POST crear asignación */
async function guardarAsignacion(preset){
  const btn = $('#sc_btnGuardar');
  if (!btn || btn.dataset.busy==='1') return;
  btn.dataset.busy='1';

  try{
    const body = {
      proveedorKey: preset.proveedorKey || '',
      centroId: preset.centroId || null, // opcional
      proveedorNombre: $('#sc_proveedorNombre')?.value || '',
      contactoNombre: $('#sc_contactoNombre')?.value || '',
      responsablePG: $('#sc_responsablePG')?.value || '',
      periodo: $('#sc_periodo')?.value || '', // YYYY-MM (backend)
      tons: Number($('#sc_cantidadTon')?.value || 0),
      notas: $('#sc_notas')?.value || '',
    };

    if (!body.proveedorKey) throw new Error('Falta proveedor');
    if (!body.periodo)      throw new Error('Falta período (YYYY-MM)');
    if (!(body.tons > 0))   throw new Error('Cantidad debe ser mayor a 0');

    const url = `${API}semi-cerrados`;
    console.log('[semi] POST', url, body);
    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);

    window.M?.toast?.({ html:'Asignación guardada', classes:'green' });
    await loadHistorial({ proveedorKey: body.proveedorKey });
  }catch(e){
    console.error('[semi] guardar Error:', e);
    window.M?.toast?.({ html: e.message || 'No se pudo guardar', classes:'red' });
  }finally{
    delete btn.dataset.busy;
  }
}

/** Abre el modal con preset */
function openSemiCerradoModal(preset = {}){
  const wrap = ensureModal();
  renderModalUI(wrap);

  // Prefills
  $('#sc_proveedorNombre').value = preset.proveedorNombre || '';
  $('#sc_contactoNombre').value  = preset.contacto || preset.contactoNombre || '';
  $('#sc_responsablePG').value   = preset.responsablePG || '';
  $('#sc_centroCodigo').value    = preset.centroCodigo || '';
  $('#sc_tonsDisp').value        = fmtCL(preset.tonsDisponible || 0);

  const hoy = new Date();
  const defYM = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  $('#sc_periodo').value = preset.periodo || preset.periodoYM || defYM;

  // Acciones
  $('#sc_btnGuardar')?.addEventListener('click', ()=> guardarAsignacion(preset));

  // Carga historial
  loadHistorial({ proveedorKey: preset.proveedorKey });

  // Init/abrir materialize
  if (window.M?.Modal){
    const inst = window.M.Modal.init(wrap, { endingTop:'5%' });
    inst.open();
  }else{
    wrap.style.display='block';
  }
}

/* Exponer y wirear */
window.openSemiCerradoModal = openSemiCerradoModal;

// Abrir desde el botón de la barra (sin preset)
document.addEventListener('click', (e)=>{
  const el = e.target.closest('#btnOpenSemiCerrado');
  if (!el) return;
  openSemiCerradoModal(); // vacío (mostrar solo campos)
});

// Abrir desde la tabla por evento (con preset)
document.addEventListener('semi-cerrado:open', (ev)=>{
  const preset = ev?.detail || {};
  openSemiCerradoModal(preset);
});
