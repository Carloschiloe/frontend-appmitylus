import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto, abrirModalVisita } from './visitas.js';

export function initTablaContactos(){
  const jq = window.jQuery || window.$; 
  if (!jq || state.dt) return;

  state.dt = jq('#tablaContactos').DataTable({
    dom: 'Bfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Contactos_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Contactos_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[0,'desc']],
    pageLength: 25,
    autoWidth: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: 0, width: '110px' },   // fecha
      { targets: -1, orderable: false, searchable: false } // acciones
    ]
  });

  const $jq = jq;
  $jq('#tablaContactos tbody')
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
      try { 
        await eliminarContacto(id); 
      } catch (e) {
        console.error(e); 
        M.toast?.({ html: 'No se pudo eliminar', displayLength: 2000 });
      }
    });
}

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
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const yyyy = f.getFullYear();
      const mm   = String(f.getMonth() + 1).padStart(2, '0');
      const dd   = String(f.getDate()).padStart(2, '0');

      const whenDisplay = `${yyyy}-${mm}-${dd}`;
      const whenKey     = f.getTime();

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

      const comuna = c.centroComuna || c.comuna || '';

      return [
        `<span data-order="${whenKey}">${whenDisplay}</span>`,
        esc(c.proveedorNombre || ''),   // EMPRESA (Proveedor)
        esc(c.centroCodigo || ''),
        esc(comuna),                    // NUEVO: Comuna
        esc(c.tieneMMPP || ''),
        c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '',
        esc(c.dispuestoVender || ''),
        (c.tonsDisponiblesAprox ?? '') + '',
        esc(c.vendeActualmenteA || ''),
        acciones
      ];
    });

  if (state.dt && jq) { 
    state.dt.clear(); 
    state.dt.rows.add(filas).draw(); 
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

function esc(s=''){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
