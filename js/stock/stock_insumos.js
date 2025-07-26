import {
  apiGetMovimientos,
  apiCreateMovimiento,
  apiUpdateMovimiento,
  apiDeleteMovimiento
} from '../core/api_insumos.js';

let idxEditando = null;
let movimientosCache = [];

// Render tabla con datos
async function renderTabla() {
  const tbody = document.getElementById('tablaInsumosBody');
  if (!tbody) return;

  // Si ya existe DataTable destruye
  if (window.$ && window.$.fn.dataTable && $('#tablaInsumos').hasClass('dataTable')) {
    $('#tablaInsumos').DataTable().destroy();
  }

  tbody.innerHTML = movimientosCache.map((m, idx) => `
    <tr>
      <td>${new Date(m.fecha).toLocaleDateString()}</td>
      <td>${m.insumo}</td>
      <td>${m.formato || '-'}</td>
      <td>
        <span class="badge ${m.movimiento === 'Ingreso' ? 'green' : 'red'} white-text">
          ${m.movimiento}
        </span>
      </td>
      <td>${m.cantidad}</td>
      <td>${m.unidad}</td>
      <td>${m.ubicacion || '-'}</td>
      <td>${m.responsable || '-'}</td>
      <td>${m.obs || '-'}</td>
      <td>
        <button class="btn-small blue lighten-1" onclick="editarMovimiento(${idx})">
          <i class="material-icons">edit</i>
        </button>
        <button class="btn-small red lighten-1" onclick="eliminarMovimiento(${idx})">
          <i class="material-icons">delete</i>
        </button>
      </td>
    </tr>
  `).join('');

  $('#tablaInsumos').DataTable({
    dom: 'Bfrtip',
    buttons: [
      { extend: 'excelHtml5', text: '<i class="material-icons left">table_chart</i>Excel', className: 'btn teal' },
      { extend: 'pdfHtml5', text: '<i class="material-icons left">picture_as_pdf</i>PDF', className: 'btn teal' }
    ],
    order: [[0, 'desc']],
    pageLength: 10,
    destroy: true,
    language: { url: "js/locales/es-ES.json" }
  });

  setTimeout(() => {
    $('.dt-buttons .btn').addClass('waves-effect');
  }, 250);
}

// Cargar y renderizar movimientos (desde backend)
async function cargarMovimientos() {
  try {
    movimientosCache = await apiGetMovimientos();
    renderTabla();
    renderFiltrosSidebar();
    renderResumenStock();
  } catch (error) {
    M.toast({ html: 'Error cargando movimientos', classes: 'red' });
    console.error(error);
  }
}

// Guardar movimiento (crear o actualizar)
async function guardarMovimiento(data) {
  try {
    if (idxEditando === null) {
      await apiCreateMovimiento(data);
      M.toast({ html: 'Movimiento registrado', classes: 'teal' });
    } else {
      const id = movimientosCache[idxEditando]._id;
      await apiUpdateMovimiento(id, data);
      M.toast({ html: 'Movimiento actualizado', classes: 'teal' });
      idxEditando = null;
    }
    await cargarMovimientos();
  } catch (error) {
    M.toast({ html: 'Error guardando movimiento', classes: 'red' });
    console.error(error);
  }
}

// Eliminar movimiento
async function eliminarMovimiento(idx) {
  if (!confirm('¿Seguro que quieres eliminar este movimiento?')) return;
  try {
    const id = movimientosCache[idx]._id;
    await apiDeleteMovimiento(id);
    M.toast({ html: 'Movimiento eliminado', classes: 'red' });
    await cargarMovimientos();
  } catch (error) {
    M.toast({ html: 'Error eliminando movimiento', classes: 'red' });
    console.error(error);
  }
}

