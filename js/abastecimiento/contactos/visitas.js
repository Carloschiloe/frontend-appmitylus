import { apiGetVisitasByContacto, apiCreateVisita } from '/js/core/api.js';
import { state, $, setVal, slug } from './state.js';
import { normalizeVisitas, centroCodigoById } from './normalizers.js';

function comunasDelProveedor(proveedorKey) {
  const key = proveedorKey?.length ? proveedorKey : null;
  const comunas = new Set();
  for (const c of state.listaCentros) {
    const k = c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor||'');
    if (!key || k === key) {
      const comuna = (c.comuna || '').trim();
      if (comuna) comunas.add(comuna);
    }
  }
  return Array.from(comunas);
}

function miniTimelineHTML(visitas = []) {
  if (!visitas.length) return '<div class="text-soft">Sin visitas registradas</div>';
  const filas = visitas.slice(0,3).map(v => {
    const code = v.centroCodigo || centroCodigoById(v.centroId) || '-';
    return `
      <div class="row" style="margin-bottom:.35rem">
        <div class="col s4"><strong>${(v.fecha||'').slice(0,10)}</strong></div>
        <div class="col s4">${code}</div>
        <div class="col s4">${v.estado || '-'}</div>
        <div class="col s12"><span class="text-soft">${v.tonsComprometidas ? (v.tonsComprometidas + ' t • ') : ''}${v.observaciones || ''}</span></div>
      </div>
    `;
  }).join('');
  return filas + `<a class="btn btn--ghost" id="btnVerVisitas">Ver todas</a>`;
}

export async function abrirDetalleContacto(c) {
  const body = $('#detalleContactoBody'); if (!body) return;

  const f = new Date(c.createdAt || c.fecha || Date.now());
  const fechaFmt = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')} ${String(f.getHours()).padStart(2,'0')}:${String(f.getMinutes()).padStart(2,'0')}`;

  const comunas = comunasDelProveedor(c.proveedorKey || slug(c.proveedorNombre||''));
  const chips = comunas.length
    ? comunas.map(x => `<span class="badge chip" style="margin-right:.35rem;margin-bottom:.35rem">${x}</span>`).join('')
    : '<span class="text-soft">Sin centros asociados</span>';

  const visitas = normalizeVisitas(await apiGetVisitasByContacto(c._id));

  body.innerHTML = `
    <div class="mb-4">
      <h6 class="text-soft" style="margin:0 0 .5rem">Comunas con centros del proveedor</h6>
      ${chips}
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div><strong>Fecha:</strong> ${fechaFmt}</div>
      <div><strong>Proveedor:</strong> ${c.proveedorNombre || ''}</div>
      <div><strong>Centro:</strong> ${c.centroCodigo || '-'}</div>
      <div><strong>Disponibilidad:</strong> ${c.tieneMMPP || '-'}</div>
      <div><strong>Fecha Disp.:</strong> ${c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '-'}</div>
      <div><strong>Disposición:</strong> ${c.dispuestoVender || '-'}</div>
      <div><strong>Tons aprox.:</strong> ${(c.tonsDisponiblesAprox ?? '') + ''}</div>
      <div><strong>Vende a:</strong> ${c.vendeActualmenteA || '-'}</div>
      <div style="grid-column:1/-1;"><strong>Notas:</strong> ${c.notas || '<span class="text-soft">Sin notas</span>'}</div>
      <div style="grid-column:1/-1;"><strong>Contacto:</strong>
        ${[c.contactoNombre, c.contactoTelefono, c.contactoEmail].filter(Boolean).join(' • ') || '-'}</div>
    </div>

    <div class="mb-4" style="margin-top:1rem;">
      <h6 class="text-soft" style="margin:0 0 .5rem">Últimas visitas</h6>
      ${miniTimelineHTML(visitas)}
    </div>

    <div class="right-align">
      <button class="btn teal" id="btnNuevaVisita" data-id="${c._id}">
        <i class="material-icons left">event_available</i>Registrar visita
      </button>
    </div>
  `;

  $('#btnNuevaVisita')?.addEventListener('click', () => abrirModalVisita(c));

  const inst = M.Modal.getInstance(document.getElementById('modalDetalleContacto')) || M.Modal.init(document.getElementById('modalDetalleContacto'));
  inst.open();
}

export function abrirModalVisita(contacto) {
  setVal(['visita_proveedorId'], contacto._id);
  const proveedorKey = contacto.proveedorKey || slug(contacto.proveedorNombre || '');

  const selectVisita = $('#visita_centroId');
  if (selectVisita) {
    const centros = state.listaCentros.filter(c => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor||'')) === proveedorKey);
    let options = `<option value="">Centro visitado (opcional)</option>`;
    options += centros.map(c => `
      <option value="${c._id || c.id}" data-code="${c.code || c.codigo || ''}">
        ${(c.code || c.codigo || '')} – ${(c.comuna||'s/comuna')}
      </option>`).join('');
    selectVisita.innerHTML = options;
  }

  const modalVisita = M.Modal.getInstance(document.getElementById('modalVisita')) || M.Modal.init(document.getElementById('modalVisita'));
  modalVisita.open();
}

export function setupFormularioVisita() {
  const form = $('#formVisita'); if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contactoId = $('#visita_proveedorId').value;

    const selCentro = $('#visita_centroId');
    const centroId = selCentro?.value || null;
    const centroCodigo = selCentro?.selectedOptions?.[0]?.dataset?.code || (centroId ? centroCodigoById(centroId) : null);

    const payload = {
      contactoId,
      fecha: $('#visita_fecha').value,
      centroId,
      centroCodigo, // clave para mostrar bien
      contacto: $('#visita_contacto').value || null,
      enAgua: $('#visita_enAgua').value || null,
      tonsComprometidas: $('#visita_tonsComprometidas').value ? Number($('#visita_tonsComprometidas').value) : null,
      estado: $('#visita_estado').value || 'Realizada',
      observaciones: $('#visita_observaciones').value || null
    };

    try {
      await apiCreateVisita(payload);
      M.toast?.({ html: 'Visita guardada', classes: 'teal', displayLength: 1800 });

      const modalVisita = M.Modal.getInstance(document.getElementById('modalVisita'));
      modalVisita?.close();
      form.reset();
    } catch (e2) {
      console.warn('apiCreateVisita aún no disponible:', e2?.message || e2);
      M.toast?.({ html: 'Visitas aún no disponible (backend)', displayLength: 2200 });
      const modalVisita = M.Modal.getInstance(document.getElementById('modalVisita'));
      modalVisita?.close();
    }
  });
}
