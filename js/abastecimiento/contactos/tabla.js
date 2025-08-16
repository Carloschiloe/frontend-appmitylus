import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto, abrirModalVisita } from './visitas.js';

let filtroActual = 'todos'; // 'todos' | 'sin' | 'con'

export function initTablaContactos() {
  const jq = window.jQuery || window.$;
  if (!jq || state.dt) return;

  state.dt = jq('#tablaContactos').DataTable({
    dom: 'Bfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Contactos_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Contactos_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[0, 'desc']],
    pageLength: 25,
    autoWidth: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: 0, width: '110px' },          // Fecha angosta
      { targets: -1, orderable: false, searchable: false } // Acciones
    ]
  });

  const $jq = jq;
  $jq('#tablaContactos tbody')
    .on('click', 'a.icon-action.ver', function () {
      const id = this.dataset.id;
      const c = state.contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirDetalleContacto(c);
    })
    .on('click', 'a.icon-action.visita', function () {
      const id = this.dataset.id;
      const c = state.contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirModalVisita(c);
    })
    .on('click', 'a.icon-action.editar', function () {
      const id = this.dataset.id;
      const c = state.contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirEdicion(c);
    })
    .on('click', 'a.icon-action.eliminar', async function () {
      const id = this.dataset.id;
      if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
      try {
        await eliminarContacto(id);
      } catch (e) {
        console.error(e);
        M.toast?.({ html: 'No se pudo eliminar', displayLength: 2000 });
      }
    });

  // Escucha de filtros (chips) y reload externo (modal asociar)
  document.addEventListener('filtro-contactos-changed', (e) => {
    filtroActual = e.detail?.filtro || 'todos';
    renderTablaContactos();
  });
  document.addEventListener('reload-tabla-contactos', () => {
    renderTablaContactos();
  });
}

function empresaColHTML(c) {
  if (c?.empresaId) {
    const nombre = c.empresaNombre || '(sin nombre)';
    return `
      <span>${escapeHTML(nombre)}</span>
      <a href="#!" class="btn-flat teal-text asociar-btn" data-id="${c._id}">Cambiar</a>
    `;
  }
  return `
    <span class="new badge red" data-badge-caption="">Sin empresa</span>
    <a href="#!" class="btn-flat teal-text asociar-btn" data-id="${c._id}">Asociar</a>
  `;
}

export function renderTablaContactos() {
  const jq = window.jQuery || window.$;

  const fuente = filtrar(state.contactosGuardados || [], filtroActual);

  const filas = fuente
    .slice()
    .sort((a, b) => {
      const da = new Date(a.createdAt || a.fecha || 0).getTime();
      const db = new Date(b.createdAt || b.fecha || 0).getTime();
      return db - da;
    })
    .map(c => {
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const yyyy = f.getFullYear();
      const mm = String(f.getMonth() + 1).padStart(2, '0');
      const dd = String(f.getDate()).padStart(2, '0');

      const whenDisplay = `${yyyy}-${mm}-${dd}`;  // solo fecha
      const whenKey = f.getTime();                // para ordenar

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

      // NUEVO: comuna y empresa
      const comuna = c.centroComuna || c.comuna || '';

      return [
        `<span data-order="${whenKey}">${whenDisplay}</span>`,
        escapeHTML(c.proveedorNombre || ''),
        escapeHTML(c.centroCodigo || ''),
        escapeHTML(comuna),
        escapeHTML(c.tieneMMPP || ''),
        c.fechaDisponibilidad ? ('' + c.fechaDisponibilidad).slice(0, 10) : '',
        escapeHTML(c.dispuestoVender || ''),
        (c.tonsDisponiblesAprox ?? '') + '',
        escapeHTML(c.vendeActualmenteA || ''),
        empresaColHTML(c), // 👈 NUEVA columna Empresa
        acciones
      ];
    });

  // DataTables
  if (state.dt && jq) {
    state.dt.clear();
    state.dt.rows.add(filas).draw();
    return;
  }

  // Fallback sin DataTables
  const tbody = $('#tablaContactos tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!fuente.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="color:#888">No hay contactos registrados aún.</td></tr>`;
    return;
  }
  filas.forEach(arr => {
    const tr = document.createElement('tr');
    tr.innerHTML = arr.map(td => `<td>${td}</td>`).join('');
    tbody.appendChild(tr);
  });
}

/* =========================
   Helpers
========================= */
function filtrar(lista, filtro) {
  if (filtro === 'sin') return lista.filter(c => !c.empresaId);
  if (filtro === 'con') return lista.filter(c => !!c.empresaId);
  return lista;
}

function escapeHTML(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
