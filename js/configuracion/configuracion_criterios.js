// /js/configuracion/configuracion_criterios.js

export function renderCriteriosClasificacion() {
  const cont = document.getElementById('criterios-clasificacion-content');
  if (!cont) return;

  // Limpia el contenedor
  cont.innerHTML = `
    <h5 class="section-title">Criterios de Clasificación por Cliente</h5>
    <form id="form-criterios" class="row criteria-form">
      <div class="input-field col s12 m2">
        <input id="clienteCriterio" type="text" />
        <label for="clienteCriterio">Cliente</label>
      </div>
      <div class="input-field col s12 m2">
        <input id="unKgMin" type="number" min="0" />
        <label for="unKgMin">Un/Kg mín.</label>
      </div>
      <div class="input-field col s12 m2">
        <input id="unKgMax" type="number" min="0" />
        <label for="unKgMax">Un/Kg máx.</label>
      </div>
      <div class="input-field col s12 m2">
        <input id="rechazoMin" type="number" min="0" max="100" />
        <label for="rechazoMin">% Rechazo mín.</label>
      </div>
      <div class="input-field col s12 m2">
        <input id="rechazoMax" type="number" min="0" max="100" />
        <label for="rechazoMax">% Rechazo máx.</label>
      </div>
      <div class="input-field col s12 m1">
        <input id="rdmtoMin" type="number" min="0" max="100" />
        <label for="rdmtoMin">% Rdmto mín.</label>
      </div>
      <div class="input-field col s12 m1">
        <input id="rdmtoMax" type="number" min="0" max="100" />
        <label for="rdmtoMax">% Rdmto máx.</label>
      </div>
      <div class="col s12 m1 center-align" style="margin-top:24px;">
        <button type="submit" class="btn blue"><i class="material-icons">add</i></button>
      </div>
    </form>
    <div class="responsive-table">
      <table class="highlight" id="criterios-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Un/Kg min</th>
            <th>Un/Kg max</th>
            <th>% Rechazo min</th>
            <th>% Rechazo max</th>
            <th>% Rdmto min</th>
            <th>% Rdmto max</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  // Datos dummy (remplaza por fetch a Mongo en el futuro)
  let criterios = JSON.parse(localStorage.getItem('criteriosClasif') || '[]');

  // Render tabla
  function renderTable() {
    const tbody = cont.querySelector('#criterios-table tbody');
    tbody.innerHTML = criterios.map((c, idx) => `
      <tr>
        <td>${c.cliente}</td>
        <td>${c.unKgMin}</td>
        <td>${c.unKgMax}</td>
        <td>${c.rechazoMin}</td>
        <td>${c.rechazoMax}</td>
        <td>${c.rdmtoMin}</td>
        <td>${c.rdmtoMax}</td>
        <td>
          <button class="btn-flat btn-small red-text btn-del" data-idx="${idx}" title="Eliminar"><i class="material-icons">delete</i></button>
        </td>
      </tr>
    `).join('');
    // Listener eliminar
    cont.querySelectorAll('.btn-del').forEach(btn => {
      btn.onclick = () => {
        criterios.splice(+btn.dataset.idx, 1);
        localStorage.setItem('criteriosClasif', JSON.stringify(criterios));
        renderTable();
      };
    });
  }
  renderTable();

  // Evento submit formulario
  cont.querySelector('#form-criterios').onsubmit = e => {
    e.preventDefault();
    const cliente = cont.querySelector('#clienteCriterio').value.trim();
    const unKgMin = +cont.querySelector('#unKgMin').value;
    const unKgMax = +cont.querySelector('#unKgMax').value;
    const rechazoMin = +cont.querySelector('#rechazoMin').value;
    const rechazoMax = +cont.querySelector('#rechazoMax').value;
    const rdmtoMin = +cont.querySelector('#rdmtoMin').value;
    const rdmtoMax = +cont.querySelector('#rdmtoMax').value;

    if (!cliente) return M.toast({ html: 'Cliente requerido' });
    criterios.push({ cliente, unKgMin, unKgMax, rechazoMin, rechazoMax, rdmtoMin, rdmtoMax });
    localStorage.setItem('criteriosClasif', JSON.stringify(criterios));
    renderTable();
    e.target.reset();
  };
}
