// /js/abastecimiento/contactos/personas.js
import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto } from './form-contacto.js';
import { abrirModalVisita } from '../visitas/tab.js';

/* ------------ estilos específicos (una sola línea + ellipsis + acciones en fila) ------------ */
(function injectStyles() {
  const css = `
  #tablaPersonas{ table-layout:auto; width:100% !important; }
  #tablaPersonas thead th{ position:sticky; top:0; z-index:2; }

  /* forzar línea única + ellipsis en celdas “largas” */
  #tablaPersonas th, #tablaPersonas td{ white-space:nowrap; }
  #tablaPersonas td{ overflow:hidden; text-overflow:ellipsis; }

  /* contenedor inline para Empresa/Notas con íconos al lado */
  #tablaPersonas .cell-inline{
    display:flex; align-items:center; gap:6px; min-width:0;
  }
  #tablaPersonas .cell-inline .ellipsisCell{
    flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  }

  /* tamaños de ellipsis razonables */
  #tablaPersonas td .ellipsisEmpresa { max-width: 28ch; }
  #tablaPersonas td .ellipsisNotas   { max-width: 42ch; }

  /* acciones en una sola fila, mismo look que Contactos */
  #tablaPersonas td.cell-actions{ white-space:nowrap; }
  #tablaPersonas td.cell-actions .act{
    display:inline-flex; align-items:center; justify-content:center;
    width:32px; height:32px; margin-right:6px;
    border:1px solid #e5e7eb; border-radius:8px; background:#fff;
    box-shadow:0 2px 8px rgba(2,6,23,.05); cursor:pointer;
  }
  #tablaPersonas td.cell-actions .act:last-child{ margin-right:0; }
  #tablaPersonas td.cell-actions i.material-icons{ font-size:18px; line-height:18px; }

  #tablaPersonas .chip.small{ height:22px; line-height:22px; font-size:12px; }
  `;
  if (!document.getElementById('personas-inline-styles')) {
    const s = document.createElement('style');
    s.id = 'personas-inline-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();

/* ------------ helpers ------------ */
const fmtDateYMD = d => {
  const x = d ? new Date(d) : new Date();
  if (isNaN(x)) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const hasEmpresa = (c) => !!(c?.proveedorNombre && String(c.proveedorNombre).trim());

/* ------------ estado ------------ */
let dtP = null;
let filtroActualP = 'todos'; // 'todos' | 'sin' | 'con'

/* ------------ init ------------ */
export function initPersonasTab() {
  const jq = window.jQuery || window.$;
  if (!$('#tablaPersonas')) return;

  // chips
  document.getElementById('fltTodosP')?.addEventListener('click', () => { filtroActualP = 'todos'; renderTablaPersonas(); actualizarKPIs(); });
  document.getElementById('fltSinP')  ?.addEventListener('click', () => { filtroActualP = 'sin';   renderTablaPersonas(); actualizarKPIs(); });
  document.getElementById('fltConP')  ?.addEventListener('click', () => { filtroActualP = 'con';   renderTablaPersonas(); actualizarKPIs(); });

  document.addEventListener('reload-tabla-contactos', () => { renderTablaPersonas(); actualizarKPIs(); });

  // DataTable Personas
  if (jq && !dtP) {
    dtP = jq('#tablaPersonas').DataTable({
      dom: 'Bfrtip',
      buttons: [
        { extend: 'excelHtml5', title: 'Agenda_de_Personas' },
        { extend: 'pdfHtml5',   title: 'Agenda_de_Personas', orientation: 'landscape', pageSize: 'A4' }
      ],
      pageLength: 10,
      order: [[0, 'desc']],
      autoWidth: false,
      responsive: true,
      scrollX: false,
      language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      // anchos aproximados para evitar overflow y no activar scroll
      columnDefs: [
        { targets: 0, width: 90  },  // Fecha
        { targets: 1, width: 180 },  // Contacto
        { targets: 2, width: 160 },  // Teléfono(s)
        { targets: 3, width: 200 },  // Email
        { targets: 4, width: 240 },  // Empresa
        { targets: 5, width: 220 },  // Notas
        { targets: 6, width: 120, orderable: false, searchable: false, className: 'cell-actions' } // Acciones
      ]
    });

    // acciones por fila (delegación)
    jq('#tablaPersonas tbody')
      .off('click.personas')
      .on('click.personas', '.cell-actions .act, a.icon-action', function(e){
        e.preventDefault();
        e.stopPropagation();
        const id = this.dataset.id;
        const cls = (this.className || '').toLowerCase();
        const c = (state.contactosGuardados || []).find(x => String(x._id) === String(id));
        if (!c) return;

        if (cls.includes('icon-ver'))    return abrirDetalleContacto(c);
        if (cls.includes('icon-visita')) return abrirModalVisita(c);
        if (cls.includes('icon-editar')) return abrirEdicion(c);
        if (cls.includes('icon-eliminar')) {
          if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
          eliminarContacto(id)
            .then(()=>{ renderTablaPersonas(); actualizarKPIs(); })
            .catch(e => { console.error(e); M.toast?.({ html: 'No se pudo eliminar', displayLength: 2000 }); });
        }
      });
  }

  renderTablaPersonas();
  actualizarKPIs();
}

/* ------------ render ------------ */
export function renderTablaPersonas() {
  const jq = window.jQuery || window.$;
  const lista = (state.contactosGuardados || []).slice();

  const filtrada = lista.filter(c => {
    if (filtroActualP === 'sin') return !hasEmpresa(c);
    if (filtroActualP === 'con') return hasEmpresa(c);
    return true;
  });

  const filas = filtrada
    .sort((a,b)=>{
      const da = new Date(a.createdAt || a.fecha || 0).getTime();
      const db = new Date(b.createdAt || b.fecha || 0).getTime();
      return db - da;
    })
    .map(c => {
      const f = fmtDateYMD(c.createdAt || c.fecha || Date.now());
      const tels = Array.isArray(c.contactoTelefonos) ? c.contactoTelefonos.join(' / ') : (c.contactoTelefono || '');
      const mails = Array.isArray(c.contactoEmails) ? c.contactoEmails.join(' / ') : (c.contactoEmail || '');

      // Empresa en una sola línea con ícono de asociar/cambiar
      let empresaCell = '';
      if (hasEmpresa(c)) {
        const name = esc(c.proveedorNombre || '');
        empresaCell = `
          <span class="cell-inline">
            <span class="ellipsisCell ellipsisEmpresa" title="${name}">${name}</span>
            <a href="#!" class="icon-action asociar-btn" title="Cambiar empresa" data-id="${c._id}">
              <i class="material-icons">sync</i>
            </a>
          </span>
        `;
      } else {
        empresaCell = `
          <span class="cell-inline">
            <span class="chip red lighten-5 red-text text-darken-2 small">Sin empresa</span>
            <a href="#!" class="icon-action asociar-btn" title="Asociar a empresa" data-id="${c._id}">
              <i class="material-icons">person_add</i>
            </a>
          </span>
        `;
      }

      const notas = esc(c.notas || c.notasContacto || '');
      const acciones = `
        <div class="cell-actions">
          <a href="#!" class="act icon-action icon-ver"     title="Ver detalle"       data-id="${c._id}">
            <i class="material-icons">visibility</i>
          </a>
          <a href="#!" class="act icon-action icon-visita"  title="Registrar visita"  data-id="${c._id}">
            <i class="material-icons">event_available</i>
          </a>
          <a href="#!" class="act icon-action icon-editar"  title="Editar"            data-id="${c._id}">
            <i class="material-icons">edit</i>
          </a>
          <a href="#!" class="act icon-action icon-eliminar"title="Eliminar"          data-id="${c._id}">
            <i class="material-icons">delete</i>
          </a>
        </div>
      `;

      return [
        `<span data-order="${new Date(f).getTime()}">${f}</span>`,     // Fecha
        esc(c.contactoNombre || ''),                                   // Contacto
        esc(String(tels)),                                             // Teléfono(s)
        esc(String(mails)),                                            // Email
        empresaCell,                                                   // Empresa
        `<span class="cell-inline"><span class="ellipsisCell ellipsisNotas" title="${notas}">${notas}</span></span>`, // Notas
        acciones                                                       // Acciones
      ];
    });

  if (dtP && jq) {
    dtP.clear();
    dtP.rows.add(filas).draw(false);
    return;
  }

  // fallback
  const tbody = $('#tablaPersonas tbody');
  if (!tbody) return;
  tbody.innerHTML = filas.map(row => `<tr>${row.map(td => `<td>${td}</td>`).join('')}</tr>`).join('');
}

/* ------------ KPIs ------------ */
function actualizarKPIs() {
  const todos = state.contactosGuardados || [];
  const sin   = todos.filter(c => !hasEmpresa(c)).length;
  const con   = todos.filter(c =>  hasEmpresa(c)).length;

  let visitasSin = 0;
  const visitas = state.visitasGuardadas || [];
  if (Array.isArray(visitas) && visitas.length) {
    const hoy = Date.now();
    const h30 = 30 * 24 * 60 * 60 * 1000;
    const idsSinEmpresa = new Set(todos.filter(c => !hasEmpresa(c)).map(c => String(c._id)));
    visitasSin = visitas.filter(v => {
      const okId = v.contactoId && idsSinEmpresa.has(String(v.contactoId));
      const okFecha = v.fecha ? (hoy - new Date(v.fecha).getTime() <= h30) : false;
      return okId && okFecha;
    }).length;
  }

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
  setText('kpiPTotal', todos.length);
  setText('kpiPSin',   sin);
  setText('kpiPCon',   con);
  setText('kpiPVisitasSin', visitasSin);
}
