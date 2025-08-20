// /js/abastecimiento/contactos/visitas.js
import {
  apiGetVisitas,
  apiGetVisitasByContacto,
  apiCreateVisita,
  apiDeleteVisita,          // ✅ eliminar visitas
} from '/js/core/api.js';
import { state, $, setVal, slug } from './state.js';

// ✅ usa el normalizer de la carpeta VISITAS (no el de contactos)
import { normalizeVisita, centroCodigoById } from '../visitas/normalizers.js';
const normalizeVisitas = (arr) => (Array.isArray(arr) ? arr.map(normalizeVisita) : []);

/* ---------------- estilos: achicar Observaciones + ellipsis ---------------- */
(function injectVisitasStyles(){
  if (document.getElementById('visitas-inline-styles')) return;
  const s = document.createElement('style');
  s.id = 'visitas-inline-styles';
  s.textContent = `
    #tablaVisitas td .ellipsisObs{
      display:inline-block; max-width:46ch; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      vertical-align:middle;
    }
  `;
  document.head.appendChild(s);
})();

/* ---------------- utils locales ---------------- */
const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const fmtISO = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const trunc = (s = '', max = 42) => {
  const t = String(s);
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
};

// busca proveedorNombre desde contactos ya cargados
function proveedorDeVisita(v) {
  const id = v.contactoId ? String(v.contactoId) : null;
  if (!id) return '';
  const c = (state.contactosGuardados || []).find((x) => String(x._id) === id);
  return c?.proveedorNombre || '';
}

function codigoDeVisita(v) {
  return v.centroCodigo || (v.centroId ? centroCodigoById(v.centroId) : '') || '';
}

/* --------------- DataTable Visitas --------------- */
let dtV = null;

export async function initVisitasTab(forceReload = false) {
  const jq = window.jQuery || window.$;
  const tabla = $('#tablaVisitas');
  if (!tabla) return;

  // Si ya existe la tabla y piden refrescar, sólo recargamos datos
  if (dtV && forceReload) {
    await renderTablaVisitas();
    // aseguramos renombrar encabezado
    const ths = tabla?.querySelectorAll('thead th');
    if (ths?.[3]) ths[3].textContent = 'Muestra';
    return;
  }

  if (jq && !dtV) {
    dtV = jq('#tablaVisitas').DataTable({
      dom: 'Blfrtip',
      buttons: [
        { extend: 'excelHtml5', title: 'Visitas_Abastecimiento' },
        {
          extend: 'pdfHtml5',
          title: 'Visitas_Abastecimiento',
          orientation: 'landscape',
          pageSize: 'A4',
        },
      ],
      order: [[0, 'desc']],
      paging: true,
      pageLength: 10,
      lengthMenu: [[10, 25, 50, -1],[10, 25, 50, 'Todos']],
      autoWidth: false,
      language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      columnDefs: [
        { targets: 0, width: '110px' },  // Fecha
        { targets: 1, width: '280px' },  // Proveedor
        { targets: 2, width: '100px' },  // Centro
        { targets: 3, width: '110px' },  // Muestra (antes Actividad)
        { targets: 4, width: '170px' },  // Próximo paso
        { targets: 5, width: '80px', className: 'dt-body-right' }, // Tons
        { targets: 6, width: '440px' },  // Observaciones (más angosta)
        { targets: -1, orderable: false, searchable: false, width: '120px' } // Acciones
      ]
    });

    // Cambiar encabezado "Actividad" → "Muestra"
    const ths = tabla?.querySelectorAll('thead th');
    if (ths?.[3]) ths[3].textContent = 'Muestra';

    // acciones en filas (delegadas)
    jq('#tablaVisitas tbody')
      .on('click', 'a.v-ver', function () {
        const contactoId = this.dataset.contactoId;
        const c = (state.contactosGuardados || []).find(
          (x) => String(x._id) === String(contactoId),
        );
        if (c) abrirDetalleContacto(c);
      })
      .on('click', 'a.v-nueva', function () {
        const contactoId = this.dataset.contactoId;
        const c = (state.contactosGuardados || []).find(
          (x) => String(x._id) === String(contactoId),
        );
        if (c) abrirModalVisita(c);
      })
      // ✅ eliminar visita
      .on('click', 'a.v-eliminar', async function(){
        const id = this.dataset.id;
        if (!id) return;
        if (!confirm('¿Eliminar esta visita?')) return;
        try {
          await apiDeleteVisita(id);
          M.toast?.({ html: 'Visita eliminada' });
          await renderTablaVisitas(); // refresca en tiempo real
        } catch (e) {
          console.error(e);
          M.toast?.({ html: 'No se pudo eliminar', classes: 'red' });
        }
      });
  }

  await renderTablaVisitas();

  // si se crea una visita desde el modal, refresca tabla
  window.addEventListener('visita:created', async () => {
    await renderTablaVisitas();
  });
}

