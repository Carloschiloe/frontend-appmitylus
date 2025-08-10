// ==== CONFIG ====
const API_URL        = 'https://backend-appmitylus-production.up.railway.app/api';
const API_CENTROS    = `${API_URL}/centros`;
const API_CONTACTOS  = `${API_URL}/contactos`;
const API_VISITAS    = `${API_URL}/visitas`;      // <-- NUEVO: endpoint de visitas

// ==== STATE ====
let listaProveedores = [];
let listaCentros = [];
let contactosGuardados = [];
let dt = null;
let editId = null; // ← si no es null, estamos editando ese _id

// caches simples
const cacheVisitasByContactoId = Object.create(null);

// ==== UTILS ====
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const slug = (s) => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-+/g,'-');

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

    // construir índice de proveedores desde centros
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
async function cargarVisitasPorContacto(contactoId) {
  if (!contactoId) return [];
  if (cacheVisitasByContactoId[contactoId]) return cacheVisitasByContactoId[contactoId];
  try {
    const res = await fetch(`${API_VISITAS}?contactoId=${encodeURIComponent(contactoId)}`);
    if (!res.ok) throw new Error('No se pudo cargar visitas');
    const visitas = await res.json();
    cacheVisitasByContactoId[contactoId] = visitas || [];
    return visitas || [];
  } catch (e) {
    console.error('[cargarVisitasPorContacto] error:', e);
    return [];
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

// ==== FORM CONTACTO ====
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
        const res = await fetch(`${API_CONTACTOS}/${editId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`PUT /contactos/${editId} -> ${res.status} ${await res.text()}`);
      } else {
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

// ==== TABLA (DataTables) + Acciones ====
function initTablaContactos(){
  const jq = window.jQuery || window.$; if (!jq || dt) return;

  dt = jq('#tablaContactos').DataTable({
    dom: 'Bfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Contactos_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Contactos_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[0,'desc']],
    pageLength: 25,
    autoWidth: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: -1, orderable: false, searchable: false } // Acciones
    ]
  });

  // Eventos delegados (ver/editar/eliminar/visita)
  jq('#tablaContactos tbody')
    .on('click', 'a.icon-action.ver', function(){
      const id = this.dataset.id;
      const c = contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirDetalleContacto(c);
    })
    .on('click', 'a.icon-action.visita', function(){
      const id = this.dataset.id;
      const c = contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirModalVisita(c);
    })
    .on('click', 'a.icon-action.editar', function(){
      const id = this.dataset.id;
      const c = contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirEdicion(c);
    })
    .on('click', 'a.icon-action.eliminar', async function(){
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

  // filas para DataTables (sin columna "Notas")
  const filas = contactosGuardados.slice().sort((a,b)=>new Date(b.createdAt||b.fecha||0)-new Date(a.createdAt||a.fecha||0))
    .map(c => {
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const dd = String(f.getDate()).padStart(2,'0');
      const mm = String(f.getMonth()+1).padStart(2,'0');
      const yyyy = f.getFullYear();
      const hh = String(f.getHours()).padStart(2,'0');
      const mi = String(f.getMinutes()).padStart(2,'0');
      const when = `${yyyy}-${mm}-${dd} ${hh}:${mi}`;

      const acciones = `
        <a href="#!" class="icon-action ver" title="Ver" data-id="${c._id}">
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
        when,
        c.proveedorNombre || '',
        c.centroCodigo || '',
        c.tieneMMPP || '',
        c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '',
        c.dispuestoVender || '',
        (c.onsDisponiblesAprox ?? c.tonsDisponiblesAprox ?? '') + '', // tolera typo antiguo
        c.vendeActualmenteA || '',
        acciones // <-- última columna
      ];
    });

  if (dt && jq) {
    dt.clear(); dt.rows.add(filas).draw();
    return;
  }

  // Fallback sin DataTables (9 columnas)
  const tbody = $('#tablaContactos tbody'); if (!tbody) return;
  tbody.innerHTML = '';
  if (!contactosGuardados.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:#888">No hay contactos registrados aún.</td></tr>`;
    return;
  }
  filas.forEach(arr => {
    const tr = document.createElement('tr');
    tr.innerHTML = arr.map(td => `<td>${td}</td>`).join('');
    tbody.appendChild(tr);
  });

  // Listeners fallback
  tbody.querySelectorAll('a.icon-action.ver').forEach(a => {
    a.addEventListener('click', () => {
      const id = a.dataset.id;
      const c = contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirDetalleContacto(c);
    });
  });
  tbody.querySelectorAll('a.icon-action.visita').forEach(a => {
    a.addEventListener('click', () => {
      const id = a.dataset.id;
      const c = contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirModalVisita(c);
    });
  });
  tbody.querySelectorAll('a.icon-action.editar').forEach(a => {
    a.addEventListener('click', () => {
      const id = a.dataset.id;
      const c = contactosGuardados.find(x => String(x._id) === String(id));
      if (c) abrirEdicion(c);
    });
  });
  tbody.querySelectorAll('a.icon-action.eliminar').forEach(a => {
    a.addEventListener('click', async () => {
      const id = a.dataset.id;
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
function comunasDelProveedor(proveedorKey) {
  const key = proveedorKey?.length ? proveedorKey : null;
  const comunas = new Set();
  for (const c of listaCentros) {
    const k = c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor||'');
    if (!key || k === key) {
      const comuna = (c.comuna || '').trim();
      if (comuna) comunas.add(comuna);
    }
  }
  return Array.from(comunas);
}

function miniTimelineHTML(visitas = []) {
  if (!visitas.length) return '<div class="text-soft">Sin visitas registradas</div>';
  const filas = visitas.slice(0,3).map(v => `
    <div class="row" style="margin-bottom:.35rem">
      <div class="col s4"><strong>${(v.fecha||'').slice(0,10)}</strong></div>
      <div class="col s4">${v.centroCodigo || v.centroId || '-'}</div>
      <div class="col s4">${v.estado || '-'}</div>
      <div class="col s12"><span class="text-soft">${v.tonsComprometidas ? (v.tonsComprometidas + ' t • ') : ''}${v.observaciones || ''}</span></div>
    </div>
  `).join('');
  return filas + `<a class="btn btn--ghost" id="btnVerVisitas">Ver todas</a>`;
}

async function abrirDetalleContacto(c) {
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

  const comunas = comunasDelProveedor(c.proveedorKey || slug(c.proveedorNombre||''));
  const chips = comunas.length
    ? comunas.map(x => `<span class="badge chip" style="margin-right:.35rem;margin-bottom:.35rem">${x}</span>`).join('')
    : '<span class="text-soft">Sin centros asociados</span>';

  // visitas
  const visitas = await cargarVisitasPorContacto(c._id);

  body.innerHTML = `
    <div class="mb-4">
      <h6 class="text-soft" style="margin:0 0 .5rem">Comunas con centros del proveedor</h6>
      ${chips}
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div><strong>Fecha:</strong> ${fechaFmt}</div>
      <div><strong>Proveedor:</strong> ${c.proveedorNombre || ''}</div>
      <div><strong>Centro:</strong> ${c.centroCodigo || '-'}</div>
      <div><strong>Disponibilidad:</strong> ${c.tieneMMPP || '-'}</div>
      <div><strong>Fecha Disp.:</strong> ${c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '-'}</div>
      <div><strong>Disposición:</strong> ${c.dispuestoVender || '-'}</div>
      <div><strong>Tons aprox.:</strong> ${(c.tonsDisponiblesAprox ?? '') + ''}</div>
      <div><strong>Vende a:</strong> ${c.vendeActualmenteA || '-'}</div>
      <div style="grid-column:1/-1;"><strong>Notas:</strong> ${c.notas || '<span class="text-soft">Sin notas</span>'}</div>
      <div style="grid-column:1/-1;"><strong>Contacto:</strong>
        ${[c.contactoNombre, c.contactoTelefono, c.contactoEmail].filter(Boolean).join(' • ') || '-'}</div>
    </div>

    <div class="mb-4" style="margin-top:1rem;">
      <h6 class="text-soft" style="margin:0 0 .5rem">Últimas visitas</h6>
      ${miniTimelineHTML(visitas)}
    </div>

    <div class="right-align">
      <button class="btn teal" id="btnNuevaVisita" data-id="${c._id}">
        <i class="material-icons left">event_available</i>Registrar visita
      </button>
    </div>
  `;

  // acciones dentro del modal
  $('#btnNuevaVisita')?.addEventListener('click', () => abrirModalVisita(c));

  const inst = M.Modal.getInstance(document.getElementById('modalDetalleContacto')) || M.Modal.init(document.getElementById('modalDetalleContacto'));
  inst.open();
}

// ==== VISITA (modal + submit) ====
function abrirModalVisita(contacto) {
  // set hidden + cargar centros del proveedor para el select
  setVal(['visita_proveedorId'], contacto._id);
  const proveedorKey = contacto.proveedorKey || slug(contacto.proveedorNombre || '');
  mostrarCentrosDeProveedor(proveedorKey); // reutilizamos el mismo selector (opcional: usa el del modal visita si lo separas)

  // si tienes un select distinto en el modal de visitas, inicialízalo acá:
  const selectVisita = $('#visita_centroId');
  if (selectVisita) {
    // poblar con centros del proveedor
    const centros = listaCentros.filter(c => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor||'')) === proveedorKey);
    let options = `<option value="">Centro visitado (opcional)</option>`;
    options += centros.map(c => `<option value="${c._id || c.id}">${c.code || c.codigo || ''} – ${(c.comuna||'s/comuna')}</option>`).join('');
    selectVisita.innerHTML = options;
    const inst = M.FormSelect.getInstance(selectVisita); if (inst) inst.destroy(); M.FormSelect.init(selectVisita);
  }

  // abrir modal
  const modalVisita = M.Modal.getInstance(document.getElementById('modalVisita')) || M.Modal.init(document.getElementById('modalVisita'));
  modalVisita.open();
}

function setupFormularioVisita() {
  const form = $('#formVisita'); if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contactoId = $('#visita_proveedorId').value;
    const payload = {
      contactoId,                                     // vínculo directo al contacto
      fecha: $('#visita_fecha').value,
      centroId: $('#visita_centroId').value || null,
      contacto: $('#visita_contacto').value || null,
      enAgua: $('#visita_enAgua').value || null,
      tonsComprometidas: $('#visita_tonsComprometidas').value ? Number($('#visita_tonsComprometidas').value) : null,
      estado: $('#visita_estado').value || 'Realizada',
      observaciones: $('#visita_observaciones').value || null
    };

    try {
      const res = await fetch(API_VISITAS, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`POST /visitas -> ${res.status} ${await res.text()}`);

      // refrescar cache de visitas del contacto y feedback
      cacheVisitasByContactoId[contactoId] = null;
      M.toast?.({ html: 'Visita guardada', classes: 'teal', displayLength: 1800 });

      const modalVisita = M.Modal.getInstance(document.getElementById('modalVisita'));
      modalVisita?.close();
      form.reset();
      $$('#formVisita select').forEach(sel => {
        const inst = M.FormSelect.getInstance(sel); if (inst) inst.destroy();
        M.FormSelect.init(sel);
      });
    } catch (e) {
      console.error('guardarVisita error:', e);
      M.toast?.({ html: 'Error al guardar la visita', displayLength: 2200 });
    }
  });
}

// ==== EDICIÓN ====
function abrirEdicion(c) {
  editId = c._id;

  $('#buscadorProveedor').value = c.proveedorNombre || '';
  setVal(['proveedorNombre'], c.proveedorNombre || '');
  const key = c.proveedorKey || slug(c.proveedorNombre || '');
  setVal(['proveedorKey','proveedorId'], key);

  mostrarCentrosDeProveedor(key, c.centroId || null);

  $('#tieneMMPP').value = c.tieneMMPP || '';
  $('#dispuestoVender').value = c.dispuestoVender || '';
  M.FormSelect.init($$('#formContacto select'));

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
  setupFormularioVisita();        // <-- init del form de visitas
  initTablaContactos();
  renderTablaContactos();

  // Abrir modal en modo NUEVO
  $('#btnOpenContactoModal')?.addEventListener('click', () => {
    editId = null;
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
