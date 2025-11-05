// /js/abastecimiento/semi-cerrado/modal.js
// Base API con barra final
const API = (() => {
  const env = (window.API_BASE || window.API_URL || '').toString().trim();
  if (env) return env.endsWith('/') ? env : env + '/';
  if (location.hostname.includes('frontend-appmitylus.vercel.app')) {
    return 'https://backend-appmitylus.vercel.app/api/';
  }
  return '/api/';
})();
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const fmtCL = (n)=> Number(n||0).toLocaleString('es-CL', { maximumFractionDigits: 2 });

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

/** UI compacta */
function renderModalUI(wrap){
  wrap.innerHTML = `
    <div class="modal-content sc-compact">
      <h5 style="margin:0 0 8px">Biomasa <span class="green-text text-darken-2">semi-cerrada</span></h5>

      <div class="row" style="margin-bottom:6px">
        <div class="input-field col s12 m6">
          <label class="active">Proveedor</label>
          <input id="sc_proveedorNombre" type="text" readonly>
        </div>
        <div class="input-field col s12 m6">
          <label class="active">Contacto</label>
          <input id="sc_contactoNombre" type="text" readonly>
        </div>
      </div>

      <div class="row" style="margin-bottom:6px">
        <div class="input-field col s12 m6">
          <label class="active" for="sc_periodo">Mes disponible (YYYY-MM)</label>
          <input id="sc_periodo" type="month">
        </div>
        <div class="input-field col s12 m6">
          <label class="active" for="sc_cantidadTon">Biomasa (ton)</label>
          <input id="sc_cantidadTon" type="number" min="0" step="0.01" placeholder="Ej: 120">
        </div>
      </div>

      <div class="card" style="margin-top:8px">
        <div class="card-content" style="padding:10px">
          <span class="card-title" style="font-size:15px">Biomasa semi-cerrada</span>
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
      <a id="sc_btnGuardar" href="#!" class="btn"><i class="material-icons left">save</i>Guardar</a>
    </div>
  `;

  // estilos compactos
  ensureStyles();
  if (window.M?.updateTextFields) M.updateTextFields();
}

function ensureStyles(){
  if (document.getElementById('sc-compact-css')) return;
  const s = document.createElement('style');
  s.id = 'sc-compact-css';
  s.textContent = `
    #modalSemiCerrado .sc-compact .input-field { margin: 8px 0; }
    #modalSemiCerrado .sc-compact input[type="text"],
    #modalSemiCerrado .sc-compact input[type="month"],
    #modalSemiCerrado .sc-compact input[type="number"] { margin-bottom: 2px; }
    #modalSemiCerrado .modal-content { padding: 14px 16px 6px; }
    #modalSemiCerrado .modal-footer { padding: 8px 12px; }
  `;
  document.head.appendChild(s);
}

/** GET historial por proveedor */
async function loadHistorial({ proveedorKey }){
  const tbody = $('#sc_histBody');
  if (!proveedorKey){
    tbody.innerHTML = `<tr><td colspan="4" class="grey-text">Sin proveedor seleccionado.</td></tr>`;
    return;
  }
  try{
    const url = `${API}semi-cerrados?proveedorKey=${encodeURIComponent(proveedorKey)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);

    if (!items.length){
      tbody.innerHTML = `<tr><td colspan="4" class="grey-text">Sin registros.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(it => `
      <tr>
        <td>${String(it.periodo || '').replace('-', ' / ')}</td>
        <td class="right-align">${fmtCL(it.tons ?? 0)}</td>
        <td>semi-cerrada</td>
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

/** POST crear asignación (campos mínimos) */
async function guardarAsignacion(preset){
  const btn = $('#sc_btnGuardar');
  if (!btn || btn.dataset.busy==='1') return;
  btn.dataset.busy='1';
  try{
    const body = {
      proveedorKey: preset.proveedorKey || '',
      proveedorNombre: $('#sc_proveedorNombre')?.value || '',
      contactoNombre:  $('#sc_contactoNombre')?.value  || '',
      periodo:         $('#sc_periodo')?.value || '',    // YYYY-MM
      tons:            Number($('#sc_cantidadTon')?.value || 0),
    };
    if (!body.proveedorKey) throw new Error('Falta proveedor');
    if (!body.periodo)      throw new Error('Falta mes (YYYY-MM)');
    if (!(body.tons > 0))   throw new Error('Biomasa debe ser > 0');

    const url = `${API}semi-cerrados`;
    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);

    window.M?.toast?.({ html:'Guardado', classes:'green' });
    await loadHistorial({ proveedorKey: body.proveedorKey });
  }catch(e){
    console.error('[semi] guardar Error:', e);
    window.M?.toast?.({ html: e.message || 'No se pudo guardar', classes:'red' });
  }finally{
    delete btn.dataset.busy;
  }
}

/** Abre el modal */
function openSemiCerradoModal(preset = {}){
  const wrap = ensureModal();
  renderModalUI(wrap);

  // Prefills mínimos
  $('#sc_proveedorNombre').value = preset.proveedorNombre || '';
  $('#sc_contactoNombre').value  = preset.contacto || preset.contactoNombre || '';
  const hoy = new Date();
  const defYM = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  $('#sc_periodo').value = preset.periodo || preset.periodoYM || defYM;

  // Acciones
  $('#sc_btnGuardar')?.addEventListener('click', ()=> guardarAsignacion(preset));

  // Historial
  loadHistorial({ proveedorKey: preset.proveedorKey });

  // Abrir
  if (window.M?.Modal){
    const inst = window.M.Modal.init(wrap, { endingTop:'6%' });
    inst.open();
  }else{
    wrap.style.display='block';
  }
}

/* Exponer y wirear */
window.openSemiCerradoModal = openSemiCerradoModal;

document.addEventListener('click', (e)=>{
  const el = e.target.closest('#btnOpenSemiCerrado');
  if (!el) return;
  openSemiCerradoModal();
});

document.addEventListener('semi-cerrado:open', (ev)=>{
  const preset = ev?.detail || {};
  openSemiCerradoModal(preset);
});
