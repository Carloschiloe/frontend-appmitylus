// /js/contactos/tabla.js
import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto, abrirModalVisita } from './visitas.js';

let dt = null;

export function initTablaContactos() {
  const jq = window.jQuery || window.$;
  const tabla = document.getElementById('tablaContactos');
  if (!tabla || (dt && jq)) return;

  if (jq) {
    dt = jq('#tablaContactos').DataTable({
      dom: 'Bfrtip',
      buttons: [
        { extend:'excelHtml5', title:'Contactos_Abastecimiento' },
        { extend:'pdfHtml5',   title:'Contactos_Abastecimiento', orientation:'landscape', pageSize:'A4' }
      ],
      order: [[0,'desc']],
      pageLength: 10,                 // ← 10 por página
      autoWidth: false,
      fixedHeader: true,              // ← cabecera fija sin desalinearse
      language: { url:'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      columnDefs: [
        { targets: 0, width: '110px' },       // Fecha
        { targets: 1, width: '220px' },       // Contacto
        { targets: 2, width: '150px' },       // Teléfono
        { targets: 3, width: '220px' },       // Email
        { targets: 4, width: '220px', className:'col-empresa' }, // Empresa (más angosta)
        { targets: 5, width: '320px', className:'col-notas' },   // Notas (más angosta)
        { targets: -1, orderable:false, searchable:false, width:'150px' } // Acciones
      ]
    });

    // Acciones
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
        try {
          await eliminarContacto(id);
          renderTablaContactos();
        } catch(e){
          console.error(e);
          M.toast?.({ html:'No se pudo eliminar', displayLength:2000 });
        }
      })
      // Asociar/Cambiar empresa: ahora en Acciones con ícono 🏢
      .on('click', 'a.icon-action.asociar', function(e){
        e.preventDefault();
        const id = this.dataset.id;
        state.asociarContactoId = id;
        try { document.dispatchEvent(new CustomEvent('asociar-open', { detail:{ contactoId:id } })); } catch {}
        const modal = document.getElementById('modalAsociar');
        if (modal && window.M && M.Modal) {
          const inst = M.Modal.getInstance(modal) || M.Modal.init(modal, {});
          // limpiar buscador
          const inp = document.getElementById('empresaSearch');
          const ul  = document.getElementById('searchResults');
          if (inp) inp.value = '';
          if (ul)  ul.innerHTML = '';
          inst.open();
        }
      });
  }

  // refrescar cuando cambie el filtro o cuando se recarguen contactos
  document.addEventListener('reload-tabla-contactos', ()=> renderTablaContactos());

  renderTablaContactos();
}

export function renderTablaContactos() {
  const jq = window.jQuery || window.$;
  const lista = (state.contactosGuardados || []).slice()
    .sort((a,b)=>{
      const da = new Date(a.createdAt || a.fecha || 0).getTime();
      const db = new Date(b.createdAt || b.fecha || 0).getTime();
      return db - da;
    });

  const filas = lista.map(c=>{
    const f = new Date(c.createdAt || c.fecha || Date.now());
    const yyyy = f.getFullYear();
    const mm = String(f.getMonth()+1).padStart(2,'0');
    const dd = String(f.getDate()).padStart(2,'0');
    const whenDisplay = `${yyyy}-${mm}-${dd}`;
    const whenKey = f.getTime();

    const tel = Array.isArray(c.contactoTelefonos) ? c.contactoTelefonos.join(' / ') : (c.contactoTelefono || '');
    const mail = Array.isArray(c.contactoEmails) ? c.contactoEmails.join(' / ') : (c.contactoEmail || '');

    // EMPRESA: solo chip con el nombre (ellipsis + title), sin “CAMBIAR”
    const nombreEmpresa = c.proveedorNombre || c.empresaNombre || '';
    const empresaHTML = c.proveedorKey
      ? `<span class="chip empresa-chip ellipsis" title="${esc(nombreEmpresa)}">${esc(nombreEmpresa)}</span>`
      : `<span class="new badge red" data-badge-caption="" title="Sin empresa">Sin empresa</span>`;

    // NOTAS: ellipsis + title
    const nota = c.notas || c.notasContacto || '';
    const notasHTML = `<span class="ellipsis" title="${esc(nota)}">${esc(nota)}</span>`;

    const acciones = `
      <a href="#!" class="icon-action ver" title="Ver detalle" data-id="${c._id}"><i class="material-icons">visibility</i></a>
      <a href="#!" class="icon-action visita" title="Registrar visita" data-id="${c._id}"><i class="material-icons">event_available</i></a>
      <a href="#!" class="icon-action asociar" title="Asociar/Cambiar empresa" data-id="${c._id}"><i class="material-icons">business</i></a>
      <a href="#!" class="icon-action editar" title="Editar" data-id="${c._id}"><i class="material-icons">edit</i></a>
      <a href="#!" class="icon-action eliminar" title="Eliminar" data-id="${c._id}"><i class="material-icons">delete</i></a>
    `;

    return [
      `<span data-order="${whenKey}">${whenDisplay}</span>`,
      esc(c.contactoNombre || c.proveedorNombre || ''),
      esc(String(tel)),
      esc(String(mail)),
      empresaHTML,
      notasHTML,
      acciones
    ];
  });

  if (dt && jq) {
    dt.clear();
    dt.rows.add(filas).draw();
    return;
  }

  const tbody = $('#tablaContactos tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#888">No hay contactos aún.</td></tr>`;
    return;
  }
  filas.forEach(arr=>{
    const tr = document.createElement('tr');
    tr.innerHTML = arr.map(td=>`<td>${td}</td>`).join('');
    tbody.appendChild(tr);
  });
}

function esc(s=''){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}
