import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto, abrirModalVisita } from './visitas.js';

// 👇 helpers de fallback (no escriben nada)
const norm = (s='') => String(s).trim().toLowerCase();
const provKeyOf = (ct) => (ct?.proveedorKey && ct.proveedorKey.length)
  ? ct.proveedorKey
  : norm(ct?.proveedor || '');

function codigoPorCentroId(id) {
  if (!id) return '';
  const ct = (state.listaCentros || []).find(x => String(x._id ?? x.id) === String(id));
  return ct ? String(ct.codigo ?? ct.code ?? ct.Codigo ?? '') : '';
}
function comunaPorCodigo(codigo) {
  if (!codigo) return '';
  const cod = String(codigo);
  const ct = (state.listaCentros || []).find(x => {
    const cs = [x.codigo, x.code, x.Codigo].filter(v => v!=null).map(String);
    return cs.includes(cod);
  });
  return ct?.comuna ?? ct?.Comuna ?? '';
}
function codigoPorProveedorYComuna(proveedorKey, comuna) {
  const cand = (state.listaCentros || []).filter(x => provKeyOf(x) === proveedorKey);
  if (!cand.length) return '';
  const porComuna = cand.filter(x => (x.comuna ?? x.Comuna) === comuna);
  const lista = (porComuna.length ? porComuna : cand)
    .map(x => String(x.codigo ?? x.code ?? x.Codigo ?? '')).filter(Boolean);
  const unicos = [...new Set(lista)];
  return unicos.length === 1 ? unicos[0] : '';
}
const esCodigoValido = (x) => /^\d{4,7}$/.test(String(x || ''));

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

      // --------- Fallbacks SOLO PARA MOSTRAR ----------
      // 1) Centro (código)
      let centroCodigo = c.centroCodigo;
      if (!esCodigoValido(centroCodigo)) {
        centroCodigo = codigoPorCentroId(c.centroId)
                    || codigoPorProveedorYComuna(c.proveedorKey, c.centroComuna || c.comuna)
                    || ''; // si hay ambigüedad, mostramos vacío
      }
      // 2) Comuna
      const comuna = (c.centroComuna || c.comuna || comunaPorCodigo(centroCodigo) || '');

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
        esc(c.proveedorNombre || ''),
        esc(centroCodigo),                 // ← Centro (con fallback)
        esc(comuna),                       // ← Comuna (con fallback)
        esc(c.tieneMMPP || ''),
        c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '',
        esc(c.dispuestoVender || ''),
        (c.tonsDisponiblesAprox ?? '') + '',
        esc(c.vendeActualmenteA || ''),
        acciones
      ];
    });

  if (state.dt && jq) { state.dt.clear(); state.dt.rows.add(filas).draw(); return; }

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
