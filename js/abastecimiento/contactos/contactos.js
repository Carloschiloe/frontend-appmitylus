// js/abastecimiento/contactos/contactos.js

// ==== CONFIG: Endpoints absolutos para el backend Railway ====
const API_URL = 'https://backend-appmitylus-production.up.railway.app/api';
const API_CENTROS   = `${API_URL}/centros`;    // GET: lista de centros
const API_CONTACTOS = `${API_URL}/contactos`;  // GET y POST: contactos

// ==== STATE GLOBAL ====
let listaProveedores = []; // [{ nombreOriginal, nombreNormalizado, proveedorKey }]
let listaCentros = [];     // [{ proveedor, proveedorKey, code, comuna, ... }]
let contactosGuardados = [];

// ==== UTILIDADES ====
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const slug = (s) =>
  (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

// ==== CARGA DESDE API ====
async function cargarCentros() {
  try {
    const res = await fetch(API_CENTROS);
    if (!res.ok) throw new Error('No se pudo cargar centros');
    listaCentros = await res.json();

    // Proveedores únicos a partir de centros (usando proveedorKey si existe)
    const mapa = new Map(); // key: proveedorKey | slug(nombre) -> {nombreOriginal, nombreNormalizado, proveedorKey}
    for (const c of listaCentros) {
      const nombreOriginal = (c.proveedor || '').trim();
      if (!nombreOriginal) continue;
      const nombreNormalizado = nombreOriginal.toLowerCase().replace(/\s+/g, ' ');
      const key = c.proveedorKey && c.proveedorKey.length ? c.proveedorKey : slug(nombreOriginal);
      if (!mapa.has(key)) {
        mapa.set(key, { nombreOriginal, nombreNormalizado, proveedorKey: key });
      }
    }
    listaProveedores = Array.from(mapa.values());
  } catch (e) {
    console.error('[cargarCentros] error:', e);
    listaCentros = [];
    listaProveedores = [];
    M.toast?.({ html: 'Error al cargar centros', displayLength: 2500 });
  }
}

async function cargarContactosGuardados() {
  try {
    const res = await fetch(API_CONTACTOS);
    if (!res.ok) throw new Error('No se pudo cargar contactos');
    contactosGuardados = await res.json();
  } catch (e) {
    console.error('[cargarContactosGuardados] error:', e);
    contactosGuardados = [];
  }
}

// ==== BUSCADOR DE PROVEEDORES (datalist) ====
function setupBuscadorProveedores() {
  const input = $('#buscadorProveedor');
  const datalist = $('#datalistProveedores');
  if (!input || !datalist) return;

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().replace(/\s+/g, ' ').trim();
    datalist.innerHTML = '';
    if (!val) return;

    const filtrados = listaProveedores.filter(p =>
      p.nombreNormalizado.includes(val)
    );
    filtrados.slice(0, 20).forEach(prov => {
      const opt = document.createElement('option');
      opt.value = prov.nombreOriginal;
      datalist.appendChild(opt);
    });
  });

  // Al confirmar un proveedor (cambio de valor)
  input.addEventListener('change', () => {
    const valNorm = input.value.toLowerCase().replace(/\s+/g, ' ').trim();
    // Encuentra proveedor por nombre normalizado
    const prov = listaProveedores.find(p => p.nombreNormalizado === valNorm);
    if (prov) {
      // Set ocultos
      $('#proveedorKey').value = prov.proveedorKey;     // ← clave estable
      $('#proveedorNombre').value = prov.nombreOriginal;

      // Carga centros del proveedor
      mostrarCentrosDeProveedor(prov.proveedorKey);
    } else {
      // Limpia si no coincide
      $('#proveedorKey').value = '';
      $('#proveedorNombre').value = '';
      resetSelectCentros();
    }
  });
}

// ==== CENTROS DEL PROVEEDOR ====
function mostrarCentrosDeProveedor(proveedorKey) {
  const select = $('#selectCentro');
  if (!select) return;

  // Filtra por proveedorKey; si un centro no tiene key, compara por slug del nombre
  const centros = listaCentros.filter(c => {
    const keyCentro = c.proveedorKey && c.proveedorKey.length ? c.proveedorKey : slug(c.proveedor || '');
    return keyCentro === proveedorKey;
  });

  // Render opciones (primera opción: sin centro)
  let html = `<option value="" selected>Sin centro (solo contacto al proveedor)</option>`;
  html += centros
    .map(c => `<option value="${c._id || c.id}" data-code="${c.code || ''}" data-comuna="${c.comuna || ''}" data-hect="${c.hectareas ?? ''}">
                 ${c.code || ''} – ${c.comuna || 's/comuna'} (${c.hectareas ?? '-'} ha)
               </option>`)
    .join('');
  select.innerHTML = html;
  select.disabled = false;

  // Re-init Materialize select
  const inst = M.FormSelect.getInstance(select);
  if (inst) inst.destroy();
  M.FormSelect.init(select);

  // Limpia ocultos de centro
  $('#centroId').value = '';
  $('#centroCode').value = '';

  // on change: set ocultos
  select.onchange = () => {
    const opt = select.options[select.selectedIndex];
    $('#centroId').value   = opt.value || '';
    $('#centroCode').value = opt.dataset.code || '';
    // si quieres, también puedes mantener comuna/hectáreas ocultos
    $('#centroComuna').value    = opt.dataset.comuna || '';
    $('#centroHectareas').value = opt.dataset.hect || '';
  };
}

