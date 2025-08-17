// /js/contactos/personas.js
import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto, abrirModalVisita } from './visitas.js';

let dtP = null;
let filtroActualP = 'todos'; // 'todos' | 'sin' | 'con'

function injectPersonasStyles() {
  if (document.getElementById('personas-sticky-styles')) return;
  const css = `
    #tablaPersonas thead th {
      position: sticky;
      top: var(--sticky-offset, 64px);
      background: #fff;
      z-index: 3;
    }
    #tablaPersonas th.col-empresa, #tablaPersonas td.col-empresa { max-width: 280px; }
    #tablaPersonas th.col-notas,   #tablaPersonas td.col-notas   { max-width: 320px; }
    #tablaPersonas td .ellipsis {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
  const style = document.createElement('style');
  style.id = 'personas-sticky-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

function setStickyOffset() {
  // suma altura de la barra superior + un pequeño margen
  const nav = document.querySelector('nav');
  const offset = (nav?.getBoundingClientRect()?.height || 56) + 8;
  const table = document.getElementById('tablaPersonas');
  if (table) table.style.setProperty('--sticky-offset', `${Math.round(offset)}px`);
}

export function initPersonasTab() {
  injectPersonasStyles();
  setStickyOffset();
  window.addEventListener('resize', setStickyOffset);

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
      lengthMenu: [[10,25,50,-1],[10,25,50,'Todos']],
      autoWidth: false,
      language: { url:'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      columnDefs: [
        { targets: 0, width: '110px' },
        { targets: 4, className: 'col-empresa' },
        { targets: 5, className: 'col-notas' },
        { targets: -1, orderable:false, searchable:false }
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
          renderTablaPersonas();
        } catch(e){
          console.error(e);
          M.toast?.({ html:'No se pudo eliminar', displayLength:2000 });
        }
      })
      .on('click', 'a.asociar-btn', function(e){
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

      const tels = Array.isArray(c.contactoTelefonos) ? c.contactoTelefonos.join(' / ')
                 : (c.contactoTelefono || '');
      const mails = Array.isArray(c.contactoEmails) ? c.contactoEmails.join(' / ')
                  : (c.contactoEmail || '');

      // ✅ Con empresa si hay empresaId o (proveedorKey & proveedorNombre)
      const tieneEmpresa = !!(c.empresaId || (c.proveedorKey && c.proveedorNombre));
      const empresaNombre = c.empresaNombre || c.proveedorNombre || '';
      const empresaBlock = tieneEmpresa
        ? `<span class="ellipsis" title="${esc(empresaNombre)}">${esc(empresaNombre || '(sin nombre)')}</span>
           <a href="#!" class="btn-flat teal-text asociar-btn" data-id="${c._id}">Cambiar</a>`
        : `<span class="new badge red" data-badge-caption="" title="Sin empresa">Sin empresa</span>
           <a href="#!" class="btn-flat teal-text asociar-btn" data-id="${c._id}">Asociar</a>`;

      const notasTxt = c.notasContacto || c.notas || '';
      const notasBlock = `<span class="ellipsis" title="${esc(notasTxt)}">${esc(notasTxt)}</span>`;

      const acciones = `
        <a href="#!" class="icon-action ver" title="Ver detalle" data-id="${c._id}"><i class="material-icons">visibility</i></a>
        <a href="#!" class="icon-action visita" title="Registrar visita" data-id="${c._id}"><i class="material-icons">event_available</i></a>
        <a href="#!" class="icon-action editar" title="Editar" data-id="${c._id}"><i class="material-icons">edit</i></a>
        <a href="#!" class="icon-action eliminar" title="Eliminar" data-id="${c._id}"><i class="material-icons">delete</i></a>
      `;

      return [
        `<span data-order="${whenKey}">${whenDisplay}</span>`,
        esc(c.contactoNombre || c.proveedorNombre || ''),
        esc(String(tels)),
        esc(String(mails)),
        empresaBlock,
        notasBlock,
        acciones
      ];
    });

  const jqInst = window.jQuery || window.$;
  if (dtP && jqInst) {
    dtP.clear();
    dtP.rows.add(filas).draw(false);
    dtP.columns.adjust();
    return;
  }

  const tbody = $('#tablaPersonas tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#888">No hay personas aún.</td></tr>`;
    return;
  }
  filas.forEach(arr=>{
    const tr = document.createElement('tr');
    tr.innerHTML = arr.map((td,i)=>{
      const extra = (i === 4) ? ' class="col-empresa"' : (i === 5) ? ' class="col-notas"' : '';
      return `<td${extra}>${td}</td>`;
    }).join('');
    tbody.appendChild(tr);
  });
}

function filtrar(lista, filtro){
  // usa la misma definición que en la tabla para “con empresa”
  const hasEmp = (c) => !!(c.empresaId || (c.proveedorKey && c.proveedorNombre));
  if (filtro === 'sin') return lista.filter(c => !hasEmp(c));
  if (filtro === 'con') return lista.filter(c =>  hasEmp(c));
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
