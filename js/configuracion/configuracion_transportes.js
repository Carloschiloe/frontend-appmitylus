// configuracion_transportes.js – Empresas de Transporte y Camiones (acordeón)

let empresasTransporte = []; // [{nombre, rut, direccion, comuna, telefono, email, obs, camiones:[...]}]

// --- Render principal ---
export function renderEmpresasTransporte() {
  const cont = document.getElementById('tab-transporte'); // <---- este ID ahora coincide con tu HTML
  if (!cont) return;

  cont.innerHTML = `
    <h5 class="conf-title">Empresas de Transporte</h5>
    <form id="formEmpresa" class="conf-form">
      <input type="hidden" id="empresaIdx" />
      <div class="conf-row">
        <input type="text" id="empresaNombre" placeholder="Nombre" />
        <input type="text" id="empresaRut" placeholder="RUT" />
        <input type="text" id="empresaDireccion" placeholder="Dirección" />
        <input type="text" id="empresaComuna" placeholder="Comuna" />
        <input type="text" id="empresaTelefono" placeholder="Teléfono" />
      </div>
      <div class="conf-row">
        <input type="email" id="empresaEmail" placeholder="Email" />
        <input type="text" id="empresaObs" placeholder="Obs." />
        <button type="submit" class="conf-btn-add"><i class="material-icons">add</i></button>
      </div>
    </form>
    <div class="conf-table-wrap">
      <table class="conf-table">
        <thead>
          <tr>
            <th>Nombre</th><th>RUT</th><th>Dirección</th><th>Comuna</th><th>Teléfono</th>
            <th>Email</th><th>Obs.</th><th>Camiones</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody id="empresasBody"></tbody>
      </table>
    </div>
  `;
  renderEmpresasBody();
  attachEmpresaFormListeners();
}

// --- Renderiza el tbody de empresas, con acordeón de camiones ---
function renderEmpresasBody() {
  const body = document.getElementById('empresasBody');
  if (!body) return;

  body.innerHTML = empresasTransporte.map((e, idx) => `
    <tr>
      <td>${e.nombre || ''}</td>
      <td>${e.rut || ''}</td>
      <td>${e.direccion || ''}</td>
      <td>${e.comuna || ''}</td>
      <td>${e.telefono || ''}</td>
      <td>${e.email || ''}</td>
      <td>${e.obs || ''}</td>
      <td>
        <button class="conf-btn-mini btn-camiones" data-idx="${idx}">
          <i class="material-icons">local_shipping</i>
          (${(e.camiones || []).length})
        </button>
      </td>
      <td>
        <button class="conf-btn-mini btn-edit-empresa" data-idx="${idx}"><i class="material-icons">edit</i></button>
        <button class="conf-btn-mini btn-del-empresa" data-idx="${idx}"><i class="material-icons">delete</i></button>
      </td>
    </tr>
    <tr class="camiones-row" style="display:none;">
      <td colspan="9">
        <div id="camionesWrap-${idx}"></div>
      </td>
    </tr>
  `).join('');

  attachEmpresaActions();
}

// --- Listeners del formulario de empresa ---
function attachEmpresaFormListeners() {
  const form = document.getElementById('formEmpresa');
  form.onsubmit = (e) => {
    e.preventDefault();
    const idx = document.getElementById('empresaIdx').value;
    const empresa = {
      nombre: document.getElementById('empresaNombre').value,
      rut: document.getElementById('empresaRut').value,
      direccion: document.getElementById('empresaDireccion').value,
      comuna: document.getElementById('empresaComuna').value,
      telefono: document.getElementById('empresaTelefono').value,
      email: document.getElementById('empresaEmail').value,
      obs: document.getElementById('empresaObs').value,
      camiones: idx ? empresasTransporte[idx].camiones || [] : [],
    };
    if (idx) {
      empresasTransporte[idx] = empresa;
    } else {
      empresasTransporte.push(empresa);
    }
    form.reset();
    document.getElementById('empresaIdx').value = '';
    renderEmpresasBody();
  };
}

