// /js/contactos/personas.js
import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto, abrirModalVisita } from './visitas.js';

let dtP = null;
let filtroActualP = 'todos'; // 'todos' | 'sin' | 'con'

/* ---------------- estilos específicos para Personas ---------------- */
function ensurePersonasStyles() {
  if (document.getElementById('personas-fit-cols')) return;
  const css = `
    /* cálculos de ancho consistentes */
    #tablaPersonas { table-layout: fixed; width: 100%; }
    #tablaPersonas td, #tablaPersonas th { vertical-align: middle; }

    /* elipsis reutilizable */
    #tablaPersonas .cell-ellipsis {
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
      max-width: var(--w, 240px); display: inline-block; vertical-align: bottom;
    }
    #tablaPersonas .col-empresa { --w: 220px; }
    #tablaPersonas .col-notas   { --w: 320px; }

    /* chip empresa */
    #tablaPersonas .chip-empresa {
      display:inline-block; max-width:100%;
      padding: 2px 8px; border-radius: 16px; background:#eef6f6;
      border:1px solid #cfe9e9; font-size:.9rem;
      overflow:hidden; white-space:nowrap; text-overflow:ellipsis;
      vertical-align: middle;
    }
    #tablaPersonas .badge-sin { margin-right:6px; }

    /* acciones compactas */
    #tablaPersonas a.icon-action { margin: 0 4px; color:#00897B; white-space: nowrap; }
    #tablaPersonas a.icon-action:hover { color:#00695C; }
  `.trim();
  const tag = document.createElement('style');
  tag.id = 'personas-fit-cols';
  tag.textContent = css;
  document.head.appendChild(tag);
}

/* ---------------- utils ---------------- */
const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const stripHtml = (s = '') => s.replace(/<\/?[^>]+(>|$)/g, '');

function formateaFechaISO(o) {
  const d = new Date(o || 0);
  if (Number.isNaN(d.getTime())) return { display: '', order: 0 };
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return { display: `${y}-${m}-${dd}`, order: d.getTime() };
}

function telefonosDe(c) {
  if (Array.isArray(c.contactoTelefonos)) return c.contactoTelefonos.join(' / ');
  return c.contactoTelefono || '';
}
function emailsDe(c) {
  if (Array.isArray(c.contactoEmails)) return c.contactoEmails.join(' / ');
  return c.contactoEmail || '';
}

/* ---------------- init ---------------- */
export function initPersonasTab() {
  const jq = window.jQuery || window.$;
  const tabla = document.getElementById('tablaPersonas');
  if (!tabla) return;

  ensurePersonasStyles();

  if (jq && !dtP) {
    dtP = jq('#tablaPersonas').DataTable({
      dom: 'Bfrtip',
      buttons: [
        { extend:'excelHtml5', title:'Personas_Abastecimiento' },
        { extend:'pdfHtml5',   title:'Personas_Abastecimiento', orientation:'landscape', pageSize:'A4' }
      ],
      order: [[0,'desc']],
      pageLength: 10,
      autoWidth: false,
      fixedHeader: true, // cabecera fija DataTables (no usamos sticky manual)

      // 7 columnas exactas como tu <thead>
      columns: [
        { width: 110 },                              // Fecha
        { },                                         // Contacto
        { },                                         // Teléfono(s)
        { },                                         // Email
        { className: 'cell-ellipsis col-empresa', width: 220 }, // Empresa
        { className: 'cell-ellipsis col-notas',   width: 320 }, // Notas
        { orderable:false, searchable:false, width: 140 }       // Acciones
      ],
      language: { url:'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      createdRow: function(row /*, data */) {
        // tooltip para empresa y notas
        const tdEmp  = row.children[4];
        const tdNote = row.children[5];
        if (tdEmp)  tdEmp.title  = stripHtml(tdEmp.textContent || '');
        if (tdNote) tdNote.title = stripHtml(tdNote.textContent || '');
      }
    });

    // Acciones (delegadas)
    jq('#tablaPersonas tbody')
      .on('click', 'a.icon-action.ver', function(){
        const id = this.dataset.id;
        const c = (state.contactosGuardados || []).find(x => String(x._id) === String(id));
        if (c) abrirDetalleContacto(c);
      })
      .on('click', 'a.icon-action.visita', function(){
        const id = this.dataset.id;
        const c = (state.contactosGuardados || []).find(x => String(x._id) === String(id));
        if (c) abrirModalVisita(c);
      })
      .on('click', 'a.icon-action.editar', function(){
        const id = this.dataset.id;
        const c = (state.contactosGuardados || []).find(x => String(x._id) === String(id));
        if (c) abrirEdicion(c);
      })
      .on('click', 'a.icon-action.eliminar', async function(){
        const id = this.dataset.id;
        if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
        try {
          await eliminarContacto(id);
          renderTablaPersonas(); // refresca
        } catch(e){
          console.error(e);
          M.toast?.({ html:'No se pudo eliminar', displayLength:2000 });
        }
      })
      // Asociar/Cambiar empresa (ícono)
      .on('click', 'a.icon-action.asociar-btn', function(e){
        e.preventDefault();
        const id = this.dataset.id;
        state.asociarContactoId = id;
        try { document.dispatchEvent(new CustomEvent('asociar-open', { detail: { contactoId: id } })); } catch {}
        // abre el modal de asociación
        const modal = document.getElementById('modalAsociar');
        if (modal && window.M && M.Modal) {
          const inst = M.Modal.getInstance(modal) || M.Modal.init(modal, {});
          // limpia buscador y resultados
          const inp = document.getElementById('empresaSearch');
          const ul  = document.getElementById('searchResults');
          if (inp) inp.value = '';
          if (ul)  ul.innerHTML = '';
          inst.open();
        }
      });
  }

  // Filtros (chips)
  document.getElementById('fltTodosP')?.addEventListener('click', ()=>{
    filtroActualP = 'todos'; renderTablaPersonas();
  });
  document.getElementById('fltSinP')?.addEventListener('click', ()=>{
    filtroActualP = 'sin'; renderTablaPersonas();
  });
  document.getElementById('fltConP')?.addEventListener('click', ()=>{
    filtroActualP = 'con'; renderTablaPersonas();
  });

  // evento externo para refrescar
  document.addEventListener('reload-tabla-contactos', ()=> renderTablaPersonas());

  renderTablaPersonas();
}

