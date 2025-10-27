// modal.js — Interacciones (completo y corregido)
// - Autocomplete de contacto con /api/suggest/contactos?q=
// - Al pickear contacto: setea contactoId, proveedorNombre y proveedorKey
// - Fix: define esc() para evitar "esc is not defined"
// - Sin dependencias de /api/suggest/proveedores ni /api/contactos/:id/proveedores

import { create, update } from './api.js';

const RESPONSABLES = [
  'Claudio Alba',
  'Patricio Alvarez',
  'Carlos Avendaño',
];

/* ========= helpers comunes ========= */
function esc(s){
  return String(s ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
async function GET(url){
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
function ensureAutoStyles(){
  if (document.getElementById('auto-styles')) return;
  const s = document.createElement('style');
  s.id = 'auto-styles';
  s.textContent = `
    .autocomplete-menu{position:absolute;left:0;right:0;top:100%;margin-top:2px;display:none;max-height:260px;overflow:auto;}
    .autocomplete-menu .collection{border:none;box-shadow:none;}
    .autocomplete-menu .collection-item{border-bottom:1px solid #eee;}
    .autocomplete-menu .collection-item:hover{background:#f5f5f5;}
  `;
  document.head.appendChild(s);
}
function attachAutocomplete(inputEl, fetcher, onPick, { min = 2 } = {}){
  const field = inputEl.closest('.input-field') || inputEl.parentNode;
  field.style.position = field.style.position || 'relative';

  let box = document.createElement('div');
  box.className = 'autocomplete-menu card';
  field.appendChild(box);

  let last = '', timer = null;

  const close = () => { box.innerHTML=''; box.style.display='none'; };
  const open  = (html) => { box.innerHTML = html; box.style.display='block'; };

  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim();
    if (q === last) return;
    last = q;
    if (timer) clearTimeout(timer);
    if (q.length < min) { close(); return; }

    timer = setTimeout(async () => {
      let items = [];
      try { items = await fetcher(q); } catch { items = []; }
      if (!items || !items.length){ close(); return; }

      const html = items.map((it, idx) => `
        <a href="#" data-idx="${idx}" class="collection-item" style="display:block;padding:8px 12px">
          <div style="font-weight:700">${esc(it.label)}</div>
          ${it.sublabel ? `<div class="grey-text" style="font-size:12px">${esc(it.sublabel)}</div>` : ''}
        </a>`).join('');

      open(`<div class="collection" style="margin:0">${html}</div>`);

      box.querySelectorAll('a').forEach(a=>{
        a.addEventListener('click', (ev)=>{
          ev.preventDefault();
          const i = Number(a.getAttribute('data-idx'));
          const it = items[i];
          close();
          onPick && onPick(it);
        });
      });
    }, 160);
  });

  document.addEventListener('click', (e)=>{ if (!box.contains(e.target) && e.target!==inputEl) close(); });
}

/* ========= modal principal ========= */
export function openInteraccionModal({ preset = {}, onSaved } = {}){
  ensureAutoStyles();

  // crea/recicla modal
  const id = 'modal-interaccion';
  let modal = document.getElementById(id);
  if (!modal){
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  // HTML
  modal.innerHTML = `
    <div class="modal-content">
      <h5>${preset._id ? 'Editar' : 'Nueva'} interacción</h5>
      <div class="row">
        <div class="input-field col s12 m4">
          <input id="i-fecha" type="datetime-local">
          <label class="active" for="i-fecha">Fecha de la interacción</label>
        </div>

        <div class="input-field col s12 m4">
          <label class="active" for="i-tipo">Tipo</label>
          <select id="i-tipo" class="browser-default">
            <option value="llamada">Llamada</option>
            <option value="visita">Visita</option>
            <option value="muestra">Muestra</option>
            <option value="reunion">Reunión</option>
            <option value="tarea">Tarea</option>
          </select>
        </div>

        <div class="input-field col s12 m4">
          <label class="active" for="i-responsable">Responsable PG</label>
          <select id="i-responsable" class="browser-default"></select>
        </div>

        <div class="input-field col s12">
          <input id="i-contacto-nombre" placeholder="Nombre contacto" autocomplete="off">
          <label class="active" for="i-contacto-nombre">Contacto</label>
        </div>

        <div class="input-field col s12">
          <input id="i-proveedor-nombre" placeholder="Proveedor (se autocompleta al elegir contacto)" autocomplete="off">
          <label class="active" for="i-proveedor-nombre">Proveedor</label>
        </div>

        <div class="input-field col s12 m4">
          <input id="i-tons" type="number" min="0" step="1">
          <label class="active" for="i-tons">Tons conversadas (opcional)</label>
        </div>

        <div class="input-field col s12 m4">
          <input id="i-prox-paso" placeholder="Ej: Tomar muestras / Reunión">
          <label class="active" for="i-prox-paso">Próximo paso</label>
        </div>

        <div class="input-field col s12 m4">
          <input id="i-fecha-prox" type="datetime-local">
          <label class="active" for="i-fecha-prox">Fecha próximo paso</label>
        </div>

        <div class="input-field col s12 m4">
          <label class="active" for="i-estado">Estado</label>
          <select id="i-estado" class="browser-default">
            <option value="pendiente">Pendiente</option>
            <option value="agendado">Agendado</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <div class="input-field col s12">
          <textarea id="i-resumen" class="materialize-textarea" placeholder="Resumen/Observaciones"></textarea>
          <label class="active" for="i-resumen">Resumen</label>
        </div>

        <!-- Hidden para persistir ids/keys -->
        <input type="hidden" id="i-contacto-id">
        <input type="hidden" id="i-proveedor-key">
      </div>
    </div>
    <div class="modal-footer">
      <a class="modal-close btn-flat">Cancelar</a>
      <a id="i-save" class="btn">Guardar</a>
    </div>
  `;

  const inst = M.Modal.init(modal, { dismissible: true });
  inst.open();

  // Pinta opciones del select Responsable PG (sin escritura)
  const selResp = modal.querySelector('#i-responsable');
  selResp.innerHTML = `<option value=""></option>` +
    RESPONSABLES.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');

  // defaults
  const setVal = (sel,val) => { const el = modal.querySelector(sel); if (el) el.value = val ?? ''; };
  setVal('#i-fecha', toLocalDT(preset.fecha || new Date().toISOString()));
  setVal('#i-tipo',  preset.tipo || 'llamada');
  setVal('#i-responsable', matchResp(preset.responsable));
  setVal('#i-contacto-nombre', preset.contactoNombre || '');
  setVal('#i-proveedor-nombre', preset.proveedorNombre || '');
  setVal('#i-tons', preset.tonsConversadas ?? '');
  setVal('#i-prox-paso', preset.proximoPaso || '');
  setVal('#i-fecha-prox', toLocalDT(preset.fechaProx || ''));
  setVal('#i-estado', preset.estado || 'pendiente');
  setVal('#i-resumen', preset.resumen || '');
  setVal('#i-contacto-id', preset.contactoId || '');
  setVal('#i-proveedor-key', preset.proveedorKey || '');

  // ====== AUTOCOMPLETE (CONTACTO) ======
  const elContacto   = modal.querySelector('#i-contacto-nombre');
  const elProveedor  = modal.querySelector('#i-proveedor-nombre');
  const elContactoId = modal.querySelector('#i-contacto-id');
  const elProvKey    = modal.querySelector('#i-proveedor-key');

  // guardamos selección concreta
  let picked = {
    contactoId:  preset.contactoId || null,
    proveedorKey: preset.proveedorKey || null
  };

  attachAutocomplete(
    elContacto,
    async (q) => {
      // Espera items de /api/suggest/contactos en formato:
      // { contactoId, contactoNombre, email, telefono, empresas:[{proveedorKey,nombre,...}], label }
      const base = (window.API_BASE || '/api');
      const { items = [] } = await GET(`${base}/suggest/contactos?q=${encodeURIComponent(q)}`);
      return items.map(it => ({
        value: it.contactoNombre || '',
        label: it.label || it.contactoNombre || '',
        sublabel: (it.email || it.telefono || '') + (it.empresas?.[0]?.nombre ? ` · ${it.empresas[0].nombre}` : ''),
        meta: it
      }));
    },
    (it) => {
      elContacto.value = it.value;
      picked.contactoId = it.meta.contactoId || null;
      elContactoId.value = picked.contactoId || '';

      // Si el contacto trae empresas asociadas, usamos la primera por defecto
      const empresa = (it.meta.empresas && it.meta.empresas[0]) || null;
      if (empresa){
        elProveedor.value = empresa.nombre || '';
        picked.proveedorKey = empresa.proveedorKey || empresa.empresaKey || null;
        elProvKey.value = picked.proveedorKey || '';
      } else {
        // limpiamos si no hay
        elProveedor.value = '';
        picked.proveedorKey = null;
        elProvKey.value = '';
      }
    },
    { min: 2 }
  );

  // Guardar
  modal.querySelector('#i-save').addEventListener('click', async () => {
    const payload = {
      tipo: val('#i-tipo','llamada'),
      fecha: fromLocalDT(val('#i-fecha')),
      responsable: matchResp(val('#i-responsable')) || '',
      contactoNombre: val('#i-contacto-nombre'),
      proveedorNombre: val('#i-proveedor-nombre'),
      tonsConversadas: num(val('#i-tons')),
      proximoPaso: val('#i-prox-paso'),
      fechaProx: fromLocalDT(val('#i-fecha-prox')),
      estado: val('#i-estado','pendiente'),
      resumen: val('#i-resumen'),

      // IDs/keys solo si el usuario eligió una sugerencia (o venían en preset)
      contactoId: picked.contactoId || preset.contactoId || null,
      proveedorKey: picked.proveedorKey || preset.proveedorKey || null,

      // from preset (si venían)
      centroId: preset.centroId || null,
      centroCodigo: preset.centroCodigo || null,
      comuna: preset.comuna || null,
      areaCodigo: preset.areaCodigo || null,
    };

    try {
      if (preset._id) await update(preset._id, payload);
      else await create(payload);
      M.toast({ html:'Interacción guardada', displayLength:1500 });
      M.Modal.getInstance(modal)?.close();
      onSaved && onSaved();
    } catch (e) {
      console.error(e);
      M.toast({ html:'Error al guardar', classes:'red' });
    }
  });

  // ===== helpers locales =====
  function val(sel, def=''){ const el = modal.querySelector(sel); return el ? (el.value ?? def) : def; }
  function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
  function toLocalDT(iso){
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fromLocalDT(local){
    if (!local) return null;
    const d = new Date(local);
    return d.toISOString();
  }
  function matchResp(valStr){
    const v = String(valStr||'').trim();
    return RESPONSABLES.find(r => r.toLowerCase() === v.toLowerCase()) || '';
  }
}
