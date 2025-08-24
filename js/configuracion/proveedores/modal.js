import { getProveedorById, getCentrosByProveedor, saveProveedor } from './service.js';

export async function abrirModalProveedor(proveedorId) {
  let proveedor = proveedorId ? await getProveedorById(proveedorId) : null;
  if (!proveedor) proveedor = {
    rut: '', razon_social: '', contacto: '', telefono: '', correo: '',
    comuna: '', categoria: '', centros: [], observaciones: '', toneladas: []
  };

  let modal = document.getElementById('modalProveedor');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'modalProveedor';
    document.body.appendChild(modal);
    M.Modal.init(modal);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <h5>${proveedorId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h5>
      <form id="formProveedor">
        <div class="input-field"><input id="inputRut" type="text" value="${proveedor.rut}" required><label for="inputRut" class="active">RUT</label></div>
        <div class="input-field"><input id="inputRazon" type="text" value="${proveedor.razon_social}" required><label for="inputRazon" class="active">Razón Social</label></div>
        <div class="input-field"><input id="inputContacto" type="text" value="${proveedor.contacto || ''}"><label for="inputContacto" class="active">Contacto</label></div>
        <div class="input-field"><input id="inputTelefono" type="text" value="${proveedor.telefono || ''}"><label for="inputTelefono" class="active">Teléfono</label></div>
        <div class="input-field"><input id="inputCorreo" type="text" value="${proveedor.correo || ''}"><label for="inputCorreo" class="active">Correo</label></div>
        <div class="input-field"><input id="inputComuna" type="text" value="${proveedor.comuna || ''}"><label for="inputComuna" class="active">Comuna</label></div>
        <div class="input-field"><input id="inputCategoria" type="text" value="${proveedor.categoria || ''}"><label for="inputCategoria" class="active">Categoría</label></div>
        <div class="input-field"><textarea id="inputObservaciones" class="materialize-textarea">${proveedor.observaciones || ''}</textarea><label for="inputObservaciones" class="active">Observaciones</label></div>
        <div>
          <h6>Centros Asociados</h6>
          <ul id="listaCentrosProveedor" class="collection">
            ${(getCentrosByProveedor(proveedorId) || []).map(c => `
              <li class="collection-item">${c.name} <span class="grey-text">(${c.code || ''})</span></li>
            `).join('')}
          </ul>
        </div>
        <div class="right-align" style="margin-top:1.2em">
          <button class="btn-flat teal white-text" type="submit">${proveedorId ? 'Actualizar' : 'Crear'}</button>
          <button class="btn-flat modal-close" type="button">Cancelar</button>
        </div>
      </form>
    </div>
  `;
  M.updateTextFields();
  M.Modal.getInstance(modal).open();

  modal.querySelector('#formProveedor').onsubmit = async function(e) {
    e.preventDefault();
    const p = {
      ...proveedor,
      rut: modal.querySelector('#inputRut').value.trim(),
      razon_social: modal.querySelector('#inputRazon').value.trim(),
      contacto: modal.querySelector('#inputContacto').value.trim(),
      telefono: modal.querySelector('#inputTelefono').value.trim(),
      correo: modal.querySelector('#inputCorreo').value.trim(),
      comuna: modal.querySelector('#inputComuna').value.trim(),
      categoria: modal.querySelector('#inputCategoria').value.trim(),
      observaciones: modal.querySelector('#inputObservaciones').value.trim(),
    };
    await saveProveedor(p);
    M.Modal.getInstance(modal).close();
    // Import absoluto para refrescar tabla
    import('/js/configuracion/proveedores/tabla.js').then(mod => mod.initTablaProveedores());
  };
}

export function abrirHistorialProveedor(proveedorId) {
  M.toast({ html: 'Historial de toneladas: función por implementar', displayLength: 3500 });
}

