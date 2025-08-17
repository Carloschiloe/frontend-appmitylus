// /js/contactos/tabla.js
import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto, abrirModalVisita } from './visitas.js';

/* ---------- estilos: columna proveedor angosta + ellipsis ---------- */
(function injectStyles () {
  const css = `
    #tablaContactos td .ellipsisCell{
      display:inline-block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; vertical-align:middle;
    }
    /* ~mitad de lo que tenías: angosta y con puntos suspensivos */
    #tablaContactos td .ellipsisProv{ max-width:26ch; }
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

function getCodigoByCentroId(id) {
  if (!id) return '';
  const lista = Array.isArray(state.listaCentros) ? state.listaCentros : [];
  const ct = lista.find(x => String(x._id ?? x.id) === String(id));
  return ct ? String(ct.codigo ?? ct.code ?? ct.Codigo ?? '') : '';
}

function getComunaByCodigo(codigo) {
  if (!codigo) return '';
  const cod = String(codigo);
  const lista = Array.isArray(state.listaCentros) ? state.listaCentros : [];
  const ct = lista.find(x => {
    const cs = [x.codigo, x.code, x.Codigo].filter(v => v != null).map(String);
    return cs.includes(cod);
  });
  return ct?.comuna ?? ct?.Comuna ?? '';
}

/* --------------------------------- DataTables --------------------------------- */
export function initTablaContactos() {
  const jq = window.jQuery || window.$;
  if (!jq || state.dt) return;

  state.dt = jq('#tablaContactos').DataTable({
    // Buttons + length ('l') + filter + table + info + paging
    dom: 'Blfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Contactos_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Contactos_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[0,'desc']],
    paging: true,              // 🔹 paginación
    pageLength: 10,            // 🔹 10 por página
    lengthMenu: [ [10, 25, 50, -1], [10, 25, 50, 'Todos'] ],
    autoWidth: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: 0, width: '110px' },   // Fecha
      { targets: 1, width: '260px' },   // Proveedor (angosta)
      { targets: -1, orderable: false, searchable: false }
    ]
  });

  // Delegación de acciones
  jq('#tablaContactos tbody')
    .on('click', 'a.icon-action.ver', function(){
      const id = this.dataset.id;
      const c = state.contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirDetalleContacto(c);
    })
    .on('click', 'a.icon-action.visita', function(){
      const id = this.dataset.id;
      const c = state.contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirModalVisita(c);
    })
    .on('click', 'a.icon-action.editar', function(){
      const id = this.dataset.id;
      const c = state.contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirEdicion(c);
    })
    .on('click', 'a.icon-action.eliminar', async function(){
      const id = this.dataset.id;
      if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
      try { await eliminarContacto(id); }
      catch (e) {
        console.error(e);
        M.toast?.({ html: 'No se pudo eliminar', displayLength: 2000 });
      }
    });
}


/* ------------------------------- Render de filas -------------------------------- */
export function renderTablaContactos() {
  const jq = window.jQuery || window.$;

  const filas = (state.contactosGuardados || [])
    .slice()
    .sort((a,b)=>{
      const da = new Date(a.createdAt || a.fecha || 0).getTime();
      const db = new Date(b.createdAt || b.fecha || 0).getTime();
      return db - da;
    })
    .map(c => {
      // Fecha
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const yyyy = f.getFullYear();
      const mm   = String(f.getMonth() + 1).padStart(2, '0');
      const dd   = String(f.getDate()).padStart(2, '0');
      const whenDisplay = `${yyyy}-${mm}-${dd}`;
      const whenKey     = f.getTime();

      // Centro (código) con fallback por centroId
      let centroCodigo = c.centroCodigo;
      if (!esCodigoValido(centroCodigo)) {
        centroCodigo = getCodigoByCentroId(c.centroId) || '';
      }

      // Comuna: usa lo guardado; si falta, dedúcela por código
      const comuna = c.centroComuna || c.comuna || getComunaByCodigo(centroCodigo) || '';

      // Proveedor con ellipsis + tooltip
      const provName = esc(c.proveedorNombre || '');
      const provCell = provName
        ? `<span class="ellipsisCell ellipsisProv" title="${provName}">${provName}</span>`
        : '';

      const acciones = `
        <a href="#!" class="icon-action ver" title="Ver detalle" data-id="${c._id}">
          <i class="material-icons">visibility</i>
        </a>
        <a href="#!" class="icon-action visita" title="Registrar visita" data-id="${c._id}">
          <i class="material-icons">event_available</i>
        </a>
        <a href="#!" class="icon-action editar" title="Editar" data-id="${c._id}">
          <i class="material-icons">edit</i>
        </a>
        <a href="#!" class="icon-action eliminar" title="Eliminar" data-id="${c._id}">
          <i class="material-icons">delete</i>
        </a>
      `;

      return [
        `<span data-order="${whenKey}">${whenDisplay}</span>`,
        provCell,
        esc(centroCodigo),
        esc(comuna),
        esc(c.tieneMMPP || ''),
        c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '',
        esc(c.dispuestoVender || ''),
        (c.tonsDisponiblesAprox ?? '') + '',
        esc(c.vendeActualmenteA || ''),
        acciones
      ];
    });

  // Si DataTables ya está, refrescamos por su API
  if (state.dt && jq) {
    state.dt.clear();
    state.dt.rows.add(filas).draw();
    return;
  }

  // Fallback sin DataTables (no debería usarse en producción)
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

