// /js/contactos/personas.js
import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto, abrirModalVisita } from './visitas.js';

/* ============ estilos específicos (sticky + ellipsis) ============ */
(function injectStyles() {
  const css = `
  #tablaPersonas thead th { position: sticky; top: 0; z-index: 2; background: #fff; }
  #tablaPersonas td .ellipsisCell { 
    display: inline-block; max-width: 28ch; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    vertical-align: middle;
  }
  #tablaPersonas td .ellipsisEmpresa { max-width: 26ch; }
  #tablaPersonas td .ellipsisNotas   { max-width: 40ch; }
  #tablaPersonas a.icon-action { display:inline-flex; align-items:center; gap:2px; margin-left:.35rem; }
  #tablaPersonas a.icon-action i { font-size:18px; line-height:18px; }
  #tablaPersonas .chip.small { height: 22px; line-height: 22px; font-size: 12px; }
  `;
  if (!document.getElementById('personas-inline-styles')) {
    const s = document.createElement('style');
    s.id = 'personas-inline-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();

/* ============ helpers ============ */
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

/* ============ estado local ============ */
let dtP = null;
let filtroActualP = 'todos'; // 'todos' | 'sin' | 'con'

/* ============ init ============ */
export function initPersonasTab() {
  const jq = window.jQuery || window.$;
  const tabla = document.getElementById('tablaPersonas');
  if (!tabla) return;

  // chips de filtro
  document.getElementById('fltTodosP')?.addEventListener('click', () => {
    filtroActualP = 'todos'; renderTablaPersonas(); actualizarKPIs();
  });
  document.getElementById('fltSinP')?.addEventListener('click', () => {
    filtroActualP = 'sin';   renderTablaPersonas(); actualizarKPIs();
  });
  document.getElementById('fltConP')?.addEventListener('click', () => {
    filtroActualP = 'con';   renderTablaPersonas(); actualizarKPIs();
  });

  // listeners externos para refrescar
  document.addEventListener('reload-tabla-contactos', () => {
    renderTablaPersonas(); actualizarKPIs();
  });

  // DataTable solo para Personas (no toca contactos ni visitas)
  if (jq && !dtP) {
    dtP = jq('#tablaPersonas').DataTable({
      dom: 'Bfrtip',
      buttons: [
        { extend: 'excelHtml5', title: 'Agenda_de_Personas' },
        { extend: 'pdfHtml5',   title: 'Agenda_de_Personas', orientation: 'landscape', pageSize: 'A4' }
      ],
      pageLength: 10,
      order: [[0, 'desc']], // fecha
      autoWidth: false,
      language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      columnDefs: [
        { targets: 0, width: '110px' }, // Fecha
        { targets: 4, width: '260px' }, // Empresa
        { targets: 5, width: '380px' }, // Notas
        { targets: 6, orderable: false, searchable: false, width: '140px' } // Acciones
      ]
    });

    // acciones por fila (delegadas)
    jq('#tablaPersonas tbody')
      .on('click', 'a.icon-ver', function() {
        const id = this.dataset.id;
        const c = (state.contactosGuardados || []).find(x => String(x._id) === String(id));
        if (c) abrirDetalleContacto(c);
      })
      .on('click', 'a.icon-visita', function() {
        const id = this.dataset.id;
        const c = (state.contactosGuardados || []).find(x => String(x._id) === String(id));
        if (c) abrirModalVisita(c);
      })
      .on('click', 'a.icon-editar', function() {
        const id = this.dataset.id;
        const c = (state.contactosGuardados || []).find(x => String(x._id) === String(id));
        if (c) abrirEdicion(c);
      })
      .on('click', 'a.icon-eliminar', async function() {
        const id = this.dataset.id;
        if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
        try { await eliminarContacto(id); renderTablaPersonas(); actualizarKPIs(); }
        catch (e) { console.error(e); M.toast?.({ html: 'No se pudo eliminar', displayLength: 2000 }); }
      })
      // Asociar / Cambiar empresa (icono)
      .on('click', 'a.asociar-btn', function(e) {
        e.preventDefault();
        const id = this.dataset.id;
        state.asociarContactoId = id; // lo toma el módulo de asociación
        try { document.dispatchEvent(new CustomEvent('asociar-open', { detail: { contactoId: id } })); } catch {}
        const modal = document.getElementById('modalAsociar');
        if (modal && window.M && M.Modal) {
          const inst = M.Modal.getInstance(modal) || M.Modal.init(modal, {});
          inst.open();
        }
      });
  }

  renderTablaPersonas();
  actualizarKPIs();
}

/* ============ render ============ */
export function renderTablaPersonas() {
  const jq = window.jQuery || window.$;
  const lista = (state.contactosGuardados || []).slice();

  // filtro
  const filtrada = lista.filter(c => {
    if (filtroActualP === 'sin') return !hasEmpresa(c);
    if (filtroActualP === 'con') return hasEmpresa(c);
    return true;
  });

  // filas
  const filas = filtrada
    .sort((a, b) => {
      const da = new Date(a.createdAt || a.fecha || 0).getTime();
      const db = new Date(b.createdAt || b.fecha || 0).getTime();
      return db - da; // desc
    })
    .map(c => {
      const f = fmtDateYMD(c.createdAt || c.fecha || Date.now());
      const tels = Array.isArray(c.contactoTelefonos) ? c.contactoTelefonos.join(' / ') : (c.contactoTelefono || '');
      const mails = Array.isArray(c.contactoEmails) ? c.contactoEmails.join(' / ') : (c.contactoEmail || '');

      // Empresa: chip + iconito
      let empresaCell = '';
      if (hasEmpresa(c)) {
        const name = esc(c.proveedorNombre || '');
        empresaCell = `
          <span class="ellipsisCell ellipsisEmpresa" title="${name}">${name}</span>
          <a href="#!" class="icon-action asociar-btn" title="Cambiar empresa" data-id="${c._id}">
            <i class="material-icons">sync</i>
          </a>
        `;
      } else {
        empresaCell = `
          <span class="chip red lighten-5 red-text text-darken-2 small">Sin empresa</span>
          <a href="#!" class="icon-action asociar-btn" title="Asociar a empresa" data-id="${c._id}">
            <i class="material-icons">person_add</i>
          </a>
        `;
      }

      const notas = esc(c.notas || c.notasContacto || '');
      const acciones = `
        <a href="#!" class="icon-action icon-ver"     title="Ver detalle"       data-id="${c._id}"><i class="material-icons">visibility</i></a>
        <a href="#!" class="icon-action icon-visita"  title="Registrar visita"   data-id="${c._id}"><i class="material-icons">event_available</i></a>
        <a href="#!" class="icon-action icon-editar"  title="Editar"             data-id="${c._id}"><i class="material-icons">edit</i></a>
        <a href="#!" class="icon-action icon-eliminar"title="Eliminar"           data-id="${c._id}"><i class="material-icons">delete</i></a>
      `;

      return [
        `<span data-order="${new Date(f).getTime()}">${f}</span>`,
        esc(c.contactoNombre || ''),                  // 🔧 CAMBIO: solo persona, sin fallback a empresa
        esc(String(tels)),
        esc(String(mails)),
        empresaCell,
        `<span class="ellipsisCell ellipsisNotas" title="${notas}">${notas}</span>',
        acciones
      ];
    });

  if (dtP && jq) {
    dtP.clear();
    dtP.rows.add(filas);
    dtP.draw(false);
    return;
  }

  // Fallback sin DataTables (no debería usarse)
  const tbody = $('#tablaPersonas tbody');
  if (!tbody) return;
  tbody.innerHTML = filas.map(row => `<tr>${row.map(td => `<td>${td}</td>`).join('')}</tr>`).join('');
}

/* ============ KPIs ============ */
function actualizarKPIs() {
  const todos = state.contactosGuardados || [];
  const sin   = todos.filter(c => !hasEmpresa(c)).length;
  const con   = todos.filter(c =>  hasEmpresa(c)).length;

  // Visitas (30d) sin empresa — lo calculamos sólo si hay visitas en state
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