function resetSelectCentros(){
  const select = $('#selectCentro');
  if (!select) return;
  select.innerHTML = `<option value="" selected>Sin centro (solo contacto al proveedor)</option>`;
  select.disabled = true;
  const inst = M.FormSelect.getInstance(select);
  if (inst) inst.destroy();
  M.FormSelect.init(select);

  $('#centroId').value = '';
  $('#centroCode').value = '';
  $('#centroComuna').value = '';
  $('#centroHectareas').value = '';
}

// ==== FORMULARIO: GUARDAR CONTACTO ====
function setupFormulario() {
  const form = $('#formContacto');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const proveedorKey    = $('#proveedorKey').value.trim();
    const proveedorNombre = $('#proveedorNombre').value.trim();

    if (!proveedorKey || !proveedorNombre) {
      M.toast?.({ html: 'Selecciona un proveedor válido', displayLength: 2500 });
      $('#buscadorProveedor').focus();
      return;
    }

    // Campos nuevos
    const tieneMMPP           = $('#tieneMMPP').value;              // Sí / No
    const fechaDisponibilidad = $('#fechaDisponibilidad').value || null; // YYYY-MM-DD
    const dispuestoVender     = $('#dispuestoVender').value;       // Sí / No / Por confirmar
    const vendeActualmenteA   = $('#vendeActualmenteA').value.trim();
    const notas               = $('#notasContacto').value.trim();

    // Centro (opcional)
    const centroId    = $('#centroId').value || null;
    const _centroCode = $('#centroCode').value || null; // oculto en HTML

    // Tu backend espera `resultado` obligatorio. Lo derivamos de tieneMMPP.
    const resultado =
      tieneMMPP === 'Sí' ? 'Disponible' :
      tieneMMPP === 'No' ? 'No disponible' : '';

    if (!resultado) {
      M.toast?.({ html: 'Selecciona disponibilidad (Sí/No)', displayLength: 2500 });
      return;
    }

    // Payload al backend
    const payload = {
      proveedorKey,
      proveedorNombre,
      resultado,                 // requerido por backend
      tieneMMPP,
      fechaDisponibilidad,
      dispuestoVender,
      vendeActualmenteA,
      notas,
      centroId,
      // Backend usa "centroCodigo" (con g):
      centroCodigo: _centroCode || null
    };

    try {
      const res = await fetch(API_CONTACTOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`POST /contactos -> ${res.status}`);
      // recarga tabla
      await cargarContactosGuardados();
      renderTablaContactos();

      // feedback & reset parcial
      M.toast?.({ html: 'Contacto guardado', displayLength: 2000 });
      form.reset();
      // Re-init selects de Materialize tras reset
      $$('#formContacto select').forEach(sel => {
        const inst = M.FormSelect.getInstance(sel);
        if (inst) inst.destroy();
        M.FormSelect.init(sel);
      });
      // Mantener proveedor y centros seleccionados (no limpiar arriba)
    } catch (err) {
      console.error('guardarContacto error:', err);
      M.toast?.({ html: 'Error al guardar contacto', displayLength: 2500 });
    }
  });
}

// ==== TABLA ====
function renderTablaContactos() {
  const tbody = $('#tablaContactos tbody');
  if (!tbody) return;

  if (!contactosGuardados.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:#888">No hay contactos registrados aún.</td></tr>`;
    return;
  }

  // Limpia primero
  tbody.innerHTML = '';

  contactosGuardados
    .slice() // copia
    .sort((a, b) => new Date(b.createdAt || b.fecha || 0) - new Date(a.createdAt || a.fecha || 0))
    .forEach(c => {
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const dd = String(f.getDate()).padStart(2, '0');
      const mm = String(f.getMonth() + 1).padStart(2, '0');
      const yyyy = f.getFullYear();
      const hh = String(f.getHours()).padStart(2, '0');
      const mi = String(f.getMinutes()).padStart(2, '0');
      const fechaFmt = `${yyyy}-${mm}-${dd} ${hh}:${mi}`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fechaFmt}</td>
        <td>${c.proveedorNombre || ''}</td>
        <td>${c.centroCodigo || ''}</td>
        <td>${c.tieneMMPP || ''}</td>
        <td>${c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : ''}</td>
        <td>${c.dispuestoVender || ''}</td>
        <td>${c.vendeActualmenteA || ''}</td>
        <td>${c.notas || ''}</td>
      `;
      tbody.appendChild(tr);
    });
}

// ==== EXPORTADO ====
export async function initContactosTab() {
  await cargarCentros();
  await cargarContactosGuardados();
  setupBuscadorProveedores();
  setupFormulario();
  renderTablaContactos();
}
