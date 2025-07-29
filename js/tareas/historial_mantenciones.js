import { getCentros } from '../core/almacenamiento.js';

let todasMantenciones = [];

document.addEventListener('DOMContentLoaded', () => {
  // Solo inicializa si existe la pestaña/cont
  const cont = document.getElementById('historialMantenciones');
  if (!cont) return;
  cargarHistorial();
});

async function cargarHistorial() {
  const cont = document.getElementById('historialMantenciones');
  cont.innerHTML = '<div class="progress"><div class="indeterminate"></div></div>';

  const centros = await getCentros();
  todasMantenciones = [];
  centros.forEach((centro, centroIdx) => {
    (centro.lines || []).forEach((linea, lineaIdx) => {
      (linea.mantenciones || []).forEach((m, mantIdx) => {
        todasMantenciones.push({
          centroId: centro._id,
          lineaId: linea._id,
          centro: centro.name,
          linea: linea.number,
          fecha: m.fecha,
          estado: m.estado,
          titulo: m.tipo || m.titulo || 'Mantención',
          descripcion: m.descripcion || '',
        });
      });
    });
  });

  // Ordena por fecha descendente
  todasMantenciones.sort((a, b) => b.fecha.localeCompare(a.fecha));
  renderTablaHistorial();
  renderFiltros();
}

function renderFiltros() {
  const centrosSet = [...new Set(todasMantenciones.map(m => m.centro))];
  const filtroCentro = document.getElementById('filtroHistCentro');
  const filtroLinea = document.getElementById('filtroHistLinea');
  const filtroEstado = document.getElementById('filtroHistEstado');

  filtroCentro.innerHTML = `<option value="">Todos los centros</option>` +
    centrosSet.map(c => `<option value="${c}">${c}</option>`).join('');
  filtroLinea.innerHTML = `<option value="">Todas las líneas</option>`;
  filtroEstado.innerHTML = `
    <option value="">Todos los estados</option>
    <option value="Pendiente">Pendiente</option>
    <option value="En curso">En curso</option>
    <option value="Completada">Completada</option>
  `;

  M.FormSelect.init(filtroCentro);
  M.FormSelect.init(filtroLinea);
  M.FormSelect.init(filtroEstado);

  // Cambia líneas dinámicamente al cambiar centro
  filtroCentro.onchange = function() {
    const lineasSet = [
      ...new Set(
        todasMantenciones
          .filter(m => !this.value || m.centro === this.value)
          .map(m => m.linea)
      )
    ];
    filtroLinea.innerHTML = `<option value="">Todas las líneas</option>` +
      lineasSet.map(l => `<option value="${l}">${l}</option>`).join('');
    M.FormSelect.init(filtroLinea);
    renderTablaHistorial();
  };

  filtroLinea.onchange = renderTablaHistorial;
  filtroEstado.onchange = renderTablaHistorial;
}

function renderTablaHistorial() {
  const filtroCentro = document.getElementById('filtroHistCentro').value;
  const filtroLinea = document.getElementById('filtroHistLinea').value;
  const filtroEstado = document.getElementById('filtroHistEstado').value;
  const cont = document.getElementById('historialMantenciones');

  const dataFiltrada = todasMantenciones.filter(m =>
    (!filtroCentro || m.centro === filtroCentro) &&
    (!filtroLinea || m.linea == filtroLinea) &&
    (!filtroEstado || m.estado === filtroEstado)
  );

  if (!dataFiltrada.length) {
    cont.innerHTML = '<p style="color:#888;">No hay mantenciones con esos filtros</p>';
    return;
  }

  let html = `
    <table class="striped highlight responsive-table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Centro</th>
          <th>Línea</th>
          <th>Título</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${dataFiltrada.map((m, idx) => `
          <tr class="row-mant-hist" data-idx="${idx}">
            <td>${m.fecha}</td>
            <td>${m.centro}</td>
            <td>${m.linea}</td>
            <td>${m.titulo}</td>
            <td>
              <span class="chip ${estadoColor(m.estado)}">
                ${iconoEstado(m.estado)} ${m.estado}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  cont.innerHTML = `
    <div class="row" style="margin-bottom: 10px;">
      <div class="input-field col s4">
        <select id="filtroHistCentro"></select>
        <label for="filtroHistCentro">Filtrar por centro</label>
      </div>
      <div class="input-field col s4">
        <select id="filtroHistLinea"></select>
        <label for="filtroHistLinea">Filtrar por línea</label>
      </div>
      <div class="input-field col s4">
        <select id="filtroHistEstado"></select>
        <label for="filtroHistEstado">Filtrar por estado</label>
      </div>
    </div>
    ${html}
  `;

  renderFiltros();

  // Detalle al click en fila
  cont.querySelectorAll('.row-mant-hist').forEach(row => {
    row.onclick = function() {
      const m = dataFiltrada[this.dataset.idx];
      if (!m) return;
      mostrarDetalleModal(m);
    };
  });
}

function estadoColor(estado) {
  if (estado === 'Pendiente') return 'red lighten-4 red-text';
  if (estado === 'En curso') return 'amber lighten-4 orange-text';
  if (estado === 'Completada') return 'green lighten-4 green-text';
  return '';
}
function iconoEstado(estado) {
  if (estado === 'Pendiente') return '<i class="material-icons tiny left">error_outline</i>';
  if (estado === 'En curso') return '<i class="material-icons tiny left">hourglass_full</i>';
  if (estado === 'Completada') return '<i class="material-icons tiny left">check_circle</i>';
  return '';
}

// Modal bonito
function mostrarDetalleModal(m) {
  let modal = document.getElementById('modalDetalleTarea');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalDetalleTarea';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h5 id="detalleTitulo"></h5>
        <div id="detalleContenido"></div>
      </div>
      <div class="modal-footer">
        <button class="modal-close btn grey lighten-1">Cerrar</button>
      </div>
    `;
    document.body.appendChild(modal);
    M.Modal.init(modal);
  }
  document.getElementById('detalleTitulo').textContent = m.titulo + ' – ' + m.centro;
  document.getElementById('detalleContenido').innerHTML = `
    <b>Fecha:</b> ${m.fecha}<br>
    <b>Línea:</b> ${m.linea}<br>
    <b>Estado:</b> <span class="chip ${estadoColor(m.estado)}">${iconoEstado(m.estado)} ${m.estado}</span><br>
    <b>Descripción:</b> ${m.descripcion || '-'}
  `;
  let instancia = M.Modal.getInstance(modal);
  if (!instancia) instancia = M.Modal.init(modal);
  instancia.open();
}
