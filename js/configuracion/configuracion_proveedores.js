// /js/configuracion/configuracion_proveedores.js

export function renderProveedoresMMPP() {
  const cont = document.getElementById('proveedores-mmpp-content');
  if (!cont) return;
  cont.innerHTML = `
    <form id="form-proveedor" class="row">
      <div class="input-field col s12 m3"><input id="nombreProveedor" type="text" /><label for="nombreProveedor">Nombre</label></div>
      <div class="input-field col s12 m2"><input id="rutProveedor" type="text" /><label for="rutProveedor">RUT</label></div>
      <div class="input-field col s12 m3"><input id="direccionProveedor" type="text" /><label for="direccionProveedor">Dirección</label></div>
      <div class="input-field col s12 m2"><input id="comunaProveedor" type="text" /><label for="comunaProveedor">Comuna</label></div>
      <div class="input-field col s12 m2"><input id="telefonoProveedor" type="text" /><label for="telefonoProveedor">Teléfono</label></div>
      <div class="input-field col s12 m3"><input id="emailProveedor" type="email" /><label for="emailProveedor">Email</label></div>
      <div class="input-field col s12 m3"><input id="obsProveedor" type="text" /><label for="obsProveedor">Obs.</label></div>
      <div class="col s12 m1 center-align" style="margin-top:24px;">
        <button type="submit" class="btn blue"><i class="material-icons">add</i></button>
      </div>
    </form>
    <div class="responsive-table">
      <table class="highlight" id="proveedores-table">
        <thead>
          <tr>
            <th>Nombre</th><th>RUT</th><th>Dirección</th><th>Comuna</th><th>Teléfono</th><th>Email</th><th>Obs.</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  let proveedores = JSON.parse(localStorage.getItem('proveedoresMMPP') || '[]');

  function renderTable() {
    const tbody = cont.querySelector('#proveedores-table tbody');
    tbody.innerHTML = proveedores.map((p, idx) => `
      <tr>
        <td>${p.nombre}</td><td>${p.rut}</td><td>${p.direccion}</td><td>${p.comuna}</td>
        <td>${p.telefono}</td><td>${p.email}</td><td>${p.obs}</td>
        <td>
          <button class="btn-flat btn-small red-text btn-del" data-idx="${idx}" title="Eliminar"><i class="material-icons">delete</i></button>
        </td>
      </tr>
    `).join('');
    cont.querySelectorAll('.btn-del').forEach(btn => {
      btn.onclick = () => {
        proveedores.splice(+btn.dataset.idx, 1);
        localStorage.setItem('proveedoresMMPP', JSON.stringify(proveedores));
        renderTable();
      };
    });
  }
  renderTable();

  cont.querySelector('#form-proveedor').onsubmit = e => {
    e.preventDefault();
    const nombre = cont.querySelector('#nombreProveedor').value.trim();
    const rut = cont.querySelector('#rutProveedor').value.trim();
    const direccion = cont.querySelector('#direccionProveedor').value.trim();
    const comuna = cont.querySelector('#comunaProveedor').value.trim();
    const telefono = cont.querySelector('#telefonoProveedor').value.trim();
    const email = cont.querySelector('#emailProveedor').value.trim();
    const obs = cont.querySelector('#obsProveedor').value.trim();
    proveedores.push({ nombre, rut, direccion, comuna, telefono, email, obs });
    localStorage.setItem('proveedoresMMPP', JSON.stringify(proveedores));
    renderTable();
    e.target.reset();
  };
}

