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
          <span id="sc_cantHelp" class="helper-text" data-error="" data-success=""></span>
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
      <a id="sc_btnGuardar" href="#!" class="btn">
        <i class="material-icons left">save</i><span id="sc_btnTxt">Guardar</span>
      </a>
    </div>
  `;
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
    #sc_cantidadTon.invalid { border-bottom-color:#e53935 !important; box-shadow:0 1px 0 0 #e53935 !important; }
  `;
  document.head.appendChild(s);
}

/* ========== API helpers ========== */
async function apiGET(path){
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} GET ${path}`);
  return res.json();
}
async function apiPOST(path, body){
  const res = await fetch(`${API}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} POST ${path}`);
  return res.json();
}
async function apiPATCH(path, body){
  const res = await fetch(`${API}${path}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} PATCH ${path}`);
  return res.json();
}
async function apiDELETE(path){
  const res = await fetch(`${API}${path}`, { method:'DELETE' });
  if (!res.ok) throw new Error(`${res.status} DELETE ${path}`);
  return res.json();
}

/* ===== helpers UI validación ===== */
function clearTonsError(){
  const inp = $('#sc_cantidadTon'); const help = $('#sc_cantHelp');
  inp.classList.remove('invalid'); if (help) help.setAttribute('data-error','');
}
function setTonsError(msg){
  const inp = $('#sc_cantidadTon'); const help = $('#sc_cantHelp');
  inp.classList.add('invalid'); if (help) help.setAttribute('data-error', msg || '');
  inp.focus(); if (window.M?.updateTextFields) M.updateTextFields();
}

/** Normaliza número (soporta coma/punto) */
function readTons(){
  const raw = ($('#sc_cantidadTon')?.value || '').trim().replace(',', '.');
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Busca si ya existe registro para proveedor+periodo → devuelve doc o null */
async function findExisting(proveedorKey, periodo){
  if (!proveedorKey || !periodo) return null;
  const r = await apiGET(`semi-cerrados?proveedorKey=${encodeURIComponent(proveedorKey)}&periodo=${encodeURIComponent(periodo)}`);
  const items = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
  return items[0] || null;
}

/** GET historial por proveedor */
async function loadHistorial({ proveedorKey }){
  const tbody = $('#sc_histBody');
  if (!proveedorKey){
    tbody.innerHTML = `<tr><td colspan="4" class="grey-text">Sin proveedor seleccionado.</td></tr>`;
    return;
  }
  try{
    const data = await apiGET(`semi-cerrados?proveedorKey=${encodeURIComponent(proveedorKey)}`);
    const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    if (!items.length){
      tbody.innerHTML = `<tr><td colspan="4" class="grey-text">Sin registros.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(it => `
      <tr data-id="${it._id}" data-periodo="${it.periodo}" data-tons="${it.tons ?? 0}">
        <td>${String(it.periodo || '').replace('-', ' / ')}</td>
        <td class="right-align">${fmtCL(it.tons ?? 0)}</td>
        <td>semi-cerrada</td>
        <td>
          <a href="#!" class="blue-text tooltipped sc-act-edit" data-tooltip="Editar"><i class="material-icons">edit</i></a>
          <a href="#!" class="red-text  tooltipped sc-act-del"  data-tooltip="Eliminar"><i class="material-icons">delete</i></a>
        </td>
      </tr>
    `).join('');

    // tooltips solo
    const tips = tbody.querySelectorAll('.tooltipped');
    if (window.M?.Tooltip && tips.length) window.M.Tooltip.init(tips, { enterDelay: 100 });
  }catch(e){
    console.error('[semi] historial Error:', e);
    tbody.innerHTML = `<tr><td colspan="4" class="red-text">Error cargando historial</td></tr>`;
  }
}

/** Crea o actualiza según exista → mismo botón. Cierra el modal al éxito. */
async function guardarAsignacion(preset){
  const btn = $('#sc_btnGuardar');
  const btnTxt = $('#sc_btnTxt');
  if (!btn || btn.dataset.busy==='1') return;
  btn.dataset.busy='1';

  try{
    clearTonsError();

    const proveedorKey = preset.proveedorKey || '';
    const periodo = $('#sc_periodo')?.value || '';
    const tons = readTons();

    if (!proveedorKey) { window.M?.toast?.({ html:'Falta proveedor', classes:'red' }); return; }
    if (!periodo)      { window.M?.toast?.({ html:'Falta mes (YYYY-MM)', classes:'red' }); return; }

    // ¿Existe algo para proveedor+mes?
    const editIdFromBtn = btn.dataset.editId || null;
    const exist = editIdFromBtn ? { _id: editIdFromBtn } : await findExisting(proveedorKey, periodo);
    const existingId = exist?._id || null;

    // 🔸 Caso "no-op": nada que guardar (no existe registro y tons <= 0) → cerrar sin error
    if (!existingId && !(tons > 0)) {
      const wrap = $('#modalSemiCerrado');
      if (window.M?.Modal){
        const inst = window.M.Modal.getInstance(wrap) || window.M.Modal.init(wrap);
        inst.close();
      } else {
        wrap.style.display = 'none';
      }
      delete btn.dataset.editId;
      btnTxt.textContent = 'Guardar';
      return;
    }

    // Desde aquí en adelante, sí hay algo que crear/actualizar → se exige tons > 0
    if (!(tons > 0)) { setTonsError('Biomasa debe ser > 0'); return; }

    const body = {
      proveedorKey,
      proveedorNombre: $('#sc_proveedorNombre')?.value || '',
      contactoNombre:  $('#sc_contactoNombre')?.value  || '',
      periodo,
      tons
    };

    if (existingId){
      await apiPATCH(`semi-cerrados/${encodeURIComponent(existingId)}`, body);
      window.M?.toast?.({ html:'Actualizado', classes:'green' });
    }else{
      await apiPOST('semi-cerrados', body);
      window.M?.toast?.({ html:'Guardado', classes:'green' });
    }

    // Cerrar modal al éxito
    const wrap = $('#modalSemiCerrado');
    if (window.M?.Modal){
      const inst = window.M.Modal.getInstance(wrap) || window.M.Modal.init(wrap);
      inst.close();
    } else {
      wrap.style.display = 'none';
    }

    delete btn.dataset.editId;
    btnTxt.textContent = 'Guardar';
  }catch(e){
    console.error('[semi] guardar Error:', e);
    window.M?.toast?.({ html: e.message || 'No se pudo guardar', classes:'red' });
  }finally{
    delete btn.dataset.busy;
  }
}


