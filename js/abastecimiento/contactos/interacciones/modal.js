import { create, update } from './api.js';

export function openInteraccionModal({ preset = {}, onSaved } = {}){
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
          <label class="active" for="i-fecha">Fecha de la interacción</label>
        </div>

        <div class="input-field col s12 m4">
          <select id="i-tipo" class="browser-default">
            <option value="llamada">Llamada</option>
            <option value="visita">Visita</option>
            <option value="muestra">Muestra</option>
            <option value="reunion">Reunión</option>
            <option value="tarea">Tarea</option>
          </select>
          <label class="active" for="i-tipo" style="transform:translateY(-18px);display:block;font-size:12px;color:#666">Tipo</label>
        </div>

        <div class="input-field col s12 m4">
          <input id="i-responsable" placeholder="Responsable PG">
          <label class="active" for="i-responsable">Responsable PG</label>
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
          <input id="i-tons" type="number" min="0" step="0.01">
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
          <select id="i-estado" class="browser-default">
            <option value="pendiente">Pendiente</option>
            <option value="agendado">Agendado</option>
            <option value="hecho">Hecho</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <label class="active" for="i-estado" style="transform:translateY(-18px);display:block;font-size:12px;color:#666">Estado</label>
        </div>

        <div class="input-field col s12">
          <textarea id="i-resumen" class="materialize-textarea" placeholder="Hallazgos, acuerdos, observaciones"></textarea>
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
  const setVal = (sel,val) => { const el = modal.querySelector(sel); if (el) el.value = (val ?? ''); };

  // fecha interacción: ahora si no viene
  const fechaBaseISO = preset.fecha || new Date().toISOString();
  setVal('#i-fecha', toLocalDT(fechaBaseISO));

  setVal('#i-tipo',  preset.tipo || 'llamada');
  setVal('#i-responsable', preset.responsable || '');
  setVal('#i-contacto-nombre', preset.contactoNombre || '');
  setVal('#i-proveedor-nombre', preset.proveedorNombre || '');
  setVal('#i-tons', preset.tonsConversadas ?? '');

  // próximo paso: prioriza proximoPasoFecha, admite legacy fechaProx
  const proxISO = preset.proximoPasoFecha || preset.fechaProx || '';
  setVal('#i-prox-paso', preset.proximoPaso || '');
  setVal('#i-fecha-prox', toLocalDT(proxISO));

  // estado canónico
  const est = (preset.estado === 'completado') ? 'hecho' : (preset.estado || 'pendiente');
  setVal('#i-estado', est);

  setVal('#i-resumen', preset.resumen || '');

  modal.querySelector('#i-save').addEventListener('click', async () => {
    // normaliza estado si el usuario lo cambió a completado por costumbre
    const estadoSel = val('#i-estado','pendiente');
    const estado = (estadoSel === 'completado') ? 'hecho' : estadoSel;

    const payload = {
      tipo: val('#i-tipo','llamada'),
      fecha: fromLocalDT(val('#i-fecha')),

      responsable: val('#i-responsable'),
      contactoNombre: val('#i-contacto-nombre'),
      proveedorNombre: val('#i-proveedor-nombre'),

      tonsConversadas: num(val('#i-tons')),

      proximoPaso: val('#i-prox-paso'),
      proximoPasoFecha: fromLocalDT(val('#i-fecha-prox')), // <-- nombre definitivo
      estado,
      resumen: val('#i-resumen'),

      // preservar llaves que vengan en preset
      contactoId: preset.contactoId ?? null,
      proveedorKey: preset.proveedorKey ?? null,
      centroId: preset.centroId ?? null,
      centroCodigo: preset.centroCodigo ?? null,
      comuna: preset.comuna ?? null,
      areaCodigo: preset.areaCodigo ?? null
    };

    // compat: si alguien del backend aún lee fechaProx, la incluimos
    if (payload.proximoPasoFecha && !preset.fechaProx) {
      payload.fechaProx = payload.proximoPasoFecha;
    }

    try {
      if (preset._id) await update(preset._id, payload);
      else await create(payload);
      M.toast({ html:'Interacción guardada', displayLength:1500 });
      inst.close();
      onSaved && onSaved();
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
    if (isNaN(d)) return '';
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    // segundos no los mostramos para no ensuciar el input
  }
  function fromLocalDT(local){
    if (!local) return null;
    const d = new Date(local);
    return isNaN(d) ? null : d.toISOString();
  }
}
