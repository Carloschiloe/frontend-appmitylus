// /js/abastecimiento/semi-cerrado/modal.js
const API_BASE = window.API_URL || '/api';

function mm(val = new Date()){
  const y = val instanceof Date ? val.getFullYear() : new Date().getFullYear();
  const m = val instanceof Date ? (val.getMonth()+1) : (new Date().getMonth()+1);
  return `${y}-${String(m).padStart(2,'0')}`;
}

function esc(s=''){ return String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

function ensureModalShell(){
  let el = document.getElementById('modalSemiCerrado');
  if (!el){
    el = document.createElement('div');
    el.id = 'modalSemiCerrado';
    el.className = 'modal';
    document.body.appendChild(el);
  }
  return el;
}

function renderModal({ preset } = {}){
  const el = ensureModalShell();

  const proveedorNombre = preset?.proveedorNombre || preset?.proveedor || preset?.contactoNombre || '';
  const proveedorId     = preset?.proveedorKey || preset?._id || preset?.proveedorId || '';
  const centroId        = preset?.centroId || '';
  const centroCodigo    = preset?.centroCodigo || '';
  const responsablePG   = preset?.responsablePG || preset?.responsable || preset?.contactoResponsable || '';

  el.innerHTML = `
    <div class="modal-content">
      <h5>Asignar biomasa <span class="green-text text-darken-2">semi-cerrada</span></h5>

      <form id="formSemi" autocomplete="off">
        <div class="row">
          <div class="input-field col s12 m6">
            <input id="sc_proveedorNombre" type="text" placeholder="Proveedor..." value="${esc(proveedorNombre)}">
            <label class="active" for="sc_proveedorNombre">Proveedor</label>
            <span class="helper-text">${preset ? '' : 'Sugerencia: abre este modal desde una fila para precargar los datos.'}</span>
          </div>
          <div class="input-field col s12 m6">
            <input id="sc_proveedorId" type="text" placeholder="ID proveedor" value="${esc(proveedorId)}">
            <label class="active" for="sc_proveedorId">ID proveedor</label>
            <span class="helper-text">Obligatorio si no se precargó automáticamente.</span>
          </div>
        </div>

        <div class="row">
          <div class="input-field col s12 m6">
            <input id="sc_centroId" type="text" placeholder="ID centro (opcional)" value="${esc(centroId)}">
            <label class="active" for="sc_centroId">Centro (ID, opcional)</label>
          </div>
          <div class="input-field col s12 m6">
            <input id="sc_centroCodigo" type="text" placeholder="Código centro (opcional)" value="${esc(centroCodigo)}">
            <label class="active" for="sc_centroCodigo">Código centro (opcional)</label>
          </div>
        </div>

        <div class="row">
          <div class="input-field col s12 m4">
            <input id="sc_periodo" type="month" value="${mm()}">
            <label class="active" for="sc_periodo">Periodo (YYYY-MM)</label>
          </div>
          <div class="input-field col s12 m4">
            <input id="sc_cantidad" type="number" step="0.01" min="0" placeholder="Ej: 120">
            <label class="active" for="sc_cantidad">Cantidad (ton)</label>
          </div>
          <div class="input-field col s12 m4">
            <input id="sc_responsable" type="text" placeholder="Responsable PG" value="${esc(responsablePG)}">
            <label class="active" for="sc_responsable">Responsable PG</label>
          </div>
        </div>

        <div class="input-field">
          <textarea id="sc_notas" class="materialize-textarea" placeholder="Notas (opcional)"></textarea>
          <label for="sc_notas">Notas (opcional)</label>
        </div>

        <div class="right-align" style="display:flex; gap:8px; justify-content:flex-end">
          <a class="btn-flat modal-close">Cancelar</a>
          <button id="sc_submit" class="btn" type="submit">
            <i class="material-icons left">save</i>Guardar
          </button>
        </div>
      </form>
    </div>
  `;

  // Materialize init/refresh
  if (window.M?.Modal){
    // Evita el warning de aria-hidden: asegúrate de quitarlo antes de abrir
    el.removeAttribute('aria-hidden');
    const inst = M.Modal.getInstance(el) || M.Modal.init(el, { endingTop: '5%' });
    inst.open();
  }

  // Submit
  const form = el.querySelector('#formSemi');
  form?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const payload = {
      proveedorNombre:  el.querySelector('#sc_proveedorNombre')?.value?.trim() || '',
      proveedorId:      el.querySelector('#sc_proveedorId')?.value?.trim() || '',
      centroId:         el.querySelector('#sc_centroId')?.value?.trim() || '',
      centroCodigo:     el.querySelector('#sc_centroCodigo')?.value?.trim() || '',
      periodo:          el.querySelector('#sc_periodo')?.value?.trim() || '',
      cantidadTon:      Number(el.querySelector('#sc_cantidad')?.value || 0),
      responsablePG:    el.querySelector('#sc_responsable')?.value?.trim() || '',
      notas:            el.querySelector('#sc_notas')?.value?.trim() || ''
    };

    if (!payload.proveedorId && !payload.proveedorNombre){
      M.toast?.({ html: 'Falta proveedor', classes: 'red' }); return;
    }
    if (!payload.periodo){ M.toast?.({ html: 'Falta período (YYYY-MM)', classes: 'red' }); return; }
    if (!payload.cantidadTon || payload.cantidadTon <= 0){
      M.toast?.({ html: 'Cantidad debe ser > 0', classes: 'red' }); return;
    }

    try{
      const res = await fetch(`${API_BASE}/semi-cerrados`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`POST /semi-cerrados ${res.status}`);
      M.toast?.({ html: 'Asignación registrada ✔', classes: 'teal' });

      // Cierra modal y notifica
      const inst = window.M?.Modal?.getInstance(el);
      inst?.close();
      document.dispatchEvent(new CustomEvent('semi:changed', { detail: { ok: true, item: payload }}));
    }catch(err){
      console.error('[semi] create error', err);
      M.toast?.({ html: 'No se pudo guardar', classes: 'red' });
    }
  });
}

// API pública
export function openSemiCerradoModal({ preset = null } = {}){
  // Si llega desde la fila, viene todo en preset → precarga
  renderModal({ preset });
}

// expone en window para que tabla.js lo llame
window.openSemiCerradoModal = openSemiCerradoModal;

// fallback: si alguien dispara el evento
document.addEventListener('semi:open', (ev) => {
  const preset = ev?.detail?.preset || null;
  openSemiCerradoModal({ preset });
});