// Editar movimiento (cargar en modal)
function editarMovimiento(idx) {
  const mov = movimientosCache[idx];
  idxEditando = idx;
  const form = document.getElementById('formInsumoMov');
  if (!form) return;
  form.fecha.value = new Date(mov.fecha).toISOString().slice(0,10);
  form.insumo.value = mov.insumo;
  form.formato.value = mov.formato || '';
  form.movimiento.value = mov.movimiento;
  form.cantidad.value = mov.cantidad;
  form.unidad.value = mov.unidad;
  form.ubicacion.value = mov.ubicacion || '';
  form.responsable.value = mov.responsable || '';
  form.obs.value = mov.obs || '';
  M.updateTextFields();
  M.FormSelect.init(form.querySelectorAll('select'));
  M.Modal.getInstance(document.getElementById('modalInsumoMov')).open();
}

// Filtros y búsqueda (igual que antes, pero sobre movimientosCache)
function filtrarTablaManual() {
  const { texto, insumo, desde, hasta } = getFiltrosSidebar();
  const resultado = movimientosCache.filter(m => {
    const cumpleTexto =
      m.insumo.toLowerCase().includes(texto) ||
      (m.formato && m.formato.toLowerCase().includes(texto)) ||
      (m.responsable && m.responsable.toLowerCase().includes(texto)) ||
      (m.ubicacion && m.ubicacion.toLowerCase().includes(texto)) ||
      (m.obs && m.obs.toLowerCase().includes(texto));
    const cumpleInsumo = !insumo || m.insumo === insumo;
    let cumpleFecha = true;
    if (desde) cumpleFecha = m.fecha >= desde;
    if (hasta && cumpleFecha) cumpleFecha = m.fecha <= hasta;
    return cumpleTexto && cumpleInsumo && cumpleFecha;
  });
  renderTablaFiltrada(resultado);
}

// Render tabla filtrada sin tocar cache original
function renderTablaFiltrada(movs) {
  const tbody = document.getElementById('tablaInsumosBody');
  if (!tbody) return;

  // Destruye tabla actual si existe
  if (window.$ && window.$.fn.dataTable && $('#tablaInsumos').hasClass('dataTable')) {
    $('#tablaInsumos').DataTable().destroy();
  }

  tbody.innerHTML = movs.map((m, idx) => `
    <tr>
      <td>${new Date(m.fecha).toLocaleDateString()}</td>
      <td>${m.insumo}</td>
      <td>${m.formato || '-'}</td>
      <td>
        <span class="badge ${m.movimiento === 'Ingreso' ? 'green' : 'red'} white-text">
          ${m.movimiento}
        </span>
      </td>
      <td>${m.cantidad}</td>
      <td>${m.unidad}</td>
      <td>${m.ubicacion || '-'}</td>
      <td>${m.responsable || '-'}</td>
      <td>${m.obs || '-'}</td>
      <td>
        <button class="btn-small blue lighten-1" onclick="editarMovimiento(${idx})">
          <i class="material-icons">edit</i>
        </button>
        <button class="btn-small red lighten-1" onclick="eliminarMovimiento(${idx})">
          <i class="material-icons">delete</i>
        </button>
      </td>
    </tr>
  `).join('');

  $('#tablaInsumos').DataTable({
    dom: 'Bfrtip',
    buttons: [
      { extend: 'excelHtml5', text: '<i class="material-icons left">table_chart</i>Excel', className: 'btn teal' },
      { extend: 'pdfHtml5', text: '<i class="material-icons left">picture_as_pdf</i>PDF', className: 'btn teal' }
    ],
    order: [[0, 'desc']],
    pageLength: 10,
    destroy: true,
    language: { url: "js/locales/es-ES.json" }
  });

  setTimeout(() => {
    $('.dt-buttons .btn').addClass('waves-effect');
  }, 250);
}

// Filtros
function getFiltrosSidebar() {
  return {
    texto: document.getElementById('inputBuscarMov').value.toLowerCase(),
    insumo: document.getElementById('comboFiltroInsumo').value,
    desde: document.getElementById('fechaFiltroDesde').value,
    hasta: document.getElementById('fechaFiltroHasta').value
  };
}

// Renderiza los filtros de la sidebar
function renderFiltrosSidebar() {
  M.FormSelect.init(document.querySelectorAll('select'));
}

