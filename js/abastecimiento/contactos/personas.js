// /js/contactos/personas.js
import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto, abrirModalVisita } from './visitas.js';

let dtP = null;
let filtroActualP = 'todos'; // 'todos' | 'sin' | 'con'

// CSS solo para Personas (scoped al id de la tabla)
function ensurePersonasStyles() {
  if (document.getElementById('personas-fit-cols')) return;
  const css = `
    /* cabecera pegada y celdas con elipsis */
    #tablaPersonas_wrapper .dataTables_scrollHead { position: sticky; top: 0; z-index: 3; }
    #tablaPersonas td, #tablaPersonas th { vertical-align: middle; }
    #tablaPersonas .cell-ellipsis { 
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis; 
      max-width: var(--w, 240px);
      display: inline-block;
      vertical-align: bottom;
    }
    #tablaPersonas .col-empresa { --w: 220px; }
    #tablaPersonas .col-notas   { --w: 320px; }
    #tablaPersonas .chip-empresa {
      display:inline-block; max-width:100%;
      padding: 2px 8px; border-radius: 16px; background:#eef6f6; 
      border:1px solid #cfe9e9; font-size: .9rem;
      overflow:hidden; white-space:nowrap; text-overflow:ellipsis;
      vertical-align: middle;
    }
    #tablaPersonas .badge-sin { margin-right:6px; }
    /* iconos de acciones compactos */
    #tablaPersonas a.icon-action { margin: 0 4px; color:#00897B; }
    #tablaPersonas a.icon-action:hover { color:#00695C; }
  `.trim();
  const tag = document.createElement('style');
  tag.id = 'personas-fit-cols';
  tag.textContent = css;
  document.head.appendChild(tag);
}

export function initPersonasTab() {
  ensurePersonasStyles();

  const jq = window.jQuery || window.$;
  const tabla = document.getElementById('tablaPersonas');
  if (!tabla || (dtP && jq)) return;

  if (jq) {
    dtP = jq('#tablaPersonas').DataTable({
      dom: 'Bfrtip',
      buttons: [
        { extend:'excelHtml5', title:'Personas_Abastecimiento' },
        { extend:'pdfHtml5',   title:'Personas_Abastecimiento', orientation:'landscape', pageSize:'A4' }
      ],
      order: [[0,'desc']],
      pageLength: 10,
      autoWidth: false,
      fixedHeader: true,
      scrollX: true,
      language: { url:'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      columnDefs: [
        // Fecha angosta
        { targets: 0, width: 110 },
        // Empresa (col 4) con elipsis y título
        { targets: 4, width: 220, createdCell: (td, data) => {
            td.classList.add('cell-ellipsis','col-empresa');
            td.title = stripHtml(String(data || ''));
          }
        },
        // Notas (col 5) con elipsis y título
        { targets: 5, width: 320, createdCell: (td, data) => {
            td.classList.add('cell-ellipsis','col-notas');
            td.title = stripHtml(String(data || ''));
          }
        },
        // Acciones sin orden ni búsqueda
        { targets: -1, orderable:false, searchable:false, width: 140 }
      ]
    });

    // Acciones
    jq('#tablaPersonas tbody')
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
          renderTablaPersonas(); // refresca Personas
        } catch(e){
          console.error(e);
          M.toast?.({ html:'No se pudo eliminar', displayLength:2000 });
        }
      })
      // Asociar/Cambiar empresa (icono en Acciones)
      .on('click', 'a.icon-action.asociar', function(e){
        e.preventDefault();
        const id = this.dataset.id;
        state.asociarContactoId = id;
        try { document.dispatchEvent(new CustomEvent('asociar-open', { detail: { contactoId: id } })); } catch {}
        const modal = document.getElementById('modalAsociar');
        if (modal && window.M && M.Modal) {
          const inst = M.Modal.getInstance(modal) || M.Modal.init(modal, {});
          const inp = document.getElementById('empresaSearch');
          const ul  = document.getElementById('searchResults');
          if (inp) inp.value = '';
          if (ul)  ul.innerHTML = '';
          inst.open();
        }
      });
  }

  // Listeners externos
  document.addEventListener('filtro-personas-changed', (e)=>{
    filtroActualP = e.detail?.filtro || 'todos';
    renderTablaPersonas();
  });
  document.addEventListener('reload-tabla-contactos', ()=>{
    renderTablaPersonas();
  });

  renderTablaPersonas();
}