/* ---------------- render ---------------- */
export function renderTablaPersonas() {
  const jq = window.jQuery || window.$;
  const lista = filtrar((state.contactosGuardados || []), filtroActualP);

  const filas = lista.slice()
    .sort((a,b)=>{
      const da = new Date(a.createdAt || a.fecha || 0).getTime();
      const db = new Date(b.createdAt || b.fecha || 0).getTime();
      return db - da;
    })
    .map(c=>{
      const f = formateaFechaISO(c.createdAt || c.fecha || Date.now());
      const tels = telefonosDe(c);
      const mails = emailsDe(c);

      // Empresa (chip + ícono asociar/cambiar)
      let empresaHTML = '';
      if (c.proveedorNombre) {
        empresaHTML = `
          <span class="chip-empresa" title="${esc(c.proveedorNombre)}">${esc(c.proveedorNombre)}</span>
          <a href="#!" class="icon-action asociar-btn" data-id="${c._id}" title="Cambiar empresa">
            <i class="material-icons tiny">link</i>
          </a>
        `;
      } else {
        empresaHTML = `
          <span class="new badge red badge-sin" data-badge-caption="">Sin empresa</span>
          <a href="#!" class="icon-action asociar-btn" data-id="${c._id}" title="Asociar empresa">
            <i class="material-icons tiny">link</i>
          </a>
        `;
      }

      // Notas con elipsis
      const notas = c.notas || c.notasContacto || '';

      // Acciones
      const acciones = `
        <a href="#!" class="icon-action ver" title="Ver detalle" data-id="${c._id}">
          <i class="material-icons tiny">visibility</i>
        </a>
        <a href="#!" class="icon-action visita" title="Registrar visita" data-id="${c._id}">
          <i class="material-icons tiny">event_available</i>
        </a>
        <a href="#!" class="icon-action editar" title="Editar" data-id="${c._id}">
          <i class="material-icons tiny">edit</i>
        </a>
        <a href="#!" class="icon-action eliminar" title="Eliminar" data-id="${c._id}">
          <i class="material-icons tiny">delete</i>
        </a>
      `;

      return [
        `<span data-order="${f.order}">${f.display}</span>`,
        esc(c.contactoNombre || c.proveedorNombre || ''),  // Contacto
        esc(String(tels)),                                  // Teléfonos
        esc(String(mails)),                                 // Email
        `<span class="cell-ellipsis col-empresa">${empresaHTML}</span>`, // Empresa
        `<span class="cell-ellipsis col-notas" title="${esc(notas)}">${esc(notas)}</span>`, // Notas
        acciones
      ];
    });

  if (dtP && jq) {
    dtP.clear();
    dtP.rows.add(filas).draw();
    // KPIs
    actualizaKpis(lista);
    return;
  }

  // sin DataTables (fallback)
  const tbody = $('#tablaPersonas tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#888">No hay personas aún.</td></tr>`;
    actualizaKpis(lista);
    return;
  }
  filas.forEach(arr=>{
    const tr = document.createElement('tr');
    tr.innerHTML = arr.map(td=>`<td>${td}</td>`).join('');
    tbody.appendChild(tr);
  });
  actualizaKpis(lista);
}

/* ---------------- helpers ---------------- */
function filtrar(lista, filtro){
  if (filtro === 'sin') return lista.filter(c => !c.proveedorNombre);
  if (filtro === 'con') return lista.filter(c => !!c.proveedorNombre);
  return lista;
}

function actualizaKpis(lista){
  const total = (lista || []).length;
  const sin   = (lista || []).filter(c => !c.proveedorNombre).length;
  const con   = total - sin;
  // visitas sin empresa en 30d la calculas en otro módulo; acá la dejamos estable si ya la llenas
  $('#kpiPTotal')?.innerText = String(total);
  $('#kpiPSin')?.innerText   = String(sin);
  $('#kpiPCon')?.innerText   = String(con);
  // '#kpiPVisitasSin' lo actualiza tu flujo de visitas; si quieres, puedes setear 0 aquí
}
