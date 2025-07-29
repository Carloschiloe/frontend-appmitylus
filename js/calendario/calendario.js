import { getCentros } from '../core/almacenamiento.js';

let _eventosCalendario = [];
let _centros = [];
let _vistaLista = false; // Estado: calendario o lista

window.inicializarCalendarioMantenciones = async function() {
  // Contenedores
  let calendarioDiv = document.getElementById('calendarioTareas');
  calendarioDiv.innerHTML = '<div id="calendarMant"></div><div id="listaTareas" style="display:none;"></div>';

  // Carga los datos
  _centros = await getCentros();
  _eventosCalendario = [];
  _centros.forEach((c) => {
    (c.lines || []).forEach((l) => {
      (l.mantenciones || []).forEach((m) => {
        _eventosCalendario.push({
          centro: c.name,
          linea: l.number,
          tipo: m.tipo || m.titulo || 'Mantención',
          fecha: m.fecha,
          estado: m.estado,
          descripcion: m.descripcion,
        });
      });
    });
  });

  // Rellena combos
  cargarFiltroCentros();

  // Inicializa filtros
  M.FormSelect.init(document.querySelectorAll('select'));
  document.getElementById('filtroCentro').onchange = renderVistaActual;
  document.getElementById('filtroEstado').onchange = renderVistaActual;

  // Toggle lista/calendario
  document.getElementById('btnToggleVista').onclick = () => {
    _vistaLista = !_vistaLista;
    renderVistaActual();
    document.getElementById('btnToggleVista').textContent = _vistaLista ? 'Ver como Calendario' : 'Ver como Lista';
  };

  // Renderiza primera vez (calendario)
  _vistaLista = false;
  renderVistaActual();
};

function cargarFiltroCentros() {
  const filtroCentro = document.getElementById('filtroCentro');
  filtroCentro.innerHTML = '<option value="">Todos los centros</option>';
  _centros.forEach(c => {
    filtroCentro.innerHTML += `<option value="${c.name}">${c.name}</option>`;
  });
  M.FormSelect.init(filtroCentro);
}

function filtrarEventos() {
  const centroSel = document.getElementById('filtroCentro').value;
  const estadoSel = document.getElementById('filtroEstado').value;
  return _eventosCalendario.filter(ev =>
    (!centroSel || ev.centro === centroSel) &&
    (!estadoSel || ev.estado === estadoSel)
  );
}

function renderVistaActual() {
  if (_vistaLista) renderLista();
  else renderCalendario();
}

// --- Render lista de tareas ---
function renderLista() {
  document.getElementById('calendarMant').style.display = 'none';
  const listaDiv = document.getElementById('listaTareas');
  listaDiv.style.display = 'block';
  const eventos = filtrarEventos();
  if (!eventos.length) {
    listaDiv.innerHTML = '<p style="color:#888;">Sin tareas/mantenciones encontradas</p>';
    return;
  }
  let html = `<table class="striped highlight"><thead>
    <tr>
      <th>Centro</th><th>Línea</th><th>Título</th><th>Fecha</th><th>Estado</th><th>Acción</th>
    </tr></thead><tbody>`;
  eventos.forEach((ev, idx) => {
    html += `<tr>
      <td>${ev.centro}</td>
      <td>${ev.linea}</td>
      <td>${ev.tipo}</td>
      <td>${ev.fecha}</td>
      <td>${ev.estado}</td>
      <td>
        <a href="#!" class="btn-detalle-tarea" data-idx="${idx}">
          <i class="material-icons tiny blue-text">visibility</i>
        </a>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  listaDiv.innerHTML = html;

  // Handler para ver detalle
  listaDiv.querySelectorAll('.btn-detalle-tarea').forEach(btn => {
    btn.onclick = function() {
      mostrarDetalleTarea(eventos[+this.dataset.idx]);
    };
  });
  M.updateTextFields();
}

// --- Render calendario ---
function renderCalendario() {
  document.getElementById('calendarMant').style.display = '';
  document.getElementById('listaTareas').style.display = 'none';

  const calendarEl = document.getElementById('calendarMant');
  calendarEl.innerHTML = ''; // Limpia

  const eventos = filtrarEventos().map(ev => ({
    title: `${ev.centro} - Línea ${ev.linea}: ${ev.tipo}`,
    start: ev.fecha,
    end: ev.fecha,
    extendedProps: { ...ev }
  }));

  // FullCalendar necesita reinicializar (borra anterior)
  if (calendarEl._calendar) {
    calendarEl._calendar.destroy();
  }
  const calendar = new window.FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    height: 600,
    events: eventos,
    eventClick: function(info) {
      mostrarDetalleTarea(info.event.extendedProps);
    }
  });
  calendar.render();
  calendarEl._calendar = calendar;
}

function mostrarDetalleTarea(ev) {
  document.getElementById('detalleTitulo').textContent = ev.tipo + ' – ' + ev.centro;
  document.getElementById('detalleContenido').innerHTML =
    `<b>Línea:</b> ${ev.linea}<br>
     <b>Fecha:</b> ${ev.fecha}<br>
     <b>Estado:</b> ${ev.estado}<br>
     <b>Descripción:</b> ${ev.descripcion || ''}`;
  let instancia = M.Modal.getInstance(document.getElementById('modalDetalleTarea'));
  if (!instancia) instancia = M.Modal.init(document.getElementById('modalDetalleTarea'));
  instancia.open();
}
