// js/abastecimiento/contactos/contactos.js

// ==== CONFIG: Endpoints absolutos para el backend Railway ====
const API_URL = 'https://backend-appmitylus-production.up.railway.app/api';
// const API_PROVEEDORES = `${API_URL}/proveedores`;   // <--- ELIMINADO, YA NO SE USA
const API_CENTROS     = `${API_URL}/centros`;         // GET: lista de centros (incluye proveedor)
const API_CONTACTOS   = `${API_URL}/contactos`;       // GET y POST: contactos de abastecimiento

// ==== STATE GLOBAL ====
let listaProveedores = [];
let listaCentros = [];
let contactosGuardados = []; // Siempre desde MongoDB

// ==== UTILIDADES ====
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }

// ==== CARGAR DATOS DE API ====

// ——— AHORA SOLO CARGA CENTROS Y SACA PROVEEDORES DESDE ALLÍ ———

async function cargarCentros() {
  try {
    const res = await fetch(API_CENTROS);
    if (!res.ok) throw new Error('No se pudo cargar centros');
    listaCentros = await res.json();
    // EXTRAER proveedores únicos (por nombre, puedes ajustar por id si tienes)
    listaProveedores = [
      ...new Map(
        listaCentros
          .filter(c => c.proveedor) // solo los que tengan proveedor
          .map(c => [c.proveedor.toLowerCase().trim(), { nombre: c.proveedor }])
      ).values()
    ];
    console.log('[cargarCentros] Proveedores únicos:', listaProveedores);
    console.log('[cargarCentros] Centros:', listaCentros);
  } catch (e) {
    alert('Error al cargar centros');
    listaCentros = [];
    listaProveedores = [];
  }
}

async function cargarContactosGuardados() {
  try {
    const res = await fetch(API_CONTACTOS);
    if (!res.ok) throw new Error('No se pudo cargar contactos');
    contactosGuardados = await res.json();
    console.log('[cargarContactosGuardados] Contactos:', contactosGuardados);
  } catch (e) {
    contactosGuardados = [];
  }
}

// ==== BUSCADOR DE PROVEEDORES (tipo autocompletado) ====
function setupBuscadorProveedores() {
  const input = $('#buscadorProveedor');
  const datalist = $('#datalistProveedores');
  if (!input || !datalist) return;

  // Autocompleta proveedores por nombre
  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().trim();
    datalist.innerHTML = '';
    if (!val) return;

    const filtrados = listaProveedores.filter(p =>
      (p.nombre || '').toLowerCase().includes(val)
    );
    filtrados.slice(0, 15).forEach(prov => {
      const opt = document.createElement('option');
      opt.value = prov.nombre;
      datalist.appendChild(opt);
    });
  });

  // Al seleccionar un proveedor, mostrar sus centros
  input.addEventListener('change', () => {
    const val = input.value.toLowerCase().trim();
    const prov = listaProveedores.find(p => (p.nombre || '').toLowerCase() === val);
    if (prov) {
      mostrarCentrosDeProveedor(prov);
      $('#proveedorId').value = prov.nombre; // puedes usar un ID si lo tienes
      $('#proveedorNombre').value = prov.nombre;
    } else {
      // Limpiar selects y campos si no coincide
      $('#proveedorId').value = '';
      $('#proveedorNombre').value = '';
      limpiarCamposCentro();
      $('#selectCentro').innerHTML = '<option value="" disabled selected>Selecciona un centro</option>';
      $('#selectCentro').disabled = true;
    }
  });
}

// ==== MOSTRAR CENTROS DEL PROVEEDOR SELECCIONADO ====
function mostrarCentrosDeProveedor(prov) {
  const select = $('#selectCentro');
  if (!select) return;

  // Filtrar centros asociados por proveedor
  const centros = listaCentros.filter(c =>
    (c.proveedor || '').toLowerCase() === (prov.nombre || '').toLowerCase()
  );

  select.innerHTML = '<option value="" disabled selected>Selecciona un centro</option>';
  centros.forEach(centro => {
    const opt = document.createElement('option');
    opt.value = centro._id || centro.id;
    opt.textContent = `${centro.code} – ${centro.comuna || ''} (${centro.hectareas || '-'} ha)`;
    opt.dataset.centroInfo = JSON.stringify(centro);
    select.appendChild(opt);
  });

  select.disabled = centros.length === 0;
  limpiarCamposCentro();
}

// ==== LLENAR AUTOMÁTICAMENTE DATOS DEL CENTRO ====
$('#selectCentro')?.addEventListener('change', function () {
  const centroId = this.value;
  const centro = listaCentros.find(c => (c._id || c.id) == centroId);
  if (!centro) return;
  $('#centroId').value = centro._id || centro.id;
  $('#centroCodigo').value = centro.code || '';
  $('#centroComuna').value = centro.comuna || '';
  $('#centroHectareas').value = centro.hectareas || '';
});

function limpiarCamposCentro() {
  $('#centroId').value = '';
  $('#centroCodigo').value = '';
  $('#centroComuna').value = '';
  $('#centroHectareas').value = '';
}

// ==== GUARDAR CONTACTO EN BACKEND ====
function setupFormulario() {
  const form = $('#formContacto');
  if (!form) return;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Obtener datos
    const proveedorId = $('#proveedorId').value;
    const proveedorNombre = $('#proveedorNombre').value;
    const centroId = $('#centroId').value;
    const centroCodigo = $('#centroCodigo').value;
    const centroComuna = $('#centroComuna').value;
    const centroHectareas = $('#centroHectareas').value;
    const resultado = $('#resultadoContacto').value;
    const notas = $('#notasContacto').value;
    const fecha = new Date().toISOString();

    // Validar
    if (!proveedorId || !proveedorNombre || !resultado) {
      alert('Debes seleccionar proveedor, resultado y centro.');
      return;
    }

    const nuevo = {
      proveedorId,
      proveedorNombre,
      centroId,
      centroCodigo,
      centroComuna,
      centroHectareas,
      resultado,
      notas,
      fecha
    };

    try {
      const res = await fetch(API_CONTACTOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevo)
      });
      if (!res.ok) throw new Error('No se pudo guardar el contacto');
      await cargarContactosGuardados();
      renderTablaContactos();
      form.reset();
      limpiarCamposCentro();
      $('#selectCentro').innerHTML = '<option value="" disabled selected>Selecciona un centro</option>';
      $('#selectCentro').disabled = true;
    } catch (err) {
      alert('Error al guardar contacto. Intenta de nuevo.');
    }
  });
}

// ==== TABLA DE CONTACTOS GUARDADOS ====
function renderTablaContactos() {
  const tbody = $('#tablaContactos tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!contactosGuardados.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:#888">No hay contactos registrados aún.</td></tr>`;
    return;
  }

  contactosGuardados.forEach(contacto => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${contacto.fecha ? contacto.fecha.slice(0,10) : ''}</td>
      <td>${contacto.proveedorNombre || ''}</td>
      <td>${contacto.centroCodigo || '-'}</td>
      <td>${contacto.centroComuna || '-'}</td>
      <td>${contacto.centroHectareas || '-'}</td>
      <td>${contacto.resultado || ''}</td>
      <td>${contacto.notas || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==== EXPORTA PARA EL INDEX.JS ====
export async function initContactosTab() {
  await cargarCentros(); // Esto carga también listaProveedores
  await cargarContactosGuardados();
  setupBuscadorProveedores();
  setupFormulario();
  renderTablaContactos();
}
