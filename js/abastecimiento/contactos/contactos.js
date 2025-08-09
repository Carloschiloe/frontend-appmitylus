// js/abastecimiento/contactos/contactos.js

// ==== CONFIG ====
const API_URL = 'https://backend-appmitylus-production.up.railway.app/api';
const API_CENTROS   = `${API_URL}/centros`;
const API_CONTACTOS = `${API_URL}/contactos`;

// ==== STATE ====
let listaProveedores = [];
let listaCentros = [];
let contactosGuardados = [];
let dt = null;
let editId = null; // ← si no es null, estamos editando ese _id

// ==== UTILS ====
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const slug = (s) => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-+/g,'-');

function setVal(ids, value='') {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) { el.value = value ?? ''; return el; }
  }
  const id = ids[0];
  const hidden = document.createElement('input');
  hidden.type = 'hidden'; hidden.id = id; hidden.value = value ?? '';
  document.body.appendChild(hidden);
  return hidden;
}
function getVal(ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el.value;
  }
  return '';
}

// ==== API LOAD ====
async function cargarCentros() {
  try {
    const res = await fetch(API_CENTROS);
    if (!res.ok) throw new Error('No se pudo cargar centros');
    listaCentros = await res.json();

    const mapa = new Map();
    for (const c of listaCentros) {
      const nombreOriginal = (c.proveedor || '').trim();
      if (!nombreOriginal) continue;
      const nombreNormalizado = nombreOriginal.toLowerCase().replace(/\s+/g, ' ');
      const key = c.proveedorKey?.length ? c.proveedorKey : slug(nombreOriginal);
      if (!mapa.has(key)) mapa.set(key, { nombreOriginal, nombreNormalizado, proveedorKey: key });
    }
    listaProveedores = Array.from(mapa.values());
  } catch (e) {
    console.error('[cargarCentros] error:', e);
    listaCentros = []; listaProveedores = [];
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

// ==== BUSCADOR PROVEEDORES ====
function setupBuscadorProveedores() {
  const input = $('#buscadorProveedor');
  const datalist = $('#datalistProveedores');
  if (!input || !datalist) return;

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().replace(/\s+/g, ' ').trim();
    datalist.innerHTML = '';
    if (!val) return;
    const filtrados = listaProveedores.filter(p => p.nombreNormalizado.includes(val));
    filtrados.slice(0, 20).forEach(prov => {
      const opt = document.createElement('option');
      opt.value = prov.nombreOriginal;
      datalist.appendChild(opt);
    });
  });

  input.addEventListener('change', () => {
    const valNorm = input.value.toLowerCase().replace(/\s+/g, ' ').trim();
    const prov = listaProveedores.find(p => p.nombreNormalizado === valNorm);
    if (prov) {
      setVal(['proveedorKey','proveedorId'], prov.proveedorKey);
      setVal(['proveedorNombre'], prov.nombreOriginal);
      mostrarCentrosDeProveedor(prov.proveedorKey);
    } else {
      setVal(['proveedorKey','proveedorId'], '');
      setVal(['proveedorNombre'], '');
      resetSelectCentros();
    }
  });
}

// ==== CENTROS ====
function mostrarCentrosDeProveedor(proveedorKey, preselectCentroId = null) {
  const select = $('#selectCentro'); if (!select) return;
  const centros = listaCentros.filter(c => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor||'')) === proveedorKey);

  let html = `<option value="" ${!preselectCentroId ? 'selected' : ''}>Sin centro (solo contacto al proveedor)</option>`;
  html += centros.map(c => {
    const id = (c._id || c.id);
    const sel = preselectCentroId && String(preselectCentroId) === String(id) ? 'selected' : '';
    return `<option ${sel} value="${id}" data-code="${c.code || ''}" data-comuna="${c.comuna || ''}" data-hect="${c.hectareas ?? ''}">
      ${c.code || ''} – ${c.comuna || 's/comuna'} (${c.hectareas ?? '-'} ha)
    </option>`;
  }).join('');
  select.innerHTML = html; select.disabled = false;

  const inst = M.FormSelect.getInstance(select); if (inst) inst.destroy(); M.FormSelect.init(select);

  // set ocultos según selección actual
  const opt = select.options[select.selectedIndex];
  setVal(['centroId'], opt?.value || '');
  setVal(['centroCode','centroCodigo'], opt?.dataset?.code || '');
  setVal(['centroComuna'], opt?.dataset?.comuna || '');
  setVal(['centroHectareas'], opt?.dataset?.hect || '');

  select.onchange = () => {
    const opt2 = select.options[select.selectedIndex];
    setVal(['centroId'], opt2.value || '');
    setVal(['centroCode','centroCodigo'], opt2.dataset.code || '');
    setVal(['centroComuna'], opt2.dataset.comuna || '');
    setVal(['centroHectareas'], opt2.dataset.hect || '');
  };
}
function resetSelectCentros(){
  const select = $('#selectCentro'); if (!select) return;
  select.innerHTML = `<option value="" selected>Sin centro (solo contacto al proveedor)</option>`;
  select.disabled = true;
  const inst = M.FormSelect.getInstance(select); if (inst) inst.destroy(); M.FormSelect.init(select);
  setVal(['centroId'],''); setVal(['centroCode','centroCodigo'],''); setVal(['centroComuna'],''); setVal(['centroHectareas'],'');
}

