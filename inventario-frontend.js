const API = 'https://backend-appmitylus-production.up.railway.app/api/inventario';

let centros = [];
let table;

document.addEventListener('DOMContentLoaded', () => {
  M.Modal.init(document.querySelectorAll('.modal'));
  table = $('#centrosTable').DataTable({ searching: false });

  cargarCentros();

  // Abrir modal nuevo centro
  document.getElementById('btnOpenCentroModal').onclick = () => {
    document.getElementById('formTitle').textContent = 'Agregar Centro de Cultivo';
    document.getElementById('formCentro').reset();
    document.getElementById('inputCentroId').value = '';
    M.updateTextFields();
    M.Modal.getInstance(document.getElementById('centroModal')).open();
  };

  // Guardar centro (nuevo o editado)
  document.getElementById('formCentro').onsubmit = async e => {
    e.preventDefault();
    const nombreCentro = document.getElementById('inputName').value.trim();
    const codigoCentro = document.getElementById('inputCode').value.trim();
    const hectareas    = Number(document.getElementById('inputHectareas').value);
    const coordsRaw    = document.getElementById('inputCoords').value.trim();

    let puntos = [];
    if (coordsRaw) {
      puntos = coordsRaw.split('|').map(s => {
        const [lat, lng] = s.split(',').map(Number);
        return { lat, lng };
      });
    }

    const data = { nombreCentro, codigoCentro, hectareas, puntos };

    const id = document.getElementById('inputCentroId').value;
    if (id) {
      // Editar
      await fetch(`${API}/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
      M.toast({ html: 'Centro actualizado', classes: 'green' });
    } else {
      // Nuevo
      await fetch(API, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
      M.toast({ html: 'Centro creado', classes: 'green' });
    }
    M.Modal.getInstance(document.getElementById('centroModal')).close();
    cargarCentros();
  };
});

// Cargar todos los centros y poblar tabla
async function cargarCentros() {
  const res = await fetch(API);
  centros = await res.json();

  table.clear();
  centros.forEach(c => {
    table.row.add([
      c.nombreCentro,
      c.codigoCentro,
      c.hectareas,
      (c.puntos || []).map(pt => `${pt.lat},${pt.lng}`).join('<br>'),
      `
      <button class="btn-small blue" onclick="editarCentro('${c._id}')">Editar</button>
      <button class="btn-small red" onclick="eliminarCentro('${c._id}')">&times;</button>
      `
    ]);
  });
  table.draw();
}

window.editarCentro = async function(id) {
  const centro = centros.find(c => c._id === id);
  if (!centro) return;
  document.getElementById('inputCentroId').value = id;
  document.getElementById('inputName').value = centro.nombreCentro;
  document.getElementById('inputCode').value = centro.codigoCentro;
  document.getElementById('inputHectareas').value = centro.hectareas;
  document.getElementById('inputCoords').value = (centro.puntos || []).map(pt => `${pt.lat},${pt.lng}`).join(' | ');
  document.getElementById('formTitle').textContent = 'Editar Centro';
  M.updateTextFields();
  M.Modal.getInstance(document.getElementById('centroModal')).open();
};

window.eliminarCentro = async function(id) {
  if (!confirm('¿Eliminar este centro?')) return;
  await fetch(`${API}/${id}`, { method: 'DELETE' });
  cargarCentros();
};

