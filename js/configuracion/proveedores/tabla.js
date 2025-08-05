import { getProveedores } from './service.js';
import { abrirModalProveedor } from './modal.js';
import { importarProveedores } from './importacion.js';

let dataTable = null;

export async function initTablaProveedores() {
  try {
    const cont = document.getElementById('proveedores-mmpp-content');
    if (!cont) {
      console.error('[Proveedores] No se encontró el contenedor #proveedores-mmpp-content');
      return;
    }
    console.log('[Proveedores] Renderizando tabla de proveedores…');

    cont.innerHTML = `
      <div class="row">
        <div class="col s12 right-align">
          <button id="btnImportarProveedores" class="btn-flat teal white-text"><i class="material-icons left">upload</i>Importar Excel</button>
          <button id="btnNuevoProveedor" class="btn-flat teal white-text"><i class="material-icons left">add</i>Nuevo proveedor</button>
        </div>
      </div>
      <table id="tablaProveedores" class="striped highlight display" style="width:100%">
        <thead>
          <tr>
            <th>RUT</th>
            <th>Razón Social</th>
            <th>Contacto</th>
            <th>Teléfono</th>
            <th>Correo</th>
            <th>Comuna</th>
            <th>Categoría</th>
            <th>Centros Asociados</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;

    console.log('[Proveedores] Llamando a getProveedores()…');
    const proveedores = await getProveedores();
    console.log('[Proveedores] Lista recibida:', proveedores);

    const tbody = cont.querySelector('tbody');
    if (!tbody) {
      console.error('[Proveedores] No se encontró el <tbody>');
      return;
    }

    tbody.innerHTML = (proveedores || []).map((prov, idx) => `
      <tr data-id="${prov._id}">
        <td>${prov.rut || ''}</td>
        <td>${prov.razon_social || ''}</td>
        <td>${prov.contacto || ''}</td>
        <td>${prov.telefono || ''}</td>
        <td>${prov.correo || ''}</td>
        <td>${prov.comuna || ''}</td>
        <td>${prov.categoria || ''}</td>
        <td>
          <span class="badge teal lighten-3 grey-text text-darken-4" style="font-size:.93em;">
            ${(prov.centros?.length || 0)}
          </span>
          <button class="btn-flat btn-centros-tooltip" data-id="${prov._id}" title="Ver centros asociados"><i class="material-icons tiny teal-text">location_on</i></button>
        </td>
        <td>
          <button class="btn-flat btn-editar-proveedor" data-id="${prov._id}" title="Editar"><i class="material-icons">edit</i></button>
          <button class="btn-flat btn-historial-proveedor" data-id="${prov._id}" title="Historial"><i class="material-icons">bar_chart</i></button>
        </td>
      </tr>
    `).join('');

    // Inicia DataTable (reinicia si ya existe)
    console.log('[Proveedores] Inicializando DataTable...');
    if (dataTable) {
      dataTable.destroy();
      $('#tablaProveedores').empty();
      console.log('[Proveedores] DataTable destruido (refrescando)');
    }
    dataTable = $('#tablaProveedores').DataTable({
      dom: 'Bfrtip',
      buttons: ['excel', 'csv', 'pdf'],
      responsive: true,
      language: {
        search: "Buscar proveedor:",
        zeroRecords: "No se encontraron proveedores.",
        info: "Mostrando _START_ a _END_ de _TOTAL_",
        infoEmpty: "Sin proveedores",
        lengthMenu: "Mostrar _MENU_ proveedores"
      }
    });
    console.log('[Proveedores] DataTable inicializado OK');

    document.getElementById('btnNuevoProveedor').onclick = () => {
      console.log('[Proveedores] Click: Nuevo Proveedor');
      abrirModalProveedor(null);
    };
    document.getElementById('btnImportarProveedores').onclick = () => {
      console.log('[Proveedores] Click: Importar Proveedores');
      importarProveedores();
    };

    tbody.querySelectorAll('.btn-editar-proveedor').forEach(btn => {
      btn.onclick = e => {
        console.log('[Proveedores] Click: Editar', btn.dataset.id);
        abrirModalProveedor(btn.dataset.id);
      };
    });
    tbody.querySelectorAll('.btn-centros-tooltip').forEach(btn => {
      btn.onclick = e => {
        console.log('[Proveedores] Click: Ver Centros', btn.dataset.id);
        // CAMBIO: import absoluto
        import('/js/configuracion/proveedores/service.js').then(mod => {
          const centros = mod.getCentrosByProveedor(btn.dataset.id) || [];
          if (!centros.length) {
            M.toast({ html: 'Sin centros asociados', displayLength: 3500 });
            return;
          }
          const html = centros.map(c => `<li>${c.name} <small>(${c.code || ''})</small></li>`).join('');
          M.toast({ html: `<b>Centros asociados:</b><ul>${html}</ul>`, displayLength: 5500 });
        });
      };
    });
    tbody.querySelectorAll('.btn-historial-proveedor').forEach(btn => {
      btn.onclick = e => {
        console.log('[Proveedores] Click: Historial', btn.dataset.id);
        // CAMBIO: import absoluto
        import('/js/configuracion/proveedores/modal.js').then(mod => {
          mod.abrirHistorialProveedor(btn.dataset.id);
        });
      };
    });
    console.log('[Proveedores] Eventos asignados');
  } catch (err) {
    console.error('[Proveedores] ERROR en initTablaProveedores:', err);
    M.toast({ html: 'Error en la vista de proveedores', classes: 'red' });
  }
}