/** Ajusta botón a modo edición si existe registro del mes */
async function checkEditMode(preset){
  const btn = $('#sc_btnGuardar');
  const btnTxt = $('#sc_btnTxt');
  btnTxt.textContent = 'Guardar';
  delete btn.dataset.editId;
  clearTonsError();

  const proveedorKey = preset.proveedorKey || '';
  const periodo = $('#sc_periodo')?.value || '';
  if (!proveedorKey || !periodo) return;

  const exist = await findExisting(proveedorKey, periodo);
  if (exist){
    btn.dataset.editId = exist._id;
    $('#sc_cantidadTon').value = exist.tons ?? 0;
    btnTxt.textContent = 'Actualizar';
    clearTonsError();
    if (window.M?.updateTextFields) M.updateTextFields();
  }
}

/** Abre el modal (create o edit) */
function openSemiCerradoModal(preset = {}){
  const wrap = ensureModal();
  renderModalUI(wrap);

  // Prefills
  $('#sc_proveedorNombre').value = preset.proveedorNombre || '';
  $('#sc_contactoNombre').value  = preset.contacto || preset.contactoNombre || '';
  const hoy = new Date();
  const defYM = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  $('#sc_periodo').value = preset.periodo || preset.periodoYM || defYM;

  // Acciones
  $('#sc_btnGuardar')?.addEventListener('click', (ev)=>{ ev.preventDefault(); guardarAsignacion(preset); });
  $('#sc_periodo')?.addEventListener('change', ()=> checkEditMode(preset));
  $('#sc_cantidadTon')?.addEventListener('input', clearTonsError);

  // Historial + detección inicial de edición
  loadHistorial({ proveedorKey: preset.proveedorKey }).then(()=> checkEditMode(preset));

  // Init y abrir
  if (window.M?.Modal){
    let inst = window.M.Modal.getInstance(wrap);
    if (!inst){
      inst = window.M.Modal.init(wrap, { endingTop:'6%', dismissible:false });
    }
    inst.open();
  }else{
    wrap.style.display='block';
  }
}

/* Delegación de eventos en la tabla (editar/eliminar) */
document.addEventListener('click', async (e)=>{
  const openBtn = e.target.closest('#btnOpenSemiCerrado');
  if (openBtn){ e.preventDefault(); openSemiCerradoModal(); return; }

  const edit = e.target.closest('.sc-act-edit');
  const del  = e.target.closest('.sc-act-del');
  if (!edit && !del) return;

  e.preventDefault();

  const tr = e.target.closest('tr[data-id]');
  const id = tr?.dataset?.id;
  const periodo = tr?.dataset?.periodo || '';
  const tons = Number(tr?.dataset?.tons || 0);

  if (edit){
    $('#sc_periodo').value = periodo;
    $('#sc_cantidadTon').value = tons;
    const btn = $('#sc_btnGuardar'); const btnTxt = $('#sc_btnTxt');
    btn.dataset.editId = id; btnTxt.textContent = 'Actualizar';
    clearTonsError();
    if (window.M?.updateTextFields) M.updateTextFields();
    return;
  }

  if (del && id){
    if (!confirm('¿Eliminar esta asignación semi-cerrada?')) return;
    try{
      await apiDELETE(`semi-cerrados/${encodeURIComponent(id)}`);
      tr.remove();
      window.M?.toast?.({ html:'Eliminado', classes:'green' });

      const btn = $('#sc_btnGuardar'); const btnTxt = $('#sc_btnTxt');
      if (btn.dataset.editId === id){
        delete btn.dataset.editId;
        btnTxt.textContent = 'Guardar';
        // dejar listo para escribir y guardar de inmediato
        $('#sc_cantidadTon').value = '';
        clearTonsError();
        $('#sc_cantidadTon').focus();
      }

      // Si tabla queda vacía, recarga mensaje
      const tbody = $('#sc_histBody');
      if (!tbody.querySelector('tr')) {
        const proveedorKey = window.__lastSemiProveedorKey || '';
        await loadHistorial({ proveedorKey });
      }
    }catch(e){
      console.error('[semi] delete', e);
      window.M?.toast?.({ html:'No se pudo eliminar', classes:'red' });
    }
  }
});

/* Exponer para abrir desde afuera */
window.openSemiCerradoModal = openSemiCerradoModal;

document.addEventListener('semi-cerrado:open', (ev)=>{
  const preset = ev?.detail || {};
  window.__lastSemiProveedorKey = preset.proveedorKey || '';
  openSemiCerradoModal(preset);
});