// --- Acciones editar/eliminar/acordeón camiones ---
function attachEmpresaActions() {
  // Editar
  document.querySelectorAll('.btn-edit-empresa').forEach(btn => {
    btn.onclick = () => {
      const idx = btn.dataset.idx;
      const empresa = empresasTransporte[idx];
      document.getElementById('empresaIdx').value = idx;
      document.getElementById('empresaNombre').value = empresa.nombre;
      document.getElementById('empresaRut').value = empresa.rut;
      document.getElementById('empresaDireccion').value = empresa.direccion;
      document.getElementById('empresaComuna').value = empresa.comuna;
      document.getElementById('empresaTelefono').value = empresa.telefono;
      document.getElementById('empresaEmail').value = empresa.email;
      document.getElementById('empresaObs').value = empresa.obs;
    };
  });
  // Eliminar
  document.querySelectorAll('.btn-del-empresa').forEach(btn => {
    btn.onclick = () => {
      const idx = btn.dataset.idx;
      if (confirm('¿Eliminar empresa?')) {
        empresasTransporte.splice(idx, 1);
        renderEmpresasBody();
      }
    };
  });
  // Mostrar/ocultar camiones (acordeón)
  document.querySelectorAll('.btn-camiones').forEach(btn => {
    btn.onclick = () => {
      const idx = btn.dataset.idx;
      const tr = btn.closest('tr').nextElementSibling;
      const wrap = document.getElementById(`camionesWrap-${idx}`);
      if (!wrap) return;
      if (tr.style.display === 'table-row') {
        tr.style.display = 'none';
        wrap.innerHTML = '';
      } else {
        tr.style.display = 'table-row';
        renderCamionesAcordeon(idx, wrap);
      }
    };
  });
}

// --- Renderiza acordeón de camiones por empresa ---
function renderCamionesAcordeon(empresaIdx, cont) {
  const empresa = empresasTransporte[empresaIdx];
  if (!empresa) return;
  const camiones = empresa.camiones || [];
  cont.innerHTML = `
    <div class="camiones-list">
      <h6>Camiones</h6>
      <form id="formCamion-${empresaIdx}" class="camion-form">
        <input type="text" placeholder="Marca" class="camion-marca" />
        <input type="text" placeholder="Modelo" class="camion-modelo" />
        <input type="text" placeholder="Patente" class="camion-patente" />
        <input type="number" placeholder="Año" class="camion-anio" />
        <input type="text" placeholder="Color" class="camion-color" />
        <input type="text" placeholder="Capacidad" class="camion-capacidad" />
        <button type="submit" class="conf-btn-add"><i class="material-icons">add</i></button>
      </form>
      <table class="conf-table-camiones">
        <thead>
          <tr><th>Marca</th><th>Modelo</th><th>Patente</th><th>Año</th><th>Color</th><th>Capacidad</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          ${camiones.map((c, i) => `
            <tr>
              <td>${c.marca || ''}</td>
              <td>${c.modelo || ''}</td>
              <td>${c.patente || ''}</td>
              <td>${c.anio || ''}</td>
              <td>${c.color || ''}</td>
              <td>${c.capacidad || ''}</td>
              <td>
                <button class="conf-btn-mini btn-del-camion" data-cidx="${i}"><i class="material-icons">delete</i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  // Form add camion
  document.getElementById(`formCamion-${empresaIdx}`).onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    const camion = {
      marca: f.querySelector('.camion-marca').value,
      modelo: f.querySelector('.camion-modelo').value,
      patente: f.querySelector('.camion-patente').value,
      anio: f.querySelector('.camion-anio').value,
      color: f.querySelector('.camion-color').value,
      capacidad: f.querySelector('.camion-capacidad').value
    };
    empresasTransporte[empresaIdx].camiones = empresasTransporte[empresaIdx].camiones || [];
    empresasTransporte[empresaIdx].camiones.push(camion);
    renderCamionesAcordeon(empresaIdx, cont);
  };
  // Delete camion
  cont.querySelectorAll('.btn-del-camion').forEach(btn => {
    btn.onclick = () => {
      const cidx = btn.dataset.cidx;
      empresasTransporte[empresaIdx].camiones.splice(cidx, 1);
      renderCamionesAcordeon(empresaIdx, cont);
    };
  });
}
