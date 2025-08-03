// /js/configuracion/configuracion_transportes.js

export function renderEmpresasTransporte() {
  const cont = document.getElementById('transportes-content');
  if (!cont) return;
  cont.innerHTML = `
    <h5 class="section-title">Empresas de Transporte</h5>
    <form id="form-transporte" class="row">
      <div class="input-field col s12 m3"><input id="nombreTransporte" type="text" /><label for="nombreTransporte">Nombre</label></div>
      <div class="input-field col s12 m2"><input id="rutTransporte" type="text" /><label for="rutTransporte">RUT</label></div>
      <div class="input-field col s12 m3"><input id="direccionTransporte" type="text" /><label for="direccionTransporte">Dirección</label></div>
      <div class="input-field col s12 m2"><input id="comunaTransporte" type="text" /><label for="comunaTransporte">Comuna</label></div>
      <div class="input-field col s12 m2"><input id="telefonoTransporte" type="text" /><label for="telefonoTransporte">Teléfono</label></div>
      <div class="input-field col s12 m3"><input id="emailTransporte" type="email" /><label for="emailTransporte">Email</label></div>
      <div class="input-field col s12 m3"><input id="obsTransporte" type="text" /><label for="obsTransporte">Obs.</label></div>
      <div class="col s12 m1 center-align" style="margin-top:24px;">
        <button type="submit" class="btn blue"><i class="material-icons">add</i></button>
      </div>
    </form>
    <div class="responsive-table">
      <table class="highlight" id="transportes-table">
        <thead>
          <tr>
            <th>Nombre</th><th>RUT</th><th>Dirección</th><th>Comuna</th><th>Teléfono</th><th>Email</th><th>Obs.</th><th>Camiones</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  let transportes = JSON.parse(localStorage.getItem('transportes') || '[]');

  function renderTable() {
    const tbody = cont.querySelector('#transportes-table tbody');
    tbody.innerHTML = transportes.map((t, idx) => `
      <tr>
        <td>${t.nombre}</td><td>${t.rut}</td><td>${t.direccion}</td><td>${t.comuna}</td>
        <td>${t.telefono}</td><td>${t.email}</td><td>${t.obs}</td>
        <td>
          <button class="btn-flat btn-small blue-text btn-camiones" data-idx="${idx}" title="Gestionar camiones"><i class="material-icons">local_shipping</i></button>
        </td>
        <td>
          <button class="btn-flat btn-small red-text btn-del" data-idx="${idx}" title="Eliminar"><i class="material-icons">delete</i></button>
        </td>
      </tr>
    `).join('');
    cont.querySelectorAll('.btn-del').forEach(btn => {
      btn.onclick = () => {
        transportes.splice(+btn.dataset.idx, 1);
        localStorage.setItem('transportes', JSON.stringify(transportes));
        renderTable();
      };
    });
    cont.querySelectorAll('.btn-camiones').forEach(btn => {
      btn.onclick = () => {
        const idx = +btn.dataset.idx;
        abrirCamionesModal(idx);
      };
    });
  }
  renderTable();

  cont.querySelector('#form-transporte').onsubmit = e => {
    e.preventDefault();
    const nombre = cont.querySelector('#nombreTransporte').value.trim();
    const rut = cont.querySelector('#rutTransporte').value.trim();
    const direccion = cont.querySelector('#direccionTransporte').value.trim();
    const comuna = cont.querySelector('#comunaTransporte').value.trim();
    const telefono = cont.querySelector('#telefonoTransporte').value.trim();
    const email = cont.querySelector('#emailTransporte').value.trim();
    const obs = cont.querySelector('#obsTransporte').value.trim();
    transportes.push({ nombre, rut, direccion, comuna, telefono, email, obs, camiones: [] });
    localStorage.setItem('transportes', JSON.stringify(transportes));
    renderTable();
    e.target.reset();
  };

  // Acordeón de camiones (modal básico)
  function abrirCamionesModal(idx) {
    const t = transportes[idx];
    if (!t) return;
    const camiones = t.camiones || [];
    // Modal simple (puedes mejorarlo con Materialize Modal)
    let html = `
      <div style="padding:1.2rem;">
        <h6>Camiones de ${t.nombre}</h6>
        <form id="form-camion">
          <input type="text" id="marcaCamion" placeholder="Marca" style="margin:2px;"/>
          <input type="text" id="modeloCamion" placeholder="Modelo" style="margin:2px;"/>
          <input type="text" id="patenteCamion" placeholder="Patente" style="margin:2px;"/>
          <input type="number" id="anioCamion" placeholder="Año" style="margin:2px;"/>
          <input type="text" id="colorCamion" placeholder="Color" style="margin:2px;"/>
          <input type="number" id="capacidadCamion" placeholder="Capacidad" style="margin:2px;"/>
          <button type="submit" class="btn btn-small blue" style="margin-top:8px;">Agregar</button>
        </form>
        <ul style="margin-top:12px;">
          ${camiones.map((c, i) => `<li>${c.marca} ${c.modelo} - ${c.patente} (${c.anio}) <button data-i="${i}" class="btn-del-camion btn-flat red-text"><i class="material-icons">delete</i></button></li>`).join('')}
        </ul>
        <div style="margin-top:10px;text-align:right;">
          <button class="btn-flat cerrar-camiones">Cerrar</button>
        </div>
      </div>
    `;
    let modalDiv = document.createElement('div');
    modalDiv.className = 'modal';
    modalDiv.innerHTML = html;
    document.body.appendChild(modalDiv);
    let modal = M.Modal.init(modalDiv, { dismissible: false });
    modal.open();

    // Listeners del modal
    modalDiv.querySelector('.cerrar-camiones').onclick = () => {
      modal.close();
      setTimeout(() => modalDiv.remove(), 200);
    };
    modalDiv.querySelector('#form-camion').onsubmit = e => {
      e.preventDefault();
      const marca = modalDiv.querySelector('#marcaCamion').value.trim();
      const modelo = modalDiv.querySelector('#modeloCamion').value.trim();
      const patente = modalDiv.querySelector('#patenteCamion').value.trim();
      const anio = +modalDiv.querySelector('#anioCamion').value;
      const color = modalDiv.querySelector('#colorCamion').value.trim();
      const capacidad = +modalDiv.querySelector('#capacidadCamion').value;
      camiones.push({ marca, modelo, patente, anio, color, capacidad });
      t.camiones = camiones;
      localStorage.setItem('transportes', JSON.stringify(transportes));
      modal.close();
      setTimeout(() => modalDiv.remove(), 200);
      renderTable();
    };
    modalDiv.querySelectorAll('.btn-del-camion').forEach(btn => {
      btn.onclick = () => {
        camiones.splice(+btn.dataset.i, 1);
        t.camiones = camiones;
        localStorage.setItem('transportes', JSON.stringify(transportes));
        modal.close();
        setTimeout(() => modalDiv.remove(), 200);
        renderTable();
      };
    });
  }
}