/* carga y pinta la tabla */
export async function renderTablaVisitas() {
  const jq = window.jQuery || window.$;

  // Trae todas las visitas del backend
  let visitas = [];
  try {
    const raw = await apiGetVisitas();
    visitas = normalizeVisitas(Array.isArray(raw) ? raw : raw?.items || []);
  } catch (e) {
    console.error('[visitas] apiGetVisitas error:', e?.message || e);
    visitas = [];
  }

  // arma filas
  const filas = visitas
    .slice()
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
    .map((v) => {
      const fecha = fmtISO(v.fecha);
      const proveedor = proveedorDeVisita(v);
      const proveedorHTML = proveedor
        ? `<span title="${esc(proveedor)}">${esc(trunc(proveedor, 36))}</span>`
        : '<span class="text-soft">—</span>';

      const centro = codigoDeVisita(v);
      const actividad = v.enAgua || '';
      const proximoPaso = v.estado || '';
      const tons = (v.tonsComprometidas ?? '') + '';
      const obs = v.observaciones || '';
      const obsHTML = obs
        ? `<span class="ellipsisObs" title="${esc(obs)}">${esc(trunc(obs, 56))}</span>`
        : '—';

      const acciones = `
        <a href="#!" class="v-ver"   title="Ver detalle del proveedor" data-contacto-id="${esc(v.contactoId || '')}">
          <i class="material-icons">visibility</i>
        </a>
        <a href="#!" class="v-nueva" title="Registrar nueva visita" data-contacto-id="${esc(v.contactoId || '')}">
          <i class="material-icons">event_available</i>
        </a>
        <a href="#!" class="v-eliminar" title="Eliminar visita" data-id="${esc(v._id || '')}">
          <i class="material-icons">delete</i>
        </a>
      `;

      return [
        `<span data-order="${new Date(v.fecha || 0).getTime()}">${fecha || ''}</span>`,
        proveedorHTML,
        esc(centro),
        esc(actividad),
        esc(proximoPaso),
        esc(tons),
        obsHTML,
        acciones,
      ];
    });

  // pinta con DataTables si está activo
  if (dtV && jq) {
    dtV.clear();
    dtV.rows.add(filas).draw();
    return;
  }

  // fallback sin DataTables
  const tbody = $('#tablaVisitas tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!filas.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="color:#888">No hay visitas registradas.</td></tr>';
    return;
  }
  filas.forEach((arr) => {
    const tr = document.createElement('tr');
    tr.innerHTML = arr.map((td) => `<td>${td}</td>`).join('');
    tbody.appendChild(tr);
  });
}

/* ---------------------- Detalle + modal visitas ---------------------- */
function comunasDelProveedor(proveedorKey) {
  const key = proveedorKey?.length ? proveedorKey : null;
  const comunas = new Set();
  for (const c of state.listaCentros) {
    const k = c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '');
    if (!key || k === key) {
      const comuna = (c.comuna || '').trim();
      if (comuna) comunas.add(comuna);
    }
  }
  return Array.from(comunas);
}

function miniTimelineHTML(visitas = []) {
  if (!visitas.length) return '<div class="text-soft">Sin visitas registradas</div>';
  const filas = visitas
    .slice(0, 3)
    .map((v) => {
      const code = v.centroCodigo || centroCodigoById(v.centroId) || '-';
      return `
      <div class="row" style="margin-bottom:.35rem">
        <div class="col s4"><strong>${(v.fecha || '').slice(0, 10)}</strong></div>
        <div class="col s4">${code}</div>
        <div class="col s4">${v.estado || '-'}</div>
        <div class="col s12"><span class="text-soft">${v.tonsComprometidas ? v.tonsComprometidas + ' t • ' : ''}${esc(v.observaciones || '')}</span></div>
      </div>
    `;
    })
    .join('');
  return filas + `<a class="btn btn--ghost" id="btnVerVisitas">Ver todas</a>`;
}