// ==== FORM ====
function setupFormulario() {
  const form = $('#formContacto'); if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const proveedorKey    = getVal(['proveedorKey','proveedorId']).trim();
    const proveedorNombre = getVal(['proveedorNombre']).trim();
    if (!proveedorKey || !proveedorNombre) {
      M.toast?.({ html: 'Selecciona un proveedor válido', displayLength: 2500 });
      $('#buscadorProveedor').focus(); return;
    }

    const tieneMMPP           = $('#tieneMMPP').value;
    const fechaDisponibilidad = $('#fechaDisponibilidad').value || null;
    const dispuestoVender     = $('#dispuestoVender').value;
    const vendeActualmenteA   = $('#vendeActualmenteA').value.trim();
    const notas               = $('#notasContacto').value.trim();
    const tonsDisponiblesAprox = $('#tonsDisponiblesAprox')?.value ?? '';

    const contactoNombre   = $('#contactoNombre')?.value?.trim() || '';
    const contactoTelefono = $('#contactoTelefono')?.value?.trim() || '';
    const contactoEmail    = $('#contactoEmail')?.value?.trim() || '';

    const centroId    = getVal(['centroId']) || null;
    const _centroCode = getVal(['centroCode','centroCodigo']) || null;

    const resultado = tieneMMPP === 'Sí' ? 'Disponible' : (tieneMMPP === 'No' ? 'No disponible' : '');
    if (!resultado) { M.toast?.({ html: 'Selecciona disponibilidad (Sí/No)', displayLength: 2500 }); return; }

    const payload = {
      proveedorKey, proveedorNombre,
      resultado, tieneMMPP, fechaDisponibilidad, dispuestoVender,
      vendeActualmenteA, notas,
      centroId, centroCodigo: _centroCode || null,
      tonsDisponiblesAprox: (tonsDisponiblesAprox !== '' ? Number(tonsDisponiblesAprox) : null),
      contactoNombre, contactoTelefono, contactoEmail
    };

    try {
      if (editId) {
        // UPDATE
        const res = await fetch(`${API_CONTACTOS}/${editId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`PUT /contactos/${editId} -> ${res.status} ${await res.text()}`);
      } else {
        // CREATE
        const res = await fetch(API_CONTACTOS, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`POST /contactos -> ${res.status} ${await res.text()}`);
      }

      await cargarContactosGuardados();
      renderTablaContactos();

      M.toast?.({ html: editId ? 'Contacto actualizado' : 'Contacto guardado', displayLength: 2000 });

      // cerrar + limpiar modal
      const modalInst = M.Modal.getInstance(document.getElementById('modalContacto'));
      form.reset();
      $$('#formContacto select').forEach(sel => {
        const inst = M.FormSelect.getInstance(sel); if (inst) inst.destroy();
        M.FormSelect.init(sel);
      });
      editId = null;
      modalInst?.close();
    } catch (err) {
      console.error('guardarContacto error:', err);
      M.toast?.({ html: 'Error al guardar contacto', displayLength: 2500 });
    }
  });
}

// ==== TABLA (DataTables) + Botones ====
function initTablaContactos(){
  const jq = window.jQuery || window.$; if (!jq || dt) return;

  dt = jq('#tablaContactos').DataTable({
    dom: 'Bfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Contactos_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Contactos_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[0,'desc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: -1, orderable: false, searchable: false } // Detalle
    ]
  });

  // Eventos delegados
  jq('#tablaContactos tbody')
    .on('click', 'button.btn-ver', function(){
      const id = this.dataset.id;
      const c = contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirDetalleContacto(c);
    })
    .on('click', 'button.btn-edit', async function(){
      const id = this.dataset.id;
      const c = contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirEdicion(c);
    })
    .on('click', 'button.btn-del', async function(){
      const id = this.dataset.id;
      if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
      try {
        const res = await fetch(`${API_CONTACTOS}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`DELETE /contactos/${id} -> ${res.status} ${await res.text()}`);
        await cargarContactosGuardados();
        renderTablaContactos();
        M.toast?.({ html: 'Contacto eliminado', displayLength: 1800 });
      } catch (e) {
        console.error(e);
        M.toast?.({ html: 'No se pudo eliminar', displayLength: 2000 });
      }
    });
}

