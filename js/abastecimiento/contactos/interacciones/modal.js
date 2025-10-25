import { create, update } from './api.js';

export function openInteraccionModal({ preset = {}, onSaved } = {}){
  // Crea modal básico (Materialize compa)
  const id = 'modal-interaccion';
  let modal = document.getElementById(id);
  if (!modal){
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="modal-content">
      <h5>${preset._id ? 'Editar' : 'Nueva'} interacción</h5>
      <div class="row">
        <div class="input-field col s12 m4">
          <input id="i-fecha" type="datetime-local">
          <label class="active" for="i-fecha">Fecha llamada</label>
        </div>
        <div class="input-field col s12 m4">
          <select id="i-tipo" class="browser-default">
            <option value="llamada">Llamada</option>
            <option value="visita">Visita</option>
            <option value="muestra">Muestra</option>
            <option value="reunion">Reunión</option>
            <option value="tarea">Tarea</option>
          </select>
        </div>
        <div class="input-field col s12 m4">
          <input id="i-responsable" placeholder="Responsable">
          <label class="active" for="i-responsable">Responsable</label>
        </div>

        <div class="input-field col s12">
          <input id="i-contacto-nombre" placeholder="Nombre contacto">
          <label class="active" for="i-contacto-nombre">Contacto</label>
        </div>
        <div class="input-field col s12">
          <input id="i-proveedor-nombre" placeholder="Proveedor">
          <label class="active" for="i-proveedor-nombre">Proveedor</label>
        </div>

        <div class="input-field col s12 m4">
          <input id="i-tons" type="number" min="0" step="1">
          <label class="active" for="i-tons">Tons conversadas (opcional)</label>
        </div>

        <div class="input-field col s12 m4">
          <input id="i-prox-paso" placeholder="Próximo paso (ej. visita)">
          <label class="active" for="i-prox-paso">Próximo paso</label>
        </div>
        <div class="input-field col s12 m4">
          <input id="i-fecha-prox" type="datetime-local">
          <label class="active" for="i-fecha-prox">Fecha próximo paso</label>
        </div>

        <div class="input-field col s12 m4">
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
      </div>
    </div>
    <div class="modal-footer">
      <a class="modal-close btn-flat">Cancelar</a>
      <a id="i-save" class="btn">Guardar</a>
    </div>
  `;

  const inst = M.Modal.init(modal, { dismissible: true });
  inst.open();

  // defaults
  const setVal = (sel,val) => { const el = modal.querySelector(sel); if (el) el.value = val ?? ''; };
  setVal('#i-fecha', toLocalDT(preset.fecha || new Date().toISOString()));
  setVal('#i-tipo',  preset.tipo || 'llamada');
  setVal('#i-responsable', preset.responsable || '');
  setVal('#i-contacto-nombre', preset.contactoNombre || '');
  setVal('#i-proveedor-nombre', preset.proveedorNombre || '');
  setVal('#i-tons', preset.tonsConversadas ?? '');
  setVal('#i-prox-paso', preset.proximoPaso || '');
  setVal('#i-fecha-prox', toLocalDT(preset.fechaProx || ''));
  setVal('#i-estado', preset.estado || 'pendiente');
  setVal('#i-resumen', preset.resumen || '');

  modal.querySelector('#i-save').addEventListener('click', async () => {
    const payload = {
      tipo: val('#i-tipo','llamada'),
      fecha: fromLocalDT(val('#i-fecha')),
      responsable: val('#i-responsable'),
      contactoNombre: val('#i-contacto-nombre'),
      proveedorNombre: val('#i-proveedor-nombre'),
      tonsConversadas: num(val('#i-tons')),
      proximoPaso: val('#i-prox-paso'),
      fechaProx: fromLocalDT(val('#i-fecha-prox')),
      estado: val('#i-estado','pendiente'),
      resumen: val('#i-resumen'),
      // Nota: si tienes contactoId/proveedorKey desde la fila, pásalos en `preset` y los mantenemos:
      contactoId: preset.contactoId || null,
      proveedorKey: preset.proveedorKey || null,
      centroId: preset.centroId || null,
      centroCodigo: preset.centroCodigo || null,
      comuna: preset.comuna || null,
      areaCodigo: preset.areaCodigo || null,
    };

    try {
      if (preset._id) await update(preset._id, payload);
      else await create(payload);
      M.toast({ html:'Interacción guardada', displayLength:1500 });
      inst.close();
      if (onSaved) onSaved();
    } catch (e) {
      console.error(e);
      M.toast({ html:'Error al guardar', classes:'red' });
    }
  });

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
    // Se asume zona local; guarda como ISO
    const d = new Date(local);
    return d.toISOString();
  }
}
