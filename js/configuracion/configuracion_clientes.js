// /js/configuracion/configuracion_clientes.js

export function renderClientes() {
  const cont = document.getElementById('clientes-content');
  if (!cont) return;
  cont.innerHTML = `
      <form id="form-cliente" class="row">
      <div class="input-field col s12 m3"><input id="nombreCliente" type="text" /><label for="nombreCliente">Nombre</label></div>
      <div class="input-field col s12 m2"><input id="rutCliente" type="text" /><label for="rutCliente">RUT</label></div>
      <div class="input-field col s12 m3"><input id="direccionCliente" type="text" /><label for="direccionCliente">Dirección</label></div>
      <div class="input-field col s12 m2"><input id="comunaCliente" type="text" /><label for="comunaCliente">Comuna</label></div>
      <div class="input-field col s12 m2"><input id="telefonoCliente" type="text" /><label for="telefonoCliente">Teléfono</label></div>
      <div class="input-field col s12 m3"><input id="emailCliente" type="email" /><label for="emailCliente">Email</label></div>
      <div class="input-field col s12 m2"><input id="paisCliente" type="text" /><label for="paisCliente">País</label></div>
      <div class="input-field col s12 m3"><input id="obsCliente" type="text" /><label for="obsCliente">Obs.</label></div>
      <div class="col s12 m1 center-align" style="margin-top:24px;">
        <button type="submit" class="btn blue"><i class="material-icons">add</i></button>
      </div>
    </form>
    <div class="responsive-table">
      <table class="highlight" id="clientes-table">
        <thead>
          <tr>
            <th>Nombre</th><th>RUT</th><th>Dirección</th><th>Comuna</th><th>Teléfono</th><th>Email</th><th>País</th><th>Obs.</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  let clientes = JSON.parse(localStorage.getItem('clientes') || '[]');

  function renderTable() {
    const tbody = cont.querySelector('#clientes-table tbody');
    tbody.innerHTML = clientes.map((c, idx) => `
      <tr>
        <td>${c.nombre}</td><td>${c.rut}</td><td>${c.direccion}</td><td>${c.comuna}</td>
        <td>${c.telefono}</td><td>${c.email}</td><td>${c.pais}</td><td>${c.obs}</td>
        <td>
          <button class="btn-flat btn-small red-text btn-del" data-idx="${idx}" title="Eliminar"><i class="material-icons">delete</i></button>
        </td>
      </tr>
    `).join('');
    cont.querySelectorAll('.btn-del').forEach(btn => {
      btn.onclick = () => {
        clientes.splice(+btn.dataset.idx, 1);
        localStorage.setItem('clientes', JSON.stringify(clientes));
        renderTable();
      };
    });
  }
  renderTable();

  cont.querySelector('#form-cliente').onsubmit = e => {
    e.preventDefault();
    const nombre = cont.querySelector('#nombreCliente').value.trim();
    const rut = cont.querySelector('#rutCliente').value.trim();
    const direccion = cont.querySelector('#direccionCliente').value.trim();
    const comuna = cont.querySelector('#comunaCliente').value.trim();
    const telefono = cont.querySelector('#telefonoCliente').value.trim();
    const email = cont.querySelector('#emailCliente').value.trim();
    const pais = cont.querySelector('#paisCliente').value.trim();
    const obs = cont.querySelector('#obsCliente').value.trim();
    clientes.push({ nombre, rut, direccion, comuna, telefono, email, pais, obs });
    localStorage.setItem('clientes', JSON.stringify(clientes));
    renderTable();
    e.target.reset();
  };
}