function renderTablaContactos() {
  const jq = window.jQuery || window.$;

  if (dt && jq) {
    dt.clear();
    const rows = contactosGuardados.slice().sort((a,b)=>new Date(b.createdAt||b.fecha||0)-new Date(a.createdAt||a.fecha||0))
      .map(c => {
        const f = new Date(c.createdAt || c.fecha || Date.now());
        const dd = String(f.getDate()).padStart(2,'0');
        const mm = String(f.getMonth()+1).padStart(2,'0');
        const yyyy = f.getFullYear();
        const hh = String(f.getHours()).padStart(2,'0');
        const mi = String(f.getMinutes()).padStart(2,'0');
        const when = `${yyyy}-${mm}-${dd} ${hh}:${mi}`;

        const btnDetalle = `<button class="btn-small btn-ver waves-effect" data-id="${c._id}">
          <i class="material-icons">visibility</i></button>`;
        const btnEditar  = `<button class="btn-small blue lighten-1 btn-edit waves-effect" data-id="${c._id}" style="margin-left:6px">
          <i class="material-icons">edit</i></button>`;
        const btnEliminar= `<button class="btn-small red lighten-1 btn-del waves-effect" data-id="${c._id}" style="margin-left:6px">
          <i class="material-icons">delete</i></button>`;

        return [
          when,
          c.proveedorNombre || '',
          c.centroCodigo || '',
          c.tieneMMPP || '',
          c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '',
          c.dispuestoVender || '',
          (c.tonsDisponiblesAprox ?? '') + '',
          c.vendeActualmenteA || '',
          c.notas || '',
          btnDetalle + btnEditar + btnEliminar
        ];
      });
    dt.rows.add(rows).draw();
    return;
  }

  // Fallback sin DataTables
  const tbody = $('#tablaContactos tbody'); if (!tbody) return;
  tbody.innerHTML = '';
  if (!contactosGuardados.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="color:#888">No hay contactos registrados aún.</td></tr>`;
    return;
  }
  contactosGuardados.slice().sort((a,b)=>new Date(b.createdAt||b.fecha||0)-new Date(a.createdAt||a.fecha||0))
    .forEach(c => {
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const dd = String(f.getDate()).padStart(2,'0');
      const mm = String(f.getMonth()+1).padStart(2,'0');
      const yyyy = f.getFullYear();
      const hh = String(f.getHours()).padStart(2,'0');
      const mi = String(f.getMinutes()).padStart(2,'0');
      const fechaFmt = `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fechaFmt}</td>
        <td>${c.proveedorNombre || ''}</td>
        <td>${c.centroCodigo || ''}</td>
        <td>${c.tieneMMPP || ''}</td>
        <td>${c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : ''}</td>
        <td>${c.dispuestoVender || ''}</td>
        <td>${(c.tonsDisponiblesAprox ?? '') + ''}</td>
        <td>${c.vendeActualmenteA || ''}</td>
        <td>${c.notas || ''}</td>
        <td>
          <button class="btn-small btn-ver waves-effect" data-id="${c._id}"><i class="material-icons">visibility</i></button>
          <button class="btn-small blue lighten-1 btn-edit waves-effect" data-id="${c._id}" style="margin-left:6px"><i class="material-icons">edit</i></button>
          <button class="btn-small red lighten-1 btn-del waves-effect" data-id="${c._id}" style="margin-left:6px"><i class="material-icons">delete</i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll('button.btn-ver').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const c = contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirDetalleContacto(c);
    });
  });
  tbody.querySelectorAll('button.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const c = contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirEdicion(c);
    });
  });
  tbody.querySelectorAll('button.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
      try {
        const res = await fetch(`${API_CONTACTOS}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`DELETE /contactos/${id} -> ${res.status} ${await res.text()}`);
        await cargarContactosGuardados();
        renderTablaContactos();
        M.toast?.({ html: 'Contacto eliminado', displayLength: 1800 });
      } catch (e) {
        console.error(e);
        M.toast?.({ html: 'No se pudo eliminar', displayLength: 2000 });
      }
    });
  });
}

// ==== DETALLE (modal) ====
function abrirDetalleContacto(c) {
  const body = $('#detalleContactoBody'); if (!body) return;
  const fechaFmt = (() => {
    const f = new Date(c.createdAt || c.fecha || Date.now());
    const dd = String(f.getDate()).padStart(2,'0');
    const mm = String(f.getMonth()+1).padStart(2,'0');
    const yyyy = f.getFullYear();
    const hh = String(f.getHours()).padStart(2,'0');
    const mi = String(f.getMinutes()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  })();

  body.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div><strong>Fecha:</strong> ${fechaFmt}</div>
      <div><strong>Proveedor:</strong> ${c.proveedorNombre || ''}</div>
      <div><strong>Centro:</strong> ${c.centroCodigo || ''}</div>
      <div><strong>Disponibilidad:</strong> ${c.tieneMMPP || ''}</div>
      <div><strong>Fecha Disp.:</strong> ${c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : ''}</div>
      <div><strong>Disposición:</strong> ${c.dispuestoVender || ''}</div>
      <div><strong>Tons aprox.:</strong> ${(c.tonsDisponiblesAprox ?? '') + ''}</div>
      <div><strong>Vende a:</strong> ${c.vendeActualmenteA || ''}</div>
      <div style="grid-column:1/-1;"><strong>Notas:</strong> ${c.notas || ''}</div>
      <div style="grid-column:1/-1;"><strong>Contacto:</strong>
        ${[c.contactoNombre, c.contactoTelefono, c.contactoEmail].filter(Boolean).join(' • ') || '-'}</div>
    </div>
  `;
  const inst = M.Modal.getInstance(document.getElementById('modalDetalleContacto')) || M.Modal.init(document.getElementById('modalDetalleContacto'));
  inst.open();
}

// ==== EDICIÓN ====
function abrirEdicion(c) {
  editId = c._id;

  // proveedor
  $('#buscadorProveedor').value = c.proveedorNombre || '';
  setVal(['proveedorNombre'], c.proveedorNombre || '');
  const key = c.proveedorKey || slug(c.proveedorNombre || '');
  setVal(['proveedorKey','proveedorId'], key);

  // cargar centros del proveedor y preseleccionar
  mostrarCentrosDeProveedor(key, c.centroId || null);

  // selects y campos
  $('#tieneMMPP').value = c.tieneMMPP || '';
  $('#dispuestoVender').value = c.dispuestoVender || '';
  M.FormSelect.init($$('#formContacto select')); // reinit

  $('#fechaDisponibilidad').value = c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '';
  $('#tonsDisponiblesAprox').value = c.tonsDisponiblesAprox ?? '';
  $('#vendeActualmenteA').value = c.vendeActualmenteA || '';
  $('#notasContacto').value = c.notas || '';

  $('#contactoNombre').value = c.contactoNombre || '';
  $('#contactoTelefono').value = c.contactoTelefono || '';
  $('#contactoEmail').value = c.contactoEmail || '';

  M.updateTextFields();

  const modalInst = M.Modal.getInstance(document.getElementById('modalContacto')) || M.Modal.init(document.getElementById('modalContacto'));
  modalInst.open();
}

// ==== INIT ====
export async function initContactosTab() {
  await cargarCentros();
  await cargarContactosGuardados();
  setupBuscadorProveedores();
  setupFormulario();
  initTablaContactos();
  renderTablaContactos();

  // Abrir modal en modo NUEVO
  $('#btnOpenContactoModal')?.addEventListener('click', () => {
    editId = null;
    // limpiar todo por si venimos de editar
    const form = $('#formContacto');
    form?.reset();
    $$('#formContacto select').forEach(sel => {
      const inst = M.FormSelect.getInstance(sel); if (inst) inst.destroy();
      M.FormSelect.init(sel);
    });
    setVal(['proveedorKey','proveedorId'],'');
    setVal(['proveedorNombre'],'');
    resetSelectCentros();
  });
}
