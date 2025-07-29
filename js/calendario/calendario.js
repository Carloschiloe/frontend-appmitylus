// js/calendario/calendario.js
import { getCentros } from '../core/almacenamiento.js';

window.inicializarCalendarioMantenciones = async function() {
  // Asegúrate que estamos en la pestaña correcta y que el contenedor existe
  const tabCalendario = document.getElementById('tab-calendario');
  if (!tabCalendario) return;

  // Renderiza los controles de filtros y vista
  tabCalendario.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
      <div>
        <label style="font-size:0.95rem">Centro:</label>
        <select id="filtroCentro">
          <option value="">Todos</option>
        </select>
      </div>
      <div>
        <label style="font-size:0.95rem">Estado:</label>
        <select id="filtroEstado">
          <option value="">Todos</option>
          <option value="Pendiente">Pendiente</option>
          <option value="En curso">En curso</option>
          <option value="Completada">Completada</option>
        </select>
      </div>
      <div>
        <label style="font-size:0.95rem;visibility:hidden;">.</label>
        <button id="btnVistaCalendario" class="btn-flat teal-text text-darken-2 active" style="font-weight:bold">Calendario</button>
        <button id="btnVistaLista" class="btn-flat teal-text text-darken-2">Lista</button>
      </div>
    </div>
    <div id="zonaVistaCalendario">
      <div id="calendarMant"></div>
    </div>
    <div id="zonaVistaLista" style="display:none;">
      <table class="striped" style="width:100%;" id="tablaListaTareas">
        <thead>
          <tr>
            <th>Centro</th><th>Línea</th><th>Título</th><th>Fecha</th><th>Estado</th><th>Descripción</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <!-- Modal detalle -->
    <div id="modalDetalleTarea" class="modal">
      <div class="modal-content">
        <h5 id="detalleTitulo"></h5>
        <div id="detalleContenido"></div>
      </div>
      <div class="modal-footer">
        <button class="modal-close btn-flat">Cerrar</button>
      </div>
    </div>
  `;

  // Inicializa Materialize para selects y modal
  M.FormSelect.init(document.querySelectorAll('select'));
  M.Modal.init(document.querySelectorAll('.modal'));

  // Referencias a controles
  const filtroCentro = document.getElementById('filtroCentro');
  const filtroEstado = document.getElementById('filtroEstado');
  const btnVistaCalendario = document.getElementById('btnVistaCalendario');
  const btnVistaLista = document.getElementById('btnVistaLista');
  const zonaVistaCalendario = document.getElementById('zonaVistaCalendario');
  const zonaVistaLista = document.getElementById('zonaVistaLista');

  // Carga los centros y mantenciones
  const centros = await getCentros();
  console.log('📦 Centros obtenidos en calendario:', centros);

  // Llena filtro de centros
  filtroCentro.innerHTML = '<option value="">Todos</option>';
  centros.forEach((c) => {
    filtroCentro.innerHTML += `<option value="${c.name}">${c.name}</option>`;
  });
  M.FormSelect.init(filtroCentro);

  // Genera lista de eventos para el calendario y la tabla
  function filtrarEventos() {
    const centroSel = filtroCentro.value;
    const estadoSel = filtroEstado.value;
    let eventos = [];
    centros.forEach((c) => {
      (c.lines || []).forEach((l) => {
        // Compatibilidad: usa mantenciones (o tareas)
        const tareas = l.mantenciones || l.tareas || [];
        tareas.forEach((m) => {
          // Filtros
          if (centroSel && c.name !== centroSel) return;
          if (estadoSel && m.estado !== estadoSel) return;
          eventos.push({
            title: `${c.name} - Línea ${l.number}: ${m.titulo || m.tipo || 'Mantención'}`,
            start: m.fecha,
            end: m.fecha,
            centro: c.name,
            linea: l.number,
            tipo: m.titulo || m.tipo || 'Mantención',
            estado: m.estado,
            descripcion: m.descripcion,
          });
        });
      });
    });
    return eventos;
  }

  // ------ Calendario ------
  let calendarInstance = null;
  function renderCalendario() {
    // Si ya hay un calendarInstance, destrúyelo antes de renderizar de nuevo (para evitar solapamientos)
    if (calendarInstance) {
      calendarInstance.destroy();
      calendarInstance = null;
    }
    const eventos = filtrarEventos();
    calendarInstance = new window.FullCalendar.Calendar(document.getElementById('calendarMant'), {
      initialView: 'dayGridMonth',
      locale: 'es',
      height: 600,
      events: eventos,
      eventClick: function(info) {
        // Muestra modal con detalle
        const { centro, linea, tipo, estado, descripcion } = info.event.extendedProps || info.event;
        document.getElementById('detalleTitulo').textContent = tipo + ' – ' + centro;
        document.getElementById('detalleContenido').innerHTML =
          `<b>Línea:</b> ${linea}<br>
           <b>Estado:</b> ${estado}<br>
           <b>Descripción:</b> ${descripcion || ''}`;
        let instancia = M.Modal.getInstance(document.getElementById('modalDetalleTarea'));
        if (!instancia) instancia = M.Modal.init(document.getElementById('modalDetalleTarea'));
        instancia.open();
      }
    });
    calendarInstance.render();
  }

  // ------ Lista ------
  function renderLista() {
    const eventos = filtrarEventos();
    const tbody = document.querySelector('#tablaListaTareas tbody');
    tbody.innerHTML = '';
    if (!eventos.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#888;">No hay mantenciones asignadas</td></tr>';
      return;
    }
    eventos.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.centro}</td>
        <td>${e.linea}</td>
        <td>${e.tipo}</td>
        <td>${e.start}</td>
        <td>${e.estado}</td>
        <td>${e.descripcion || ''}</td>
      `;
      // Al hacer click en la fila, muestra detalle
      tr.style.cursor = 'pointer';
      tr.onclick = () => {
        document.getElementById('detalleTitulo').textContent = e.tipo + ' – ' + e.centro;
        document.getElementById('detalleContenido').innerHTML =
          `<b>Línea:</b> ${e.linea}<br>
           <b>Estado:</b> ${e.estado}<br>
           <b>Descripción:</b> ${e.descripcion || ''}`;
        let instancia = M.Modal.getInstance(document.getElementById('modalDetalleTarea'));
        if (!instancia) instancia = M.Modal.init(document.getElementById('modalDetalleTarea'));
        instancia.open();
      };
      tbody.appendChild(tr);
    });
  }

  // ------ Cambios de filtro y vista ------
  function actualizarVista() {
    if (zonaVistaCalendario.style.display !== 'none') renderCalendario();
    else renderLista();
  }
  filtroCentro.onchange = actualizarVista;
  filtroEstado.onchange = actualizarVista;

  btnVistaCalendario.onclick = (e) => {
    e.preventDefault();
    zonaVistaCalendario.style.display = '';
    zonaVistaLista.style.display = 'none';
    btnVistaCalendario.classList.add('active');
    btnVistaLista.classList.remove('active');
    renderCalendario();
  };
  btnVistaLista.onclick = (e) => {
    e.preventDefault();
    zonaVistaCalendario.style.display = 'none';
    zonaVistaLista.style.display = '';
    btnVistaCalendario.classList.remove('active');
    btnVistaLista.classList.add('active');
    renderLista();
  };

  // Vista por defecto: calendario
  zonaVistaCalendario.style.display = '';
  zonaVistaLista.style.display = 'none';
  btnVistaCalendario.classList.add('active');
  btnVistaLista.classList.remove('active');
  renderCalendario();
};