export function renderTablaPersonas() {
  ensurePersonasStyles();

  const jq = window.jQuery || window.$;
  const lista = filtrar(state.contactosGuardados || [], filtroActualP);

  const filas = lista.slice()
    .sort((a,b)=>{
      const da = new Date(a.createdAt || a.fecha || 0).getTime();
      const db = new Date(b.createdAt || b.fecha || 0).getTime();
      return db - da;
    })
    .map(c=>{
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const yyyy = f.getFullYear();
      const mm = String(f.getMonth()+1).padStart(2,'0');
      const dd = String(f.getDate()).padStart(2,'0');
      const whenDisplay = `${yyyy}-${mm}-${dd}`;
      const whenKey = f.getTime();

      // Teléfonos / emails tolerantes a array o string
      const tels = Array.isArray(c.contactoTelefonos) ? c.contactoTelefonos.join(' / ')
                 : (c.contactoTelefono || '');
      const mails = Array.isArray(c.contactoEmails) ? c.contactoEmails.join(' / ')
                  : (c.contactoEmail || '');

      // Empresa: chip + sin botón de texto
      const nombreEmpresa = c.proveedorNombre || '';
      const empresaHTML = nombreEmpresa
        ? `<span class="chip-empresa" title="${esc(nombreEmpresa)}">${esc(nombreEmpresa)}</span>`
        : `<span class="new badge red badge-sin" data-badge-caption="">Sin empresa</span>`;

      // Acciones (agregamos ícono 'business' para asociar/cambiar)
      const acciones = `
        <a href="#!" class="icon-action ver"     title="Ver detalle"                data-id="${c._id}"><i class="material-icons">visibility</i></a>
        <a href="#!" class="icon-action visita"  title="Registrar visita"           data-id="${c._id}"><i class="material-icons">event_available</i></a>
        <a href="#!" class="icon-action asociar" title="Asociar/Cambiar empresa"    data-id="${c._id}"><i class="material-icons">business</i></a>
        <a href="#!" class="icon-action editar"  title="Editar"                     data-id="${c._id}"><i class="material-icons">edit</i></a>
        <a href="#!" class="icon-action eliminar"title="Eliminar"                   data-id="${c._id}"><i class="material-icons">delete</i></a>
      `;

      const notas = c.notas || c.notasContacto || '';

      return [
        `<span data-order="${whenKey}">${whenDisplay}</span>`,
        esc(c.contactoNombre || c.proveedorNombre || ''),
        esc(String(tels)),
        esc(String(mails)),
        empresaHTML,
        esc(notas),
        acciones
      ];
    });

  if (dtP && jq) {
    dtP.clear();
    dtP.rows.add(filas).draw();
    return;
  }

  // Fallback sin DataTables (por si no carga)
  const tbody = $('#tablaPersonas tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#888">No hay personas aún.</td></tr>`;
    return;
  }
  filas.forEach(arr=>{
    const tr = document.createElement('tr');
    tr.innerHTML = arr.map(td=>`<td>${td}</td>`).join('');
    tbody.appendChild(tr);
  });
}

function filtrar(lista, filtro){
  if (filtro === 'sin') return lista.filter(c => !c.empresaId && !c.proveedorKey);
  if (filtro === 'con') return lista.filter(c => !!(c.empresaId || c.proveedorKey));
  return lista;
}

function esc(s=''){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function stripHtml(s=''){
  return s.replace(/<[^>]*>/g,'');
}