// Render resumen stock por insumo y formato
function renderResumenStock() {
  const stockMap = {};
  movimientosCache.forEach(mov => {
    const nombre = mov.insumo.trim();
    const formato = (mov.formato || '-').trim();
    if (!stockMap[nombre]) stockMap[nombre] = {};
    if (!stockMap[nombre][formato]) stockMap[nombre][formato] = { cantidad: 0, unidad: mov.unidad };
    const cant = parseFloat(mov.cantidad);
    if (mov.movimiento === 'Ingreso') stockMap[nombre][formato].cantidad += cant;
    else if (mov.movimiento === 'Egreso') stockMap[nombre][formato].cantidad -= cant;
  });

  let html = `<div class="row" style="margin-bottom:14px;">`;
  Object.entries(stockMap).forEach(([nombre, formatos]) => {
    html += `
      <div class="col s12 m6 l4 xl3">
        <div class="card stock-card">
          <div class="card-content">
            <span class="card-title">
              <i class="material-icons left">inventory_2</i>
              ${nombre}
            </span>
            <ul>
              ${
                Object.entries(formatos).map(([formato, info]) =>
                  `<li>
                    <b>${formato}:</b> ${info.cantidad} <span style="font-size:.97rem;">${info.unidad}</span>
                  </li>`
                ).join('')
              }
            </ul>
            <span class="stock-label">Stock por formato</span>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  document.getElementById('resumenStock').innerHTML = html;
}

// Reset modal y abrir
function showModal() {
  M.Modal.getInstance(document.getElementById('modalInsumoMov')).open();
}

// SOLO UNA declaración de resetModalForm
function resetModalForm() {
  idxEditando = null;
  const form = document.getElementById('formInsumoMov');
  if (!form) return;
  form.reset();
  M.updateTextFields();
  M.FormSelect.init(form.querySelectorAll('select'));
}

// Listeners delegados (una vez)
function setupListeners() {
  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btnFiltrarMov') filtrarTablaManual();
    if (e.target && e.target.id === 'btnLimpiarFiltros') limpiarFiltros();
    if (e.target && e.target.id === 'btnAgregarMovimientoFAB') {
      resetModalForm();
      showModal();
    }
  });

  document.body.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'formInsumoMov') {
      e.preventDefault();
      const form = e.target;
      const nuevoMov = {
        fecha: form.fecha.value,
        insumo: form.insumo.value.trim(),
        formato: form.formato.value.trim(),
        movimiento: form.movimiento.value,
        cantidad: Number(form.cantidad.value),
        unidad: form.unidad.value,
        ubicacion: form.ubicacion.value.trim(),
        responsable: form.responsable.value.trim(),
        obs: form.obs.value.trim()
      };
      if (!nuevoMov.fecha || !nuevoMov.insumo || !nuevoMov.movimiento || isNaN(nuevoMov.cantidad)) {
        M.toast({ html: 'Faltan datos obligatorios', classes: 'red' });
        return;
      }
      guardarMovimiento(nuevoMov);
      const modal = document.getElementById('modalInsumoMov');
      if (modal && M.Modal.getInstance(modal)) M.Modal.getInstance(modal).close();
    }
  });
}

// Limpiar filtros
function limpiarFiltros() {
  document.getElementById('inputBuscarMov').value = "";
  document.getElementById('comboFiltroInsumo').value = "";
  document.getElementById('fechaFiltroDesde').value = "";
  document.getElementById('fechaFiltroHasta').value = "";
  M.FormSelect.init(document.querySelectorAll('select'));
  filtrarTablaManual();
}

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await cargarMovimientos();
    setupListeners();
  } catch (error) {
    M.toast({ html: 'Error inicializando módulo', classes: 'red' });
    console.error(error);
  }
});

// Exportar funciones para uso global (para botones inline)
window.eliminarMovimiento = eliminarMovimiento;
window.editarMovimiento = editarMovimiento;

// Exporta la función para otros módulos
export { renderFiltrosSidebar };
