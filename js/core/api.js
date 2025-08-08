// js/abastecimiento/contactos/contactos.js

import {
  apiGetProveedores,
  apiGetCentros,
  apiGetContactos,
  apiCreateContacto
} from '../../core/api.js';

// ==== STATE GLOBAL ====
let listaProveedores = [];
let listaCentros = [];
let contactosGuardados = []; // Siempre desde MongoDB

// ==== UTILIDADES ====
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }

// ==== CARGA DATOS DE API ====
async function cargarProveedores() {
  try {
    listaProveedores = await apiGetProveedores();
  } catch (e) {
    alert('Error al cargar proveedores');
    listaProveedores = [];
  }
}

async function cargarCentros() {
  try {
    listaCentros = await apiGetCentros();
  } catch (e) {
    alert('Error al cargar centros');
    listaCentros = [];
  }
}

async function cargarContactosGuardados() {
  try {
    contactosGuardados = await apiGetContactos();
  } catch (e) {
    contactosGuardados = [];
  }
}

// ==== BUSCADOR DE PROVEEDORES (autocompletado) ====
function setupBuscadorProveedores() {
  const input = $('#buscadorProveedor');
  const datalist = $('#datalistProveedores');
  if (!input || !datalist) return;

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().trim();
    datalist.innerHTML = '';
    if (!val) return;
    const filtrados = listaProveedores.filter(p =>
      (p.nombre || '').toLowerCase().includes(val) ||
      (p.apellido || '').toLowerCase().includes(val)
    );
    filtrados.slice(0, 15).forEach(prov => {
      const opt = document.createElement('option');
      opt.value = prov.nombre + (prov.apellido ? ' ' + prov.apellido : '');
      opt.dataset.proveedorId = prov._id || prov.id;
      datalist.appendChild(opt);
    });
  });

  input.addEventListener('change', () => {
    const val = input.value.toLowerCase().trim();
    const prov = listaProveedores.find(p =>
      ((p.nombre + (p.apellido ? ' ' + p.apellido : '')).toLowerCase() === val)
    );
    if (prov) {
      mostrarCentrosDeProveedor(prov);
      $('#proveedorId').value = prov._id || prov.id;
      $('#proveedorNombre').value = prov.nombre;
    } else {
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
  const centros = listaCentros.filter(c => {
    if (c.proveedorId && prov._id) return c.proveedorId === prov._id;
    return (c.proveedor || '').toLowerCase() === (prov.nombre || '').toLowerCase();
  });

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
      await apiCreateContacto(nuevo);
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
  await cargarProveedores();
  await cargarCentros();
  await cargarContactosGuardados();
  setupBuscadorProveedores();
  setupFormulario();
  renderTablaContactos();
}
