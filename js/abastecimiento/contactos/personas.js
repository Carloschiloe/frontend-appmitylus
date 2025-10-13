// /js/abastecimiento/contactos/personas.js
import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto, abrirDetalleContacto } from './form-contacto.js';
import { abrirModalVisita } from '../visitas/tab.js';

/* ------------ estilos (tabla compacta, empresa bajo contacto, acciones visibles) ------------ */
(function injectStyles() {
  const css = `
    /* Oculta el buscador nativo de DataTables por si llegara a colarse */
    #tablaPersonas_wrapper .dataTables_filter{ display:none !important; }

    /* Evitar recortes en el wrapper */
    #tablaPersonas_wrapper{ overflow:visible !important; }

    #tablaPersonas{ table-layout:fixed!important; width:100%!important; }
    #tablaPersonas thead th{ position:sticky; top:0; z-index:2; }

    #tablaPersonas th, #tablaPersonas td{
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:10px 8px!important;
      box-sizing:border-box;
    }

    /* Contacto con sublínea para Empresa */
    .p-contacto{ display:block; min-width:0; }
    .p-contacto .p-nombre{ display:block; font-weight:600; }
    .p-contacto .p-empresa{ display:block; font-size:12px; color:#6b7280; line-height:1.2; }

    /* Notas inline con ellipsis */
    .cell-inline{ display:flex; align-items:center; gap:6px; min-width:0; }
    .cell-inline .ellipsisCell{ flex:1 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    /* Acciones: que no se recorten */
    #tablaPersonas td:last-child{ overflow:visible!important; }
    #tablaPersonas td.cell-actions .act{
      display:inline-flex; align-items:center; justify-content:center;
      width:32px; height:32px; margin-right:6px;
      border:1px solid #e5e7eb; border-radius:8px; background:#fff;
      box-shadow:0 2px 8px rgba(2,6,23,.05); cursor:pointer;
    }
    #tablaPersonas td.cell-actions .act:last-child{ margin-right:0; }
    #tablaPersonas td.cell-actions i.material-icons{ font-size:18px; line-height:18px; }
  `;
  if (!document.getElementById('personas-inline-styles')) {
    const s = document.createElement('style');
    s.id = 'personas-inline-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();

/* ------------ helpers ------------ */
const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const fmtDateYMD = (d) => {
  const x = d ? new Date(d) : new Date();
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
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
      // SIN 'f' => sin buscador nativo (usamos el externo de la barra)
      dom: 'Bltip',
      buttons: [
        { extend: 'excelHtml5', title: 'Agenda_de_Personas' },
        { extend: 'pdfHtml5',   title: 'Agenda_de_Personas', orientation: 'landscape', pageSize: 'A4' }
      ],
      pageLength: 10,
      order: [[0, 'desc']],
      autoWidth: false,
      responsive: false,   // respeta widths fijos
      scrollX: false,
      language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      /* THEAD original:
         0 Fecha | 1 Contacto | 2 Teléfono(s) | 3 Email | 4 Empresa | 5 Notas | 6 Acciones
         Email (3) y Empresa (4) quedan ocultos (la empresa se muestra debajo del contacto).
      */
      columnDefs: [
        { targets: 0, width: 110 },      // Fecha
        { targets: 1, width: null },     // Contacto (con empresa debajo)
        { targets: 2, width: 200 },      // Teléfono(s)
        { targets: 3, visible: false },  // Email (oculto)
        { targets: 4, visible: false },  // Empresa (oculto en vista)
        { targets: 5, width: 480 },      // Notas (ancha para evitar corte)
        { targets: 6, width: 180, orderable: false, searchable: false, className: 'cell-actions' } // Acciones más ancha
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
    .sort((a,b)=> (new Date(b.createdAt || b.fecha || 0)) - (new Date(a.createdAt || a.fecha || 0)) )
    .map(c => {
      const fStr = fmtDateYMD(c.createdAt || c.fecha || Date.now());
      const fKey = new Date(fStr).getTime();

      // Contacto + Empresa (empresa va en la sublínea)
      const nombre  = c.contactoNombre || c.contacto || c.nombre || '—';
      const empresa = c.proveedorNombre || '';
      const contactoCell = `
        <div class="p-contacto" title="${esc(nombre)}${empresa ? ' – ' + esc(empresa) : ''}">
          <span class="p-nombre">${esc(nombre)}</span>
          ${empresa ? `<span class="p-empresa">${esc(empresa)}</span>` : ''}
        </div>
      `.trim();

      const tels = Array.isArray(c.contactoTelefonos)
        ? c.contactoTelefonos.filter(Boolean).join(' / ')
        : (c.contactoTelefono || '');

      const emailExport = Array.isArray(c.contactoEmails)
        ? c.contactoEmails.filter(Boolean).join(' / ')
        : (c.contactoEmail || '');

      const notas = c.notas || c.notasContacto || '';

      const acciones = `
        <div class="cell-actions">
          <a href="#!" class="act icon-action icon-ver"     title="Ver detalle"       data-id="${esc(c._id||'')}"><i class="material-icons">visibility</i></a>
          <a href="#!" class="act icon-action icon-visita"  title="Registrar visita"  data-id="${esc(c._id||'')}"><i class="material-icons">event_available</i></a>
          <a href="#!" class="act icon-action icon-editar"  title="Editar"            data-id="${esc(c._id||'')}"><i class="material-icons">edit</i></a>
          <a href="#!" class="act icon-action icon-eliminar"title="Eliminar"          data-id="${esc(c._id||'')}"><i class="material-icons">delete</i></a>
        </div>
      `;

      // Orden según THEAD original (3 y 4 ocultas pero quedan para exportar)
      return [
        `<span data-order="${fKey}">${fStr}</span>`,  // 0 Fecha
        contactoCell,                                 // 1 Contacto (con empresa debajo)
        esc(String(tels || '')),                      // 2 Teléfono(s)
        esc(String(emailExport || '')),               // 3 Email (OCULTO)
        esc(String(empresa || '')),                   // 4 Empresa (OCULTO)
        `<span class="cell-inline"><span class="ellipsisCell" title="${esc(notas)}">${esc(notas)}</span></span>`, // 5 Notas
        acciones                                      // 6 Acciones
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
