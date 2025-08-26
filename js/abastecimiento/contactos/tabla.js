// /js/contactos/tabla.js
import { state, $ } from './state.js';
import { centroCodigoById, comunaPorCodigo } from './normalizers.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto, abrirModalVisita } from '../visitas/tab.js';

/* ---------- estilos: columna proveedor angosta + ellipsis + click seguro ---------- */
(function injectStyles () {
  const css = `
    #tablaContactos td .ellipsisCell{
      display:inline-block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; vertical-align:middle;
    }
    #tablaContactos td .ellipsisProv{ max-width:26ch; }

    /* clicks seguros en acciones */
    #tablaContactos td:last-child a.icon-action { 
      pointer-events:auto; cursor:pointer; display:inline-block; margin:0 6px;
    }
    #tablaContactos td:last-child a.icon-action i.material-icons{
      pointer-events:none; font-size:18px; vertical-align:middle;
    }
  `;
  if (!document.getElementById('tabla-contactos-inline-styles')) {
    const s = document.createElement('style');
    s.id = 'tabla-contactos-inline-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();

/* -------------------- helpers locales (solo UI, no escriben BD) -------------------- */
const esc = (s='') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const esCodigoValido = (x) => /^\d{4,7}$/.test(String(x || ''));

/* ===== handler único expuesto para fallback inline ===== */
function _clickAccContacto(aEl){
  try{
    const id = aEl?.dataset?.id;
    const cls = (aEl?.className || '').toLowerCase();
    console.log('[contactos] click inline →', cls, 'id=', id);

    const c = state.contactosGuardados.find(x => String(x._id) === String(id));
    if (!c) {
      M.toast?.({ html: 'Contacto no encontrado', classes: 'red' });
      return;
    }

    if (cls.includes('ver')) return abrirDetalleContacto(c);
    if (cls.includes('visita')) return abrirModalVisita(c);
    if (cls.includes('editar')) return abrirEdicion(c);
    if (cls.includes('eliminar')) {
      if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
      eliminarContacto(id).catch(e => {
        console.error(e);
        M.toast?.({ html: 'No se pudo eliminar', classes: 'red' });
      });
    }
  }catch(err){
    console.error('[contactos] error en _clickAccContacto', err);
  }
}
window._clickAccContacto = _clickAccContacto;

/* --------------------------------- DataTables --------------------------------- */
export function initTablaContactos() {
  const jq = window.jQuery || window.$;
  const tablaEl = $('#tablaContactos');
  if (!jq || !tablaEl) return;
  if (state.dt) return;

  state.dt = jq('#tablaContactos').DataTable({
    dom: 'Blfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Contactos_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Contactos_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[0,'desc']],
    paging: true,
    pageLength: 10,
    lengthMenu: [ [10, 25, 50, -1], [10, 25, 50, 'Todos'] ],
    autoWidth: false,
    responsive: true,
    scrollX: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: 0, width: '110px' },
      { targets: 1, width: '260px' },
      { targets: -1, orderable: false, searchable: false }
    ]
  });

  // Delegación de acciones (bubbling)
  jq('#tablaContactos tbody')
    .off('click.contactos')
    .on('click.contactos', 'a.icon-action', function(e){
      e.preventDefault();
      console.log('[contactos] delegación →', this.className, 'id=', this.dataset.id);
      _clickAccContacto(this);
    });

  console.log('[contactos] DataTable lista. filas=', state.dt.rows().count());
}

/* ------------------------------- Render de filas -------------------------------- */
export function renderTablaContactos() {
  const jq = window.jQuery || window.$;
  const tabla = $('#tablaContactos');
  if (!tabla) return;

  const base = Array.isArray(state.contactosGuardados) ? state.contactosGuardados : [];
  console.debug('[tablaContactos] render → items:', base.length, base[0]);

  const filas = base
    .slice()
    .sort((a,b)=>{
      const da = new Date(a.createdAt || a.fecha || 0).getTime();
      const db = new Date(b.createdAt || b.fecha || 0).getTime();
      return db - da;
    })
    .map(c => {
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const yyyy = f.getFullYear();
      const mm   = String(f.getMonth() + 1).padStart(2, '0');
      const dd   = String(f.getDate()).padStart(2, '0');
      const whenDisplay = `${yyyy}-${mm}-${dd}`;
      const whenKey     = f.getTime();

      let centroCodigo = c.centroCodigo;
      if (!esCodigoValido(centroCodigo)) {
        centroCodigo = centroCodigoById(c.centroId) || '';
      }

      const comuna = c.centroComuna || c.comuna || comunaPorCodigo(centroCodigo) || '';
      const provName = esc(c.proveedorNombre || '');
      const provCell = provName
        ? `<span class="ellipsisCell ellipsisProv" title="${provName}">${provName}</span>`
        : '';

      const acciones = `
        <a href="#" class="icon-action ver" title="Ver detalle" data-id="${c._id}" onclick="window._clickAccContacto(this)">
          <i class="material-icons">visibility</i>
        </a>
        <a href="#" class="icon-action visita" title="Registrar visita" data-id="${c._id}" onclick="window._clickAccContacto(this)">
          <i class="material-icons">event_available</i>
        </a>
        <a href="#" class="icon-action editar" title="Editar" data-id="${c._id}" onclick="window._clickAccContacto(this)">
          <i class="material-icons">edit</i>
        </a>
        <a href="#" class="icon-action eliminar" title="Eliminar" data-id="${c._id}" onclick="window._clickAccContacto(this)">
          <i class="material-icons">delete</i>
        </a>`;

      return [
        `<span data-order="${whenKey}">${whenDisplay}</span>`,
        provCell,
        esc(centroCodigo),
        esc(comuna),
        esc(c.tieneMMPP || ''),
        c.fechaDisponible ? (''+c.fechaDisponible).slice(0,10) : '',
        esc(c.dispuestoVender || ''),
        (c.tonsDisponible ?? '') + '',
        esc(c.vendeActualmenteA || ''),
        acciones
      ];
    });

  if (state.dt && jq) {
    state.dt.clear();
    state.dt.rows.add(filas).draw(false);
    console.log('[contactos] filas renderizadas:', filas.length);
    return;
  }

  const tbody = $('#tablaContactos tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="color:#888">No hay contactos registrados aún.</td></tr>`;
    return;
  }
  filas.forEach(arr => {
    const tr = document.createElement('tr');
    tr.innerHTML = arr.map(td => `<td>${td}</td>`).join('');
    tbody.appendChild(tr);
  });
}

/* 🔁 refresco en vivo cuando otros módulos disparan reload */
document.addEventListener('reload-tabla-contactos', () => {
  console.debug('[tablaContactos] reload-tabla-contactos recibido');
  renderTablaContactos();
});