export async function abrirDetalleContacto(c) {
  const body = $('#detalleContactoBody');
  if (!body) return;

  const f = new Date(c.createdAt || c.fecha || Date.now());
  const fechaFmt = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')} ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`;

  const comunas = comunasDelProveedor(c.proveedorKey || slug(c.proveedorNombre || ''));
  const chips = comunas.length
    ? comunas.map((x) => `<span class="badge chip" style="margin-right:.35rem;margin-bottom:.35rem">${esc(x)}</span>`).join('')
    : '<span class="text-soft">Sin centros asociados</span>';

  const visitas = normalizeVisitas(await apiGetVisitasByContacto(c._id));

  body.innerHTML = `
    <div class="mb-4">
      <h6 class="text-soft" style="margin:0 0 .5rem">Comunas con centros del proveedor</h6>
      ${chips}
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div><strong>Fecha:</strong> ${fechaFmt}</div>
      <div><strong>Proveedor:</strong> ${esc(c.proveedorNombre || '')}</div>
      <div><strong>Centro:</strong> ${esc(c.centroCodigo || '-')}</div>
      <div><strong>Disponibilidad:</strong> ${esc(c.tieneMMPP || '-')}</div>
      <div><strong>Fecha Disp.:</strong> ${c.fechaDisponibilidad ? ('' + c.fechaDisponibilidad).slice(0, 10) : '-'}</div>
      <div><strong>Disposición:</strong> ${esc(c.dispuestoVender || '-')}</div>
      <div><strong>Tons aprox.:</strong> ${(c.tonsDisponiblesAprox ?? '') + ''}</div>
      <div><strong>Vende a:</strong> ${esc(c.vendeActualmenteA || '-')}</div>
      <div style="grid-column:1/-1;"><strong>Notas:</strong> ${c.notas ? esc(c.notas) : '<span class="text-soft">Sin notas</span>'}</div>
      <div style="grid-column:1/-1;"><strong>Contacto:</strong>
        ${[c.contactoNombre, c.contactoTelefono, c.contactoEmail].filter(Boolean).map(esc).join(' • ') || '-'}</div>
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

  const inst =
    M.Modal.getInstance(document.getElementById('modalDetalleContacto')) ||
    M.Modal.init(document.getElementById('modalDetalleContacto'));
  inst.open();
}

export function abrirModalVisita(contacto) {
  setVal(['visita_proveedorId'], contacto._id);
  const proveedorKey = contacto.proveedorKey || slug(contacto.proveedorNombre || '');

  const selectVisita = $('#visita_centroId');
  if (selectVisita) {
    const centros = state.listaCentros.filter(
      (c) => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '')) === proveedorKey,
    );
    let options = `<option value="">Centro visitado (opcional)</option>`;
    options += centros
      .map(
        (c) => `
      <option value="${c._id || c.id}" data-code="${c.code || c.codigo || ''}">
        ${(c.code || c.codigo || '')} – ${(c.comuna || 's/comuna')}
      </option>`,
      )
      .join('');
    selectVisita.innerHTML = options;
  }

  const modalVisita =
    M.Modal.getInstance(document.getElementById('modalVisita')) ||
    M.Modal.init(document.getElementById('modalVisita'));
  modalVisita.open();
}

export function setupFormularioVisita() {
  const form = $('#formVisita');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contactoId = $('#visita_proveedorId').value;

    const selCentro = $('#visita_centroId');
    const centroId = selCentro?.value || null;
    const centroCodigo =
      selCentro?.selectedOptions?.[0]?.dataset?.code ||
      (centroId ? centroCodigoById(centroId) : null);

    const payload = {
      contactoId,
      fecha: $('#visita_fecha').value,
      centroId,
      centroCodigo,
      contacto: $('#visita_contacto').value || null,
      enAgua: $('#visita_enAgua').value || null,
      tonsComprometidas: $('#visita_tonsComprometidas').value
        ? Number($('#visita_tonsComprometidas').value)
        : null,
      estado: $('#visita_estado').value || 'Programar nueva visita',
      observaciones: $('#visita_observaciones').value || null,
    };

    try {
      const nueva = await apiCreateVisita(payload);

      // notifica y refresca tabla
      window.dispatchEvent(
        new CustomEvent('visita:created', { detail: { visita: nueva, contactoId } }),
      );
      M.toast?.({ html: 'Visita guardada', classes: 'teal', displayLength: 1800 });

      const modalVisita = M.Modal.getInstance(document.getElementById('modalVisita'));
      modalVisita?.close();
      form.reset();
    } catch (e2) {
      console.warn('apiCreateVisita error:', e2?.message || e2);
      M.toast?.({ html: 'No se pudo guardar la visita', displayLength: 2200, classes: 'red' });
    }
  });
}
